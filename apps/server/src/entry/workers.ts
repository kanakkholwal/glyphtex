import { disabledBlobs } from "../adapters/blobs/disabled.ts";
import { cfQueue, cfRateLimiter, kvCache, r2Blobs } from "../adapters/cloudflare/index.ts";
import type {
	DurableObjectNamespace,
	DurableObjectState,
	ExecutionContext,
	Hyperdrive,
	KVNamespace,
	MessageBatch,
	Queue,
	R2Bucket,
	RateLimit,
	SendEmail,
	WorkersWebSocketPair
} from "../adapters/cloudflare/bindings.ts";
import { switchingProtocols } from "../adapters/cloudflare/bindings.ts";
import { cloudflareMailer } from "../adapters/mail/cloudflare.ts";
import { noMailer } from "../adapters/mail/none.ts";
import { resendMailer } from "../adapters/mail/resend.ts";
import { s3Blobs } from "../adapters/s3/blobs.ts";
import type { Adapters } from "../adapters/types.ts";
import { createApp } from "../app.ts";
import { createAuth } from "../auth/auth.ts";
import {
	type Config,
	configNotes,
	parseConfig,
	required,
	withoutBlobs,
	withoutMail
} from "../config.ts";
import type { Deps } from "../context.ts";
import { connectDb } from "../db/client.ts";
import { runJob } from "../jobs/handlers.ts";
import { type Job, parseJob } from "../jobs/types.ts";
import { buildInfo } from "../lib/build.ts";
import { createLogger } from "../lib/logger.ts";
import { backoffDelay } from "../lib/resilience.ts";
import { orgRepository } from "../repositories/orgs.ts";
import { projectRepository } from "../repositories/projects.ts";
import { LIVE_CLOSE } from "../realtime/limits.ts";
import { buildRoom } from "../realtime/registry.ts";
import { bytesOf, type Peer, type Room } from "../realtime/room.ts";

interface Env extends Record<string, unknown> {
	HYPERDRIVE?: Hyperdrive;
	CACHE: KVNamespace;
	JOBS: Queue<Job>;
	BLOBS?: R2Bucket;
	EMAIL?: SendEmail;
	/** One Durable Object per live file. Absent means this deployment has no live editing. */
	ROOMS?: DurableObjectNamespace;
	/** Workers version metadata binding: id and upload time of the running version. */
	CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
	API_RATE_LIMITER: RateLimit;
	SHARE_RATE_LIMITER: RateLimit;
}

const logger = createLogger({ runtime: "workers" });

// Adapters (and their breakers) are built once per isolate; DB connections can't be,
// because Workers can't share sockets across requests.
const perEnv = new WeakMap<Env, { config: Config; adapters: Adapters }>();

function buildBlobs(env: Env, config: Config) {
	switch (config.blobDriver) {
		case "s3":
			return s3Blobs({
				endpoint: required(config.s3.endpoint, "S3_ENDPOINT"),
				region: config.s3.region,
				bucket: required(config.s3.bucket, "S3_BUCKET"),
				accessKeyId: required(config.s3.accessKeyId, "S3_ACCESS_KEY_ID"),
				secretAccessKey: required(config.s3.secretAccessKey, "S3_SECRET_ACCESS_KEY")
			});
		case "r2":
			return r2Blobs(required(env.BLOBS, "BLOBS (R2 binding)"));
		default:
			return disabledBlobs();
	}
}

function buildMailer(env: Env, config: Config) {
	switch (config.mailDriver) {
		case "cloudflare":
			return env.EMAIL ? cloudflareMailer(env.EMAIL, config.mail.from) : noMailer();
		case "resend":
			return resendMailer(required(config.mail.resendApiKey, "RESEND_API_KEY"), config.mail.from);
		default:
			return noMailer();
	}
}

function envState(env: Env) {
	let state = perEnv.get(env);
	if (!state) {
		let config = parseConfig(env);
		// A binding missing from wrangler.jsonc must not take the whole API down.
		if (config.mailDriver === "cloudflare" && !env.EMAIL) config = withoutMail(config);
		if (config.blobDriver === "r2" && !env.BLOBS) config = withoutBlobs(config);
		for (const note of configNotes(config)) logger.warn(note);
		if (config.mailDriver === "smtp") throw new Error("Workers can't open SMTP connections.");
		const blobs = buildBlobs(env, config);
		state = {
			config,
			adapters: {
				cache: kvCache(env.CACHE),
				queue: cfQueue(env.JOBS),
				blobs,
				mailer: buildMailer(env, config),
				rateLimiter: cfRateLimiter({ api: env.API_RATE_LIMITER, share: env.SHARE_RATE_LIMITER })
			}
		};
		perEnv.set(env, state);
	}
	return state;
}

function openDb(env: Env, config: Config) {
	const url =
		env.HYPERDRIVE?.connectionString ?? required(config.databaseUrl, "DATABASE_URL or HYPERDRIVE");
	return connectDb(url, { max: 5, viaHyperdrive: !!env.HYPERDRIVE });
}

