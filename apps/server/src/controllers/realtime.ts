import { Hono, type MiddlewareHandler } from "hono";
import type { UpgradeWebSocket } from "hono/ws";
import { z } from "zod";
import type { AppEnv, Deps } from "../context.ts";
import { errors } from "../lib/errors.ts";
import { normalizePath } from "../lib/paths.ts";
import { requireProject } from "../middleware/index.ts";
import type { ProjectAccess } from "../rbac/authorize.ts";
import { can } from "../rbac/permissions.ts";
import { bytesOf, type Peer, type Room } from "../realtime/room.ts";
import type { RoomRegistry } from "../realtime/registry.ts";

/** Where rooms live: in this process (Node/Docker) or in a Durable Object (Workers). */
export type RealtimeHost =
	| {
			kind: "node";
			registry: RoomRegistry;
			/** Filled once the runtime has created its WebSocket upgrader (it needs the finished app). */
			upgrader: { current?: UpgradeWebSocket };
	  }
	| {
			kind: "workers";
			/** The room's Durable Object stub, or null when the ROOMS binding isn't configured. */
			room(env: unknown, name: string): { fetch(request: Request): Promise<Response> } | null;
	  };

export interface RealtimeOptions {
	host: RealtimeHost;
}

/** The deployment's answer to "can you host live rooms?", reported as `features.live`. */
export const realtimeAvailable = (host: RealtimeHost, env: unknown): boolean =>
	host.kind === "node" ? Boolean(host.upgrader.current) : host.room(env, "probe") !== null;

const pathSchema = z.string().min(1).max(512);

/** Live co-editing of one text file. The upgrade is an ordinary guarded request first. */
export function realtimeController(options?: RealtimeOptions) {
	const live: MiddlewareHandler = async (c, next) => {
		const host = options?.host;
		if (!host || !realtimeAvailable(host, c.env)) {
			throw errors.notImplemented("Live editing is not available on this deployment.");
		}
		// Browsers always send Origin on a WebSocket handshake; cookies alone must not authorise one.
		const origin = c.req.header("origin");
		const deps: Deps = c.get("deps");
		if (origin && !deps.config.webOrigins.includes(origin)) throw errors.forbidden();
		const parsed = pathSchema.safeParse(c.req.query("path"));
		if (!parsed.success) throw errors.badRequest("Send ?path= with the file to edit.");
		const access: ProjectAccess = c.get("access");
		const userId: string = c.get("user").id;
		const path = normalizePath(parsed.data);
		const writable = can(access.role, "project:write");

		if (host.kind === "workers") {
			const stub = host.room(c.env, `${access.project.id}:${path}`);
			if (!stub) throw errors.notImplemented("Live editing is not available on this deployment.");
			// The Durable Object has no public route: it trusts these headers because only this
			// guarded handler can reach it, and they overwrite anything the client sent.
			const headers = new Headers(c.req.raw.headers);
			headers.set("x-room-user", userId);
			headers.set("x-room-writable", writable ? "1" : "0");
			headers.set("x-room-project", access.project.id);
			headers.set("x-room-path", path);
			return stub.fetch(new Request(c.req.raw, { headers }));
		}

		return host.upgrader.current?.(() => {
			let room: Room | undefined;
			let release: ((peer: Peer) => Promise<void>) | undefined;
			let peer: Peer | undefined;
			const queued: Uint8Array[] = [];
			return {
				async onOpen(_evt, ws) {
					try {
						const acquired = await host.registry.acquire(access, userId, path);
						peer = { send: (data) => ws.send(new Uint8Array(data)), canWrite: writable, userId };
						room = acquired.room;
						release = acquired.release;
						room.join(peer);
						for (const frame of queued.splice(0)) room.receive(peer, frame);
					} catch {
						ws.close(1011, "unavailable");
					}
				},
				onMessage(evt) {
					const frame = bytesOf(evt.data);
					if (!frame) return;
					if (room && peer) room.receive(peer, frame);
					else if (queued.length < 64) queued.push(frame);
				},
				async onClose() {
					if (peer && release) await release(peer);
				}
			};
		})(c, next);
	};
	return new Hono<AppEnv>().get("/:projectId/files/live", requireProject("project:read"), live);
}
