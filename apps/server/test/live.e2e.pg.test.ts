import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { eq } from "drizzle-orm";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import WebSocket from "ws";
import { disabledBlobs } from "../src/adapters/blobs/disabled.ts";
import { createApp } from "../src/app.ts";
import { projectFile, projectMember } from "../src/db/schema.ts";
import { RoomRegistry } from "../src/realtime/registry.ts";
import { startPg } from "./pg.ts";

/** Real HTTP server, real WebSockets, real Postgres engine: two browsers editing one file. */

type Pg = Awaited<ReturnType<typeof startPg>>;
let pg: Pg;
let port = 0;
let closeServer: () => Promise<void>;
let registry: RoomRegistry;

const ORIGIN = "https://app.example.test";
const fakeAuth = {
	api: {
		getSession: async ({ headers }: { headers: Headers }) => {
			const id = headers.get("x-test-user");
			return id
				? { user: { id, name: id, email: `${id}@x.test`, emailVerified: true }, session: {} }
				: null;
		}
	}
};

before(async () => {
	pg = await startPg({
		WEB_ORIGINS: ORIGIN,
		LIVE_MAX_EDITORS: "2"
	});
	const deps = pg.deps({
		auth: fakeAuth as never,
		adapters: {
			blobs: disabledBlobs(),
			queue: { enqueue: async () => {} },
			rateLimiter: { check: async () => ({ allowed: true, retryAfterSeconds: 0 }) }
		} as never
	});
	registry = new RoomRegistry(deps);
	const upgrader: { current?: ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"] } = {};
	const app = createApp(() => ({ deps }), { host: { kind: "node", registry, upgrader } });
	const ws = createNodeWebSocket({ app });
	upgrader.current = ws.upgradeWebSocket;
	const server = serve({ fetch: app.fetch, port: 0 });
	ws.injectWebSocket(server);
	await new Promise<void>((resolve) => server.once("listening", () => resolve()));
	port = (server.address() as AddressInfo).port;
	closeServer = () =>
		new Promise<void>((resolve) => {
			server.close(() => resolve());
			if ("closeAllConnections" in server) server.closeAllConnections();
		});
});

after(async () => {
	await closeServer();
	await pg.close();
});

/** A browser stand-in speaking the same sync protocol as the editor's LiveSession. */
class Client {
	readonly doc = new Y.Doc();
	readonly text = this.doc.getText("content");
	closeCode: number | undefined;
	opened: Promise<void>;
	#socket: WebSocket;

	constructor(projectId: string, userId: string, path = "main.tex", origin = ORIGIN) {
		this.#socket = new WebSocket(
			`ws://127.0.0.1:${port}/api/projects/${projectId}/files/live?path=${encodeURIComponent(path)}`,
			{ headers: { "x-test-user": userId, origin } }
		);
		this.#socket.binaryType = "arraybuffer";
		this.opened = new Promise((resolve, reject) => {
			this.#socket.once("open", () => {
				const hello = encoding.createEncoder();
				encoding.writeVarUint(hello, 0);
				syncProtocol.writeSyncStep1(hello, this.doc);
				this.#socket.send(encoding.toUint8Array(hello));
				resolve();
			});
			this.#socket.once("unexpected-response", (_req, res) => {
				this.closeCode = res.statusCode;
				reject(new Error(`handshake refused: ${res.statusCode}`));
			});
			this.#socket.once("error", reject);
		});
		this.opened.catch(() => {});
		this.#socket.on("close", (code) => {
			this.closeCode ??= code;
		});
		this.#socket.on("message", (data: ArrayBuffer) => {
			const decoder = decoding.createDecoder(new Uint8Array(data));
			if (decoding.readVarUint(decoder) !== 0) return;
			const reply = encoding.createEncoder();
			encoding.writeVarUint(reply, 0);
			syncProtocol.readSyncMessage(decoder, reply, this.doc, "server");
			if (encoding.length(reply) > 1) this.#socket.send(encoding.toUint8Array(reply));
		});
		this.doc.on("update", (update: Uint8Array, origin: unknown) => {
			if (origin === "server" || this.#socket.readyState !== WebSocket.OPEN) return;
			const message = encoding.createEncoder();
			encoding.writeVarUint(message, 0);
			syncProtocol.writeUpdate(message, update);
			this.#socket.send(encoding.toUint8Array(message));
		});
	}

	insert(index: number, text: string) {
		this.text.insert(index, text);
	}

	close() {
		this.#socket.close();
		return new Promise<void>((resolve) => {
			if (this.#socket.readyState === WebSocket.CLOSED) return resolve();
			this.#socket.once("close", () => resolve());
		});
	}
}

const until = async (check: () => boolean | Promise<boolean>, what: string, ms = 8000) => {
	const end = Date.now() + ms;
	while (!(await check())) {
		if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
		await new Promise((r) => setTimeout(r, 25));
	}
};

