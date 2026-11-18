import type { Deps } from "../context.ts";
import { sha256Hex } from "../lib/crypto.ts";
import { errors } from "../lib/errors.ts";
import { isTextPath, normalizePath } from "../lib/paths.ts";
import type { ProjectAccess } from "../rbac/authorize.ts";
import { fileService } from "../services/files.ts";
import { Room } from "./room.ts";

const encoder = new TextEncoder();

/**
 * Decision (architecture): on Node/Docker rooms live in this process. Workers isolates don't share
 * memory, so there a Durable Object per file hosts the same Room (see ProjectRoom in entry/workers.ts).
 */
export class RoomRegistry {
	readonly #rooms = new Map<string, Promise<Room>>();
	readonly #deps: Deps;

	constructor(deps: Deps) {
		this.#deps = deps;
	}

	async acquire(access: ProjectAccess, userId: string, rawPath: string) {
		const path = normalizePath(rawPath);
		if (!isTextPath(path)) throw errors.badRequest("Only text files can be edited live.");
		const key = `${access.project.id}:${path}`;
		let pending = this.#rooms.get(key);
		if (!pending) {
			pending = buildRoom(this.#deps, access, userId, path);
			this.#rooms.set(key, pending);
			pending.catch(() => this.#rooms.delete(key));
		}
		const room = await pending;
		return {
			room,
			/** Drops the room from memory once the last peer has left and the text is saved. */
			release: async (peer: Parameters<Room["leave"]>[0]) => {
				if (await room.leave(peer)) {
					this.#rooms.delete(key);
					room.destroy();
				}
			}
		};
	}
}

interface BuildHooks {
	/** Saved state to continue from; used only if the file still holds the text it was saved with. */
	restore?: { state: Uint8Array; epoch: string; textSha: string };
	/** Runs after each successful save to the project file (the Durable Object stores its state here). */
	afterPersist?: (room: Room, textSha: string) => Promise<void>;
}

/** Loads the file's text into a Room whose saves go back through the normal file service. */
export async function buildRoom(
	deps: Deps,
	access: ProjectAccess,
	userId: string,
	path: string,
	hooks: BuildHooks = {}
): Promise<Room> {
	const { config, logger } = deps;
	const files = fileService(deps);
	const { text } = await files.read(access, path);
	if (text === null) throw errors.badRequest("Only text files can be edited live.");
	// A manual sync may have changed the file since the state was saved; then start over from the file.
	const unchanged =
		hooks.restore && (await sha256Hex(encoder.encode(text))) === hooks.restore.textSha;
	const room: Room = new Room({
		initialText: text,
		restore: unchanged ? hooks.restore : undefined,
		maxChars: config.limits.textFileBytes,
		maxPeers: config.live.maxEditors,
		onError: (error) => logger.error("realtime room error", { error, path }),
		persist: async (settled, writer) => {
			// Re-read the version each save: a manual sync may have written since the last one.
			const current = await files.read(access, path);
			const bytes = encoder.encode(settled);
			await files.write(access, writer || userId, path, bytes, "text/plain", {
				version: current.file.version
			});
			await hooks.afterPersist?.(room, await sha256Hex(bytes));
		}
	});
	return room;
}
