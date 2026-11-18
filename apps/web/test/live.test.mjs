import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";

// Bundled from packages/ui by the pretest script; yjs/lib0 come along with it.
const { LiveSession } = await import("./.build/live.mjs");

class FakeSocket {
	static OPEN = 1;
	static instances = [];
	readyState = 0;
	sent = [];
	binaryType = "";
	constructor(url) {
		this.url = url;
		FakeSocket.instances.push(this);
	}
	send(data) {
		this.sent.push(data);
	}
	close() {
		this.readyState = 3;
	}
	// Test controls
	open() {
		this.readyState = 1;
		this.onopen?.();
	}
	closeWith(code) {
		this.readyState = 3;
		this.onclose?.({ code });
	}
	receive(bytes) {
		this.onmessage?.({
			data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
		});
	}
}

const person = { name: "Ada", color: "#0f6fde" };
const latest = () => FakeSocket.instances.at(-1);

// varUint(2) then varString(epoch): the epoch frame the server sends on join.
const epochFrame = (epoch) => {
	const bytes = new TextEncoder().encode(epoch);
	return new Uint8Array([2, bytes.length, ...bytes]);
};

beforeEach(() => {
	FakeSocket.instances = [];
	globalThis.WebSocket = FakeSocket;
	mock.timers.enable({ apis: ["setTimeout"] });
});
const sessions = [];
// Awareness runs an interval; every session must be destroyed or the process never exits.
afterEach(() => {
	for (const s of sessions.splice(0)) s.destroy();
	mock.timers.reset();
});

function start(idleSeconds) {
	const statuses = [];
	const session = new LiveSession(
		"wss://api.test/live",
		person,
		(s) => statuses.push(s),
		idleSeconds
	);
	sessions.push(session);
	return { session, statuses };
}

describe("LiveSession connection", () => {
	test("opens, says hello with its sync state and reports live", () => {
		const { session, statuses } = start();
		latest().open();
		assert.deepEqual(statuses, ["connecting", "live"]);
		assert.ok(latest().sent.length >= 1, "sync step 1 goes out on open");
		session.destroy();
	});

	test("a full room stops the session without reconnecting", () => {
		const { statuses } = start();
		latest().open();
		latest().closeWith(4001);
		assert.equal(statuses.at(-1), "full");
		mock.timers.tick(60_000);
		assert.equal(FakeSocket.instances.length, 1, "no reconnect after a refusal");
	});

	test("the session time limit ends it for good", () => {
		const { statuses } = start();
		latest().open();
		latest().closeWith(4003);
		assert.equal(statuses.at(-1), "session");
		mock.timers.tick(60_000);
		assert.equal(FakeSocket.instances.length, 1);
	});

	test("a dropped connection retries with backoff", () => {
		const { statuses, session } = start();
		latest().open();
		latest().closeWith(1006);
		assert.equal(statuses.at(-1), "offline");
		mock.timers.tick(2_000);
		assert.equal(FakeSocket.instances.length, 2);
		session.destroy();
	});

	test("a server that never accepts is reported unavailable after a few tries", () => {
		const { statuses } = start();
		for (let i = 0; i < 4; i++) {
			latest().closeWith(1006);
			mock.timers.tick(20_000);
		}
		assert.equal(statuses.at(-1), "unavailable");
		const count = FakeSocket.instances.length;
		mock.timers.tick(120_000);
		assert.equal(FakeSocket.instances.length, count, "it stops asking");
	});
});

describe("LiveSession idle release", () => {
	test("disconnects after the idle time with no typing", () => {
		const { statuses } = start(30);
		latest().open();
		mock.timers.tick(29_000);
		assert.equal(statuses.at(-1), "live");
		mock.timers.tick(2_000);
		assert.equal(statuses.at(-1), "idle");
		assert.equal(latest().readyState, 3);
	});

	test("typing restarts the clock", () => {
		const { session, statuses } = start(30);
		latest().open();
		mock.timers.tick(20_000);
		session.text.insert(0, "a");
		mock.timers.tick(20_000);
		assert.equal(statuses.at(-1), "live", "20s since the edit is still inside the window");
		mock.timers.tick(11_000);
		assert.equal(statuses.at(-1), "idle");
	});

	test("no idle limit means it never releases", () => {
		const { statuses } = start(undefined);
		latest().open();
		mock.timers.tick(10 * 3600 * 1000);
		assert.equal(statuses.at(-1), "live");
	});
});

describe("LiveSession epochs", () => {
	test("a changed epoch drops the local copy so a restarted room can't duplicate text", () => {
		const { session } = start();
		latest().open();
		latest().receive(epochFrame("room-1"));
		session.text.insert(0, "draft text");
		assert.equal(session.text.toString(), "draft text");
		// The room restarted and re-seeded: same connection slot, new epoch.
		latest().receive(epochFrame("room-2"));
		assert.equal(session.text.toString(), "");
		session.destroy();
	});

	test("the same epoch keeps local text", () => {
		const { session } = start();
		latest().open();
		latest().receive(epochFrame("room-1"));
		session.text.insert(0, "keep me");
		latest().receive(epochFrame("room-1"));
		assert.equal(session.text.toString(), "keep me");
		session.destroy();
	});
});
