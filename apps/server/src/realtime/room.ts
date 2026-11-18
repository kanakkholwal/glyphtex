import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const MSG_EPOCH = 2;
const MAX_MESSAGE_BYTES = 1024 * 1024;

export const bytesOf = (data: unknown): Uint8Array | null => {
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	if (ArrayBuffer.isView(data))
		return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	return null;
};

export interface Peer {
	send(data: Uint8Array): void;
	/** Viewers and commenters join to watch: their edits are dropped, never applied. */
	canWrite: boolean;
	userId: string;
}

export interface RoomOptions {
	initialText: string;
	/** A saved Yjs state to continue from (with its epoch) instead of seeding from initialText. */
	restore?: { state: Uint8Array; epoch: string };
	/** Writes the settled text back to the project file; called debounced and on the last leave. */
	persist(text: string, lastWriterId: string): Promise<void>;
	debounceMs?: number;
	maxChars: number;
	/** Most peers that may be connected at once; join() refuses the next one. */
	maxPeers?: number;
	onError?(error: unknown): void;
}

/** One live document: a Yjs doc, who is watching it, and the debounced save to the project file. */
export class Room {
	readonly doc = new Y.Doc();
	/** Identifies this document history. Clients that see it change must drop their copy, or the
	 *  server's re-seeded text would merge with theirs and appear twice. */
	readonly epoch: string;
	readonly awareness = new awarenessProtocol.Awareness(this.doc);
	readonly #peers = new Map<Peer, Set<number>>();
	readonly #opts: RoomOptions;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#dirty = false;
	#lastWriter = "";
	#saving: Promise<void> = Promise.resolve();

	constructor(opts: RoomOptions) {
		this.#opts = opts;
		this.awareness.setLocalState(null);
		this.epoch = opts.restore?.epoch ?? crypto.randomUUID();
		if (opts.restore) Y.applyUpdate(this.doc, opts.restore.state, "init");
		else this.doc.transact(() => this.text.insert(0, opts.initialText), "init");
		this.doc.on("update", (update: Uint8Array, origin: unknown) => {
			const message = encoding.createEncoder();
			encoding.writeVarUint(message, MSG_SYNC);
			syncProtocol.writeUpdate(message, update);
			this.#broadcast(encoding.toUint8Array(message), origin as Peer | string);
			if (origin !== "init") this.#schedule();
		});
		this.awareness.on(
			"update",
			({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
				const changed = [...added, ...updated, ...removed];
				const message = encoding.createEncoder();
				encoding.writeVarUint(message, MSG_AWARENESS);
				encoding.writeVarUint8Array(
					message,
					awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed)
				);
				this.#broadcast(encoding.toUint8Array(message), undefined);
			}
		);
	}

	get text() {
		return this.doc.getText("content");
	}

	/** Full Yjs state, for hosts that keep it across restarts (the Durable Object). */
	snapshot(): Uint8Array {
		return Y.encodeStateAsUpdate(this.doc);
	}

	get size() {
		return this.#peers.size;
	}

	/** Returns false, without adding the peer, when the room is at its peer limit. */
	join(peer: Peer): boolean {
		if (this.#peers.size >= (this.#opts.maxPeers ?? Number.POSITIVE_INFINITY)) return false;
		this.#peers.set(peer, new Set());
		const epoch = encoding.createEncoder();
		encoding.writeVarUint(epoch, MSG_EPOCH);
		encoding.writeVarString(epoch, this.epoch);
		peer.send(encoding.toUint8Array(epoch));
		const step1 = encoding.createEncoder();
		encoding.writeVarUint(step1, MSG_SYNC);
		syncProtocol.writeSyncStep1(step1, this.doc);
		peer.send(encoding.toUint8Array(step1));
		const states = this.awareness.getStates();
		if (states.size > 0) {
			const message = encoding.createEncoder();
			encoding.writeVarUint(message, MSG_AWARENESS);
			encoding.writeVarUint8Array(
				message,
				awarenessProtocol.encodeAwarenessUpdate(this.awareness, [...states.keys()])
			);
			peer.send(encoding.toUint8Array(message));
		}
		return true;
	}

	/** Handles one binary frame from a peer. Malformed or oversize frames are ignored. */
	receive(peer: Peer, data: Uint8Array) {
		if (data.byteLength > MAX_MESSAGE_BYTES || !this.#peers.has(peer)) return;
		try {
			const decoder = decoding.createDecoder(data);
			const type = decoding.readVarUint(decoder);
			if (type === MSG_SYNC) this.#sync(peer, decoder);
			else if (type === MSG_AWARENESS) this.#awareness(peer, decoder);
		} catch (error) {
			this.#opts.onError?.(error);
		}
	}

	#sync(peer: Peer, decoder: decoding.Decoder) {
		const sub = decoding.readVarUint(decoder);
		if (sub === syncProtocol.messageYjsSyncStep1) {
			const reply = encoding.createEncoder();
			encoding.writeVarUint(reply, MSG_SYNC);
			syncProtocol.readSyncStep1(decoder, reply, this.doc);
			peer.send(encoding.toUint8Array(reply));
			return;
		}
		const update = decoding.readVarUint8Array(decoder);
		if (!peer.canWrite) return;
		Y.applyUpdate(this.doc, update, peer);
		if (this.text.length > this.#opts.maxChars) {
			// Past the file size cap: stop saving it instead of growing without bound.
			this.#opts.onError?.(new Error(`document over ${this.#opts.maxChars} characters`));
			this.#dirty = false;
			clearTimeout(this.#timer);
		} else this.#lastWriter = peer.userId;
	}

	#awareness(peer: Peer, decoder: decoding.Decoder) {
		const ids = this.#peers.get(peer);
		const update = decoding.readVarUint8Array(decoder);
		const before = new Set(this.awareness.getStates().keys());
		awarenessProtocol.applyAwarenessUpdate(this.awareness, update, peer);
		for (const id of this.awareness.getStates().keys()) if (!before.has(id)) ids?.add(id);
	}

	/** Returns true when the room is now empty and has been saved. */
	async leave(peer: Peer): Promise<boolean> {
		const ids = this.#peers.get(peer);
		this.#peers.delete(peer);
		if (ids?.size) awarenessProtocol.removeAwarenessStates(this.awareness, [...ids], "leave");
		if (this.#peers.size > 0) return false;
		await this.flush();
		return true;
	}

	#broadcast(message: Uint8Array, except: Peer | string | undefined) {
		for (const peer of this.#peers.keys()) {
			if (peer === except) continue;
			try {
				peer.send(message);
			} catch (error) {
				this.#opts.onError?.(error);
			}
		}
	}

	#schedule() {
		this.#dirty = true;
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => void this.flush(), this.#opts.debounceMs ?? 2000);
	}

	/** Saves now if anything changed. Saves run one at a time so versions never race. */
	flush(): Promise<void> {
		clearTimeout(this.#timer);
		this.#saving = this.#saving.then(async () => {
			if (!this.#dirty) return;
			this.#dirty = false;
			try {
				await this.#opts.persist(this.text.toString(), this.#lastWriter);
			} catch (error) {
				this.#dirty = true;
				this.#opts.onError?.(error);
			}
		});
		return this.#saving;
	}

	destroy() {
		clearTimeout(this.#timer);
		this.awareness.destroy();
		this.doc.destroy();
	}
}
