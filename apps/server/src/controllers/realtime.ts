import { Hono, type MiddlewareHandler } from "hono";
import type { UpgradeWebSocket } from "hono/ws";
import { z } from "zod";
import type { AppEnv, Deps } from "../context.ts";
import { errors } from "../lib/errors.ts";
import { requireProject } from "../middleware/index.ts";
import type { ProjectAccess } from "../rbac/authorize.ts";
import { can } from "../rbac/permissions.ts";
import type { Peer, Room } from "../realtime/room.ts";
import type { RoomRegistry } from "../realtime/registry.ts";

export interface RealtimeOptions {
	registry: RoomRegistry;
	/** Filled once the runtime has created its WebSocket upgrader (it needs the finished app). */
	upgrader: { current?: UpgradeWebSocket };
}

const bytesOf = (data: unknown): Uint8Array | null => {
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	if (ArrayBuffer.isView(data))
		return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	return null;
};

const pathSchema = z.string().min(1).max(512);

/** Live co-editing of one text file. The upgrade is an ordinary guarded request first. */
export function realtimeController(options?: RealtimeOptions) {
	const live: MiddlewareHandler = async (c, next) => {
		if (!options?.upgrader.current) {
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
		const path = parsed.data;
		const writable = can(access.role, "project:write");

		return options.upgrader.current(() => {
			let room: Room | undefined;
			let release: ((peer: Peer) => Promise<void>) | undefined;
			let peer: Peer | undefined;
			const queued: Uint8Array[] = [];
			return {
				async onOpen(_evt, ws) {
					try {
						const acquired = await options.registry.acquire(access, userId, path);
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
