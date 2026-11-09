import { disabledBlobs } from "../adapters/blobs/disabled.ts";
import { cfQueue, cfRateLimiter, kvCache, r2Blobs } from "../adapters/cloudflare/index.ts";
import type {
	ExecutionContext,
	Hyperdrive,
	KVNamespace,
	MessageBatch,
	Queue,
	R2Bucket,
	RateLimit,
	SendEmail
} from "../adapters/cloudflare/bindings.ts";
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
import { createLogger } from "../lib/logger.ts";
import { backoffDelay } from "../lib/resilience.ts";
import { orgRepository } from "../repositories/orgs.ts";

interface Env extends Record<string, unknown> {
	HYPERDRIVE?: Hyperdrive;
	CACHE: KVNamespace;
	JOBS: Queue<Job>;
	BLOBS?: R2Bucket;
	EMAIL?: SendEmail;
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

const app = createApp(({ env, executionCtx }) => {
	const { config, adapters } = envState(env as Env);
	const { db, close } = openDb(env as Env, config);
	const auth = createAuth({ config, db, queue: adapters.queue });
	const deps: Deps = { config, db, adapters, auth, logger };
	const ctx = executionCtx as ExecutionContext | undefined;
	return { deps, dispose: () => (ctx ? ctx.waitUntil(close()) : void close()) };
});

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