function openDeps(env: Env) {
	const { config, adapters } = envState(env);
	const { db, close } = openDb(env, config);
	const auth = createAuth({ config, db, queue: adapters.queue });
	const deps: Deps = {
		config,
		db,
		adapters,
		auth,
		logger,
		build: buildInfo("workers", config, env.CF_VERSION_METADATA)
	};
	return { deps, close };
}

const app = createApp(
	({ env, executionCtx }) => {
		const { deps, close } = openDeps(env as Env);
		const ctx = executionCtx as ExecutionContext | undefined;
		return { deps, dispose: () => (ctx ? ctx.waitUntil(close()) : void close()) };
	},
	{
		host: {
			kind: "workers",
			room: (env, name) => {
				const rooms = (env as Env | undefined)?.ROOMS;
				return rooms ? rooms.get(rooms.idFromName(name)) : null;
			}
		}
	}
);

/**
 * Live co-editing room for one project file. Cloudflare guarantees one instance per name, so every
 * editor of the file reaches the same Yjs document. The guarded Worker route is the only way in and
 * passes the verified user and role as headers. State is kept in storage so a restart resumes the
 * same document history; WebSockets stay accepted (no hibernation), which keeps the room in memory.
 */
export class ProjectRoom {
	#room: Promise<Room> | undefined;
	#close: (() => Promise<void>) | undefined;
	readonly #ctx: DurableObjectState;
	readonly #env: Env;

	constructor(ctx: DurableObjectState, env: Env) {
		this.#ctx = ctx;
		this.#env = env;
	}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get("upgrade") !== "websocket") {
			return new Response("Expected a WebSocket", { status: 426 });
		}
		const userId = request.headers.get("x-room-user");
		const projectId = request.headers.get("x-room-project");
		const path = request.headers.get("x-room-path");
		if (!userId || !projectId || !path) return new Response("Bad request", { status: 400 });
		const canWrite = request.headers.get("x-room-writable") === "1";

		const pair = new (
			globalThis as unknown as { WebSocketPair: typeof WorkersWebSocketPair }
		).WebSocketPair();
		const client = pair[0];
		const server = pair[1];
		server.accept();
		let room: Room;
		try {
			room = await (this.#room ??= this.#open(projectId, userId, path));
		} catch (error) {
			this.#room = undefined;
			logger.error("live room failed to open", { error, projectId });
			server.close(1011, "unavailable");
			return switchingProtocols(client);
		}
		const peer: Peer = { send: (data) => server.send(new Uint8Array(data)), canWrite, userId };
		if (!room.join(peer)) {
			server.close(LIVE_CLOSE.full, "room_full");
			return switchingProtocols(client);
		}
		const timer = setTimeout(
			() => server.close(LIVE_CLOSE.sessionLimit, "session_limit"),
			envState(this.#env).config.live.maxSessionSeconds * 1000
		);
		server.addEventListener("message", (event) => {
			const frame = bytesOf(event.data);
			if (frame) room.receive(peer, frame);
		});
		const leave = async () => {
			clearTimeout(timer);
			if (!(await room.leave(peer))) return;
			this.#room = undefined;
			room.destroy();
			await this.#close?.();
			this.#close = undefined;
		};
		server.addEventListener("close", () => void leave());
		server.addEventListener("error", () => void leave());
		return switchingProtocols(client);
	}

	async #open(projectId: string, userId: string, path: string): Promise<Room> {
		const { deps, close } = openDeps(this.#env);
		this.#close = async () => close();
		const found = await projectRepository(deps.db).findWithRole(projectId, userId);
		if (!found?.role) throw new Error("project not found for this user");
		const stored = await this.#ctx.storage.get<{
			state: Uint8Array;
			epoch: string;
			textSha: string;
		}>("doc");
		return buildRoom(deps, { project: found.project, role: found.role }, userId, path, {
			restore: stored,
			afterPersist: (room, textSha) =>
				this.#ctx.storage.put("doc", { state: room.snapshot(), epoch: room.epoch, textSha })
		});
	}
}

export default {
	fetch: app.fetch,

	/** Daily cron (wrangler triggers): drops audit events past the retention window. */
	async scheduled(_event: unknown, env: Env) {
		const { config } = envState(env);
		const { db, close } = openDb(env, config);
		try {
			const removed = await orgRepository(db).pruneAudit(config.limits.auditRetentionDays);
			logger.info("audit pruned", { removed });
		} finally {
			await close();
		}
	},

	async queue(batch: MessageBatch<unknown>, env: Env) {
		const { config, adapters } = envState(env);
		const { db, close } = openDb(env, config);
		try {
			for (const message of batch.messages) {
				try {
					await runJob(parseJob(message.body), {
						db,
						blobs: adapters.blobs,
						mailer: adapters.mailer,
						logger
					});
					message.ack();
				} catch (error) {
					logger.error("job failed", { error, attempts: message.attempts, id: message.id });
					// wrangler's max_retries (= MAX_JOB_ATTEMPTS) routes it to the dead letter queue.
					message.retry({ delaySeconds: Math.ceil(backoffDelay(message.attempts, 5, 600)) });
				}
			}
		} finally {
			await close();
		}
	}
};
