import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { disabledBlobs } from "../src/adapters/blobs/disabled.ts";
import { createApp } from "../src/app.ts";
import { projectMember } from "../src/db/schema.ts";
import { startPg } from "./pg.ts";

type Pg = Awaited<ReturnType<typeof startPg>>;
let pg: Pg;

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
	pg = await startPg({ WEB_ORIGINS: "https://app.example.test" });
});
after(() => pg.close());

function buildApp(withRoom: boolean) {
	const forwarded: Request[] = [];
	const deps = pg.deps({
		auth: fakeAuth as never,
		adapters: {
			blobs: disabledBlobs(),
			queue: { enqueue: async () => {} },
			rateLimiter: { check: async () => ({ allowed: true, retryAfterSeconds: 0 }) }
		} as never
	});
	const app = createApp(
		() => ({ deps }),
		withRoom
			? {
					host: {
						kind: "workers",
						room: () => ({
							fetch: async (request: Request) => {
								forwarded.push(request);
								return new Response("upgraded", { status: 200 });
							}
						})
					}
				}
			: undefined
	);
	return { app, forwarded };
}

async function setup(role: "viewer" | "editor" | "owner") {
	const owner = await pg.user("owner");
	const p = await pg.project(owner.id);
	await pg.textFile(p.id, "main.tex", "x");
	let user = owner;
	if (role !== "owner") {
		user = await pg.user(role);
		await pg.db.insert(projectMember).values({ projectId: p.id, userId: user.id, role });
	}
	return { p, user };
}

const open = (
	app: ReturnType<typeof createApp>,
	projectId: string,
	userId: string | null,
	extra: Record<string, string> = {},
	path = "main.tex"
) =>
	app.request(`/api/projects/${projectId}/files/live?path=${encodeURIComponent(path)}`, {
		headers: { upgrade: "websocket", ...(userId ? { "x-test-user": userId } : {}), ...extra }
	});

describe("live editing route", () => {
	test("a deployment without a room host answers 501 and the info flag is off", async () => {
		const { app } = buildApp(false);
		const { p, user } = await setup("owner");
		assert.equal((await open(app, p.id, user.id)).status, 501);
		const info = (await (await app.request("/api/public/info")).json()) as {
			features: { live: boolean };
		};
		assert.equal(info.features.live, false);
	});

	test("signed-out visitors and strangers never reach a room", async () => {
		const { app, forwarded } = buildApp(true);
		const { p } = await setup("owner");
		const stranger = await pg.user("stranger");
		assert.equal((await open(app, p.id, null)).status, 401);
		assert.equal((await open(app, p.id, stranger.id)).status, 404);
		assert.equal(forwarded.length, 0);
	});

	test("an unlisted browser origin is refused (cross-site WebSocket hijacking)", async () => {
		const { app, forwarded } = buildApp(true);
		const { p, user } = await setup("owner");
		const res = await open(app, p.id, user.id, { origin: "https://evil.example" });
		assert.equal(res.status, 403);
		assert.equal(forwarded.length, 0);
		const ok = await open(app, p.id, user.id, { origin: "https://app.example.test" });
		assert.equal(ok.status, 200);
	});

	test("the room receives the verified user and role, overwriting anything the client sent", async () => {
		const { app, forwarded } = buildApp(true);
		const { p, user } = await setup("viewer");
		await open(app, p.id, user.id, {
			"x-room-user": "someone-else",
			"x-room-writable": "1",
			"x-room-project": "other-project"
		});
		const seen = forwarded[0];
		assert.equal(seen?.headers.get("x-room-user"), user.id);
		assert.equal(seen?.headers.get("x-room-writable"), "0", "a viewer joins read-only");
		assert.equal(seen?.headers.get("x-room-project"), p.id);
		assert.equal(seen?.headers.get("x-room-path"), "main.tex");
	});

	test("editors are writable, and the file path names the room", async () => {
		const { app, forwarded } = buildApp(true);
		const { p, user } = await setup("editor");
		await open(app, p.id, user.id, {}, "docs/main.tex");
		const seen = forwarded[0];
		assert.equal(seen?.headers.get("x-room-writable"), "1");
		assert.equal(seen?.headers.get("x-room-path"), "docs/main.tex");
	});

	test("non-canonical paths are rejected instead of being aliased to another room", async () => {
		const { app, forwarded } = buildApp(true);
		const { p, user } = await setup("editor");
		assert.equal((await open(app, p.id, user.id, {}, "./docs//main.tex")).status, 400);
		assert.equal(forwarded.length, 0);
	});

	test("a path that climbs out of the project is rejected and never forwarded", async () => {
		const { app, forwarded } = buildApp(true);
		const { p, user } = await setup("editor");
		const res = await open(app, p.id, user.id, {}, "../../etc/passwd");
		assert.ok(res.status >= 400 && res.status < 500, `got ${res.status}`);
		assert.equal(forwarded.length, 0);
	});

	test("a missing path is a client error", async () => {
		const { app } = buildApp(true);
		const { p, user } = await setup("owner");
		const res = await app.request(`/api/projects/${p.id}/files/live`, {
			headers: { upgrade: "websocket", "x-test-user": user.id }
		});
		assert.equal(res.status, 400);
	});
});
