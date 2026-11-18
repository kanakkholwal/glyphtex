import type { Deps } from "../context.ts";
import { errors } from "../lib/errors.ts";
import { isTextPath, normalizePath } from "../lib/paths.ts";
import type { ProjectAccess } from "../rbac/authorize.ts";
import { fileService } from "../services/files.ts";
import { Room } from "./room.ts";

const encoder = new TextEncoder();

/**
 * Decision (architecture): rooms live in this process, so realtime runs on Node/Docker. Workers
 * isolates don't share memory, so the Workers entry leaves it off until a Durable Object hosts
 * the Room (it is transport-agnostic for exactly that reason).
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
			pending = this.#open(access, userId, path);
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

	async #open(access: ProjectAccess, userId: string, path: string) {
		const { config, logger } = this.#deps;
		const files = fileService(this.#deps);
		const { file, text } = await files.read(access, path);
		if (text === null) throw errors.badRequest("Only text files can be edited live.");
		void file;
		return new Room({
			initialText: text,
			maxChars: config.limits.textFileBytes,
			onError: (error) => logger.error("realtime room error", { error, path }),
			persist: async (settled, writer) => {
				// Re-read the version each save: a manual sync may have written since the last one.
				const current = await files.read(access, path);
				await files.write(access, writer || userId, path, encoder.encode(settled), "text/plain", {
					version: current.file.version
				});
			}
		});
	}
}
