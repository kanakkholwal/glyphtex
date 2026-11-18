import { yCollab } from "y-codemirror.next";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import type { Extension } from "@codemirror/state";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const MSG_EPOCH = 2;
const MAX_ATTEMPTS = 4;

export type LiveStatus =
	| "connecting"
	| "live"
	| "offline"
	/** The server refuses live rooms (deployment without them, or its daily platform limit is used up). */
	| "unavailable"
	/** The file already has the most editors the server allows. */
	| "full"
	/** Disconnected after a stretch with no typing or cursor movement, to free the room. */
	| "idle"
	/** The server's session time limit ended this connection. */
	| "session";

/** Close codes sent by the server (see realtime/limits.ts). */
const CLOSE_FULL = 4001;
const CLOSE_SESSION = 4003;

export interface LivePerson {
	name: string;
	/** Any CSS colour; used for the remote cursor and its name tag. */
	color: string;
}

/**
 * One file's live connection: a Yjs doc synced over the server's WebSocket, plus the CodeMirror
 * extension that binds it. Protocol matches the server room (sync step 1/2, updates, awareness).
 */
export class LiveSession {
	readonly doc = new Y.Doc();
	readonly awareness = new awarenessProtocol.Awareness(this.doc);
	readonly text = this.doc.getText("content");
	readonly extension: Extension;
	/** Resolves when the server's text has arrived; attach the editor only then. */
	readonly synced: Promise<void>;

	#socket: WebSocket | undefined;
	#attempts = 0;
	#wasLive = false;
	#epoch: string | undefined;
	#closed = false;
	#idleTimer: ReturnType<typeof setTimeout> | undefined;
	readonly #idleSeconds: number | undefined;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#resolveSynced!: () => void;
	readonly #url: string;
	readonly #onStatus: (status: LiveStatus) => void;

	constructor(
		url: string,
		person: LivePerson,
		onStatus: (status: LiveStatus) => void,
		idleSeconds?: number
	) {
		this.#url = url;
		this.#idleSeconds = idleSeconds;
		this.#onStatus = onStatus;
		this.synced = new Promise((resolve) => {
			this.#resolveSynced = resolve;
		});
		this.awareness.setLocalStateField("user", {
			name: person.name,
			color: person.color,
			colorLight: `${person.color}33`
		});
		this.extension = yCollab(this.text, this.awareness, {
			undoManager: new Y.UndoManager(this.text)
		});
		this.doc.on("update", (update: Uint8Array, origin: unknown) => {
			if (origin === this) return;
			this.#touch();
			const message = encoding.createEncoder();
			encoding.writeVarUint(message, MSG_SYNC);
			syncProtocol.writeUpdate(message, update);
			this.#send(encoding.toUint8Array(message));
		});
		this.awareness.on(
			"update",
			(
				{ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
				origin: unknown
			) => {
				if (origin === "local") this.#touch();
				const message = encoding.createEncoder();
				encoding.writeVarUint(message, MSG_AWARENESS);
				encoding.writeVarUint8Array(
					message,
					awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
						...added,
						...updated,
						...removed
					])
				);
				this.#send(encoding.toUint8Array(message));
			}
		);
		this.#touch();
		this.#connect();
	}

	/** Typing or moving the cursor restarts the idle clock; when it runs out the connection is released. */
	#touch() {
		if (!this.#idleSeconds || this.#closed) return;
		clearTimeout(this.#idleTimer);
		this.#idleTimer = setTimeout(() => {
			this.#closed = true;
			this.#socket?.close();
			this.#onStatus("idle");
		}, this.#idleSeconds * 1000);
	}

	#send(data: Uint8Array) {
		if (this.#socket?.readyState === WebSocket.OPEN) this.#socket.send(new Uint8Array(data));
	}

	#connect() {
		if (this.#closed) return;
		this.#onStatus("connecting");
		const socket = new WebSocket(this.#url);
		socket.binaryType = "arraybuffer";
		this.#socket = socket;
		socket.onopen = () => {
			this.#attempts = 0;
			this.#wasLive = true;
			this.#onStatus("live");
			const hello = encoding.createEncoder();
			encoding.writeVarUint(hello, MSG_SYNC);
			syncProtocol.writeSyncStep1(hello, this.doc);
			socket.send(new Uint8Array(encoding.toUint8Array(hello)));
			if (this.awareness.getLocalState() !== null) {
				const message = encoding.createEncoder();
				encoding.writeVarUint(message, MSG_AWARENESS);
				encoding.writeVarUint8Array(
					message,
					awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID])
				);
				socket.send(new Uint8Array(encoding.toUint8Array(message)));
			}
		};
		socket.onmessage = (event) => {
			if (!(event.data instanceof ArrayBuffer)) return;
			const decoder = decoding.createDecoder(new Uint8Array(event.data));
			const type = decoding.readVarUint(decoder);
			if (type === MSG_SYNC) {
				const reply = encoding.createEncoder();
				encoding.writeVarUint(reply, MSG_SYNC);
				const sub = syncProtocol.readSyncMessage(decoder, reply, this.doc, this);
				if (sub === syncProtocol.messageYjsSyncStep2) this.#resolveSynced();
				if (encoding.length(reply) > 1) socket.send(new Uint8Array(encoding.toUint8Array(reply)));
			} else if (type === MSG_EPOCH) {
				const epoch = decoding.readVarString(decoder);
				// A new epoch means the server started this document over (restart, new room): keeping
				// our copy would merge with its re-seeded text and duplicate it, so take the server's.
				if (this.#epoch && this.#epoch !== epoch) {
					this.doc.transact(() => this.text.delete(0, this.text.length), this);
				}
				this.#epoch = epoch;
			} else if (type === MSG_AWARENESS) {
				awarenessProtocol.applyAwarenessUpdate(
					this.awareness,
					decoding.readVarUint8Array(decoder),
					this
				);
			}
		};
		socket.onclose = (event) => {
			if (this.#closed) return;
			if (event.code === CLOSE_FULL || event.code === CLOSE_SESSION) {
				this.#closed = true;
				clearTimeout(this.#idleTimer);
				this.#onStatus(event.code === CLOSE_FULL ? "full" : "session");
				return;
			}
			awarenessProtocol.removeAwarenessStates(
				this.awareness,
				[...this.awareness.getStates().keys()].filter((id) => id !== this.doc.clientID),
				this
			);
			this.#attempts += 1;
			// A deployment without live editing refuses every upgrade; stop asking after a few tries.
			if (this.#attempts >= MAX_ATTEMPTS && !this.#wasLive) {
				this.#onStatus("unavailable");
				return;
			}
			this.#onStatus("offline");
			this.#timer = setTimeout(() => this.#connect(), Math.min(1000 * 2 ** this.#attempts, 10_000));
		};
	}

	destroy() {
		this.#closed = true;
		clearTimeout(this.#timer);
		clearTimeout(this.#idleTimer);
		awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], "destroy");
		this.#socket?.close();
		this.awareness.destroy();
		this.doc.destroy();
	}
}