async function world(initial = "Hello") {
	const owner = await pg.user("owner");
	const p = await pg.project(owner.id);
	await pg.textFile(p.id, "main.tex", initial);
	const add = async (role: "viewer" | "editor") => {
		const u = await pg.user(role);
		await pg.db.insert(projectMember).values({ projectId: p.id, userId: u.id, role });
		return u;
	};
	const saved = async () =>
		(await pg.db.select().from(projectFile).where(eq(projectFile.projectId, p.id)))[0];
	return { owner, p, add, saved };
}

describe("live editing end to end", () => {
	test("a new editor receives the saved text, and two editors converge", async () => {
		const w = await world("Hello");
		const editor = await w.add("editor");
		const a = new Client(w.p.id, w.owner.id);
		const b = new Client(w.p.id, editor.id);
		await Promise.all([a.opened, b.opened]);
		await until(
			() => a.text.toString() === "Hello" && b.text.toString() === "Hello",
			"initial text"
		);

		a.insert(5, " world");
		await until(() => b.text.toString() === "Hello world", "a's edit to reach b");
		b.insert(0, ">> ");
		await until(() => a.text.toString() === ">> Hello world", "b's edit to reach a");
		await Promise.all([a.close(), b.close()]);
	});

	test("the shared text is saved to the project file when the last editor leaves", async () => {
		const w = await world("v1");
		const a = new Client(w.p.id, w.owner.id);
		await a.opened;
		await until(() => a.text.toString() === "v1", "initial text");
		const before = await w.saved();
		a.insert(2, " edited");
		await a.close();
		await until(async () => (await w.saved())?.content === "v1 edited", "the file to be saved");
		const after = await w.saved();
		assert.ok((after?.version ?? 0) > (before?.version ?? 0), "the file version moved on");
		await until(() => registry.roomCount === 0, "the empty room to be released");
	});

	test("a read-only collaborator watches but cannot change the text", async () => {
		const w = await world("Locked");
		const viewer = await w.add("viewer");
		const a = new Client(w.p.id, w.owner.id);
		const v = new Client(w.p.id, viewer.id);
		await Promise.all([a.opened, v.opened]);
		await until(() => v.text.toString() === "Locked", "viewer to see the text");
		v.insert(6, " HACKED");
		a.insert(6, "!");
		// The viewer's own browser keeps what it typed locally, but still receives the owner's edit.
		await until(() => v.text.toString().includes("!"), "the owner's edit to reach the viewer");
		await new Promise((r) => setTimeout(r, 200));
		assert.equal(a.text.toString(), "Locked!", "the viewer's edit never reached the owner");
		await Promise.all([a.close(), v.close()]);
		await until(
			async () => (await w.saved())?.content === "Locked!",
			"only the owner's text saved"
		);
	});

	test("the editor limit refuses the next person with a clear close code", async () => {
		const w = await world("Busy");
		const e1 = await w.add("editor");
		const e2 = await w.add("editor");
		const a = new Client(w.p.id, w.owner.id);
		const b = new Client(w.p.id, e1.id);
		await Promise.all([a.opened, b.opened]);
		await until(
			() => a.text.toString() === "Busy" && b.text.toString() === "Busy",
			"two editors in"
		);
		const c = new Client(w.p.id, e2.id);
		await c.opened;
		await until(() => c.closeCode !== undefined, "the third editor to be refused");
		assert.equal(c.closeCode, 4001);
		assert.equal(a.text.toString(), "Busy", "the others are unaffected");
		await Promise.all([a.close(), b.close()]);
	});

	test("reconnecting after everyone left starts from the saved text", async () => {
		const w = await world("start");
		const a = new Client(w.p.id, w.owner.id);
		await a.opened;
		await until(() => a.text.toString() === "start", "initial text");
		a.insert(5, " + more");
		await a.close();
		await until(async () => (await w.saved())?.content === "start + more", "save");
		const again = new Client(w.p.id, w.owner.id);
		await again.opened;
		await until(() => again.text.toString() === "start + more", "the saved text on reconnect");
		await again.close();
	});

	test("an unlisted origin is refused at the handshake and strangers never connect", async () => {
		const w = await world("x");
		const evil = new Client(w.p.id, w.owner.id, "main.tex", "https://evil.example");
		await assert.rejects(evil.opened, /403/);
		const stranger = await pg.user("stranger");
		const out = new Client(w.p.id, stranger.id);
		await assert.rejects(out.opened, /404/);
	});

	test("only text files can be edited live", async () => {
		const w = await world("x");
		await pg.textFile(w.p.id, "figure.png", "not text");
		const c = new Client(w.p.id, w.owner.id, "figure.png");
		await c.opened;
		await until(() => c.closeCode !== undefined, "the socket to be closed");
		assert.equal(c.closeCode, 1011);
	});
});
