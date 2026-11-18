import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import { type Peer, Room } from "../src/realtime/room.ts";

/** A browser stand-in: a Yjs doc wired to a peer slot in the room. */
function client(room: Room, canWrite = true, userId = "u") {
	const doc = new Y.Doc();
	const peer: Peer = {
		canWrite,
		userId,
		send(data) {
			const decoder = decoding.createDecoder(data);
			if (decoding.readVarUint(decoder) !== 0) return;
			const reply = encoding.createEncoder();
			encoding.writeVarUint(reply, 0);
			syncProtocol.readSyncMessage(decoder, reply, doc, "server");
			if (encoding.length(reply) > 1) room.receive(peer, encoding.toUint8Array(reply));
		}
	};
	doc.on("update", (update: Uint8Array, origin: unknown) => {
		if (origin === "server") return;
		const message = encoding.createEncoder();
		encoding.writeVarUint(message, 0);
		syncProtocol.writeUpdate(message, update);
		room.receive(peer, encoding.toUint8Array(message));
	});
	room.join(peer);
	// A real client also opens with its own step 1, which is what pulls the server's text down.
	const hello = encoding.createEncoder();
	encoding.writeVarUint(hello, 0);
	syncProtocol.writeSyncStep1(hello, doc);
	room.receive(peer, encoding.toUint8Array(hello));
	return { doc, peer, text: () => doc.getText("content").toString() };
}

const rooms: Room[] = [];
// Awareness runs an interval; rooms must be destroyed or the test process never exits.
after(() => {
	for (const r of rooms) r.destroy();
});

const make = (initialText = "hello", saved: string[] = []) => {
	const room = new Room({
		initialText,
		maxChars: 1000,
		debounceMs: 5,
		persist: async (text) => void saved.push(text)
	});
	rooms.push(room);
	return room;
};

describe("realtime room", () => {
	test("a new peer receives the current text", () => {
		const room = make("abc");
		assert.equal(client(room).text(), "abc");
	});

	test("two writers converge", () => {
		const room = make("x");
		const a = client(room);
		const b = client(room);
		a.doc.getText("content").insert(1, "A");
		b.doc.getText("content").insert(0, "B");
		assert.equal(a.text(), b.text());
		assert.equal(room.text.toString(), a.text());
		assert.match(a.text(), /A/);
		assert.match(a.text(), /B/);
	});

	test("a read-only peer's edits are dropped", () => {
		const room = make("safe");
		const reader = client(room, false);
		const writer = client(room);
		reader.doc.getText("content").insert(0, "EVIL");
		assert.equal(room.text.toString(), "safe");
		assert.equal(writer.text(), "safe");
	});

	test("saves debounced edits and flushes when the last peer leaves", async () => {
		const saved: string[] = [];
		const room = make("a", saved);
		const c = client(room, true, "writer");
		c.doc.getText("content").insert(1, "b");
		assert.equal(await room.leave(c.peer), true);
		assert.deepEqual(saved, ["ab"]);
	});

	test("does not save when nothing changed", async () => {
		const saved: string[] = [];
		const room = make("a", saved);
		const c = client(room);
		await room.leave(c.peer);
		assert.deepEqual(saved, []);
	});

	test("oversize or malformed frames are ignored", () => {
		const room = make("ok");
		const c = client(room);
		room.receive(c.peer, new Uint8Array(2 * 1024 * 1024));
		room.receive(c.peer, new Uint8Array([9, 9, 9]));
		assert.equal(room.text.toString(), "ok");
	});

	test("a document over the size cap is not saved", async () => {
		const saved: string[] = [];
		const room = make("", saved);
		const c = client(room);
		c.doc.getText("content").insert(0, "x".repeat(2000));
		await room.leave(c.peer);
		assert.deepEqual(saved, []);
	});

	test("restores a saved state with the same epoch and history", () => {
		const first = make("seed");
		const c = client(first);
		c.doc.getText("content").insert(4, "!");
		const resumed = new Room({
			initialText: "ignored",
			restore: { state: first.snapshot(), epoch: first.epoch },
			maxChars: 1000,
			persist: async () => {}
		});
		rooms.push(resumed);
		assert.equal(resumed.text.toString(), "seed!");
		assert.equal(resumed.epoch, first.epoch);
		assert.notEqual(make("seed").epoch, first.epoch);
	});

	test("refuses a peer past the room's editor limit", () => {
		const limited = new Room({
			initialText: "x",
			maxChars: 1000,
			maxPeers: 2,
			persist: async () => {}
		});
		rooms.push(limited);
		const peer = (): Peer => ({ canWrite: true, userId: "u", send() {} });
		assert.equal(limited.join(peer()), true);
		assert.equal(limited.join(peer()), true);
		const third = peer();
		assert.equal(limited.join(third), false);
		assert.equal(limited.size, 2);
	});
});
