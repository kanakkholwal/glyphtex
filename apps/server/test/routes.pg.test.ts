import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { disabledBlobs } from "../src/adapters/blobs/disabled.ts";
import { createApp } from "../src/app.ts";
import { projectMember } from "../src/db/schema.ts";
import type { ProjectRole } from "../src/db/schema.ts";
import { startPg } from "./pg.ts";

type Pg = Awaited<ReturnType<typeof startPg>>;
let pg: Pg;
let app: ReturnType<typeof createApp>;

/** Stands in for Better Auth: the x-test-user header decides who is signed in. */
const fakeAuth = {
	api: {
		getSession: async ({ headers }: { headers: Headers }) => {
			const id = headers.get("x-test-user");
			return id
				? { user: { id, name: id, email: `${id}@example.test`, emailVerified: true }, session: {} }
				: null;
		},
		listUserAccounts: async () => [],
		getAccessToken: async () => ({ accessToken: "t" })
	}
};

before(async () => {
	pg = await startPg();
	const deps = pg.deps({
		auth: fakeAuth as never,
		adapters: {
			blobs: disabledBlobs(),
			queue: { enqueue: async () => {} },
			rateLimiter: { check: async () => ({ allowed: true, retryAfterSeconds: 0 }) }
		} as never
	});
	app = createApp(() => ({ deps }));
});
after(() => pg.close());

async function world() {
	const owner = await pg.user("owner");
	const p = await pg.project(owner.id);
	await pg.textFile(p.id, "main.tex", "hello");
	const member = async (role: ProjectRole) => {
		const u = await pg.user(role);
		if (role !== "owner") {
			await pg.db
				.insert(projectMember)
				.values({ projectId: p.id, userId: u.id, role: role as "viewer" | "commenter" | "editor" });
		}
		return role === "owner" ? owner : u;
	};
	const stranger = await pg.user("stranger");
	const call = (user: { id: string } | null, method: string, path: string, body?: unknown) =>
		app.request(`/api/projects/${p.id}${path}`, {
			method,
			headers: {
				...(user ? { "x-test-user": user.id } : {}),
				...(body ? { "content-type": "application/json" } : {})
			},
			body: body ? JSON.stringify(body) : undefined
		});
	return { owner, p, member, stranger, call };
}

describe("access", () => {
	test("signed-out requests are refused and strangers can't tell a project exists", async () => {
		const w = await world();
		assert.equal((await w.call(null, "GET", "/comments")).status, 401);
		assert.equal((await w.call(w.stranger, "GET", "/comments")).status, 404);
		assert.equal((await w.call(w.stranger, "GET", "/versions")).status, 404);
		assert.equal((await w.call(w.stranger, "GET", "/git")).status, 404);
	});
});

describe("comments over HTTP", () => {
	test("viewers read but cannot write; commenters can", async () => {
		const w = await world();
		const viewer = await w.member("viewer");
		const commenter = await w.member("commenter");
		const body = { path: "main.tex", body: "Nice", quote: "hello", from: 0, to: 5 };
		assert.equal((await w.call(viewer, "GET", "/comments")).status, 200);
		assert.equal((await w.call(viewer, "POST", "/comments", body)).status, 403);
		const created = await w.call(commenter, "POST", "/comments", body);
		assert.equal(created.status, 201);
		const list = (await (await w.call(viewer, "GET", "/comments?path=main.tex")).json()) as {
			comments: { body: string }[];
		};
		assert.equal(list.comments[0]?.body, "Nice");
	});

	test("validation errors come back as problem details", async () => {
		const w = await world();
		const commenter = await w.member("commenter");
		const res = await w.call(commenter, "POST", "/comments", { path: "m.tex", body: "   " });
		assert.equal(res.status, 400);
		assert.match(res.headers.get("content-type") ?? "", /problem\+json/);
		const huge = await w.call(commenter, "POST", "/comments", {
			path: "m.tex",
			body: "x".repeat(4001)
		});
		assert.equal(huge.status, 400);
	});

	test("resolving and deleting honour roles", async () => {
		const w = await world();
		const commenter = await w.member("commenter");
		const editor = await w.member("editor");
		const made = (await (
			await w.call(commenter, "POST", "/comments", { path: "main.tex", body: "q" })
		).json()) as { comment: { id: string } };
		const id = made.comment.id;
		assert.equal(
			(await w.call(editor, "PATCH", `/comments/${id}`, { resolved: true })).status,
			200
		);
		assert.equal((await w.call(editor, "DELETE", `/comments/${id}`)).status, 403);
		assert.equal((await w.call(commenter, "DELETE", `/comments/${id}`)).status, 204);
	});
});

describe("suggestions over HTTP", () => {
	const s = { path: "main.tex", quote: "hello", replacement: "hi", from: 0, to: 5 };

	test("a commenter proposes, only write access decides", async () => {
		const w = await world();
		const commenter = await w.member("commenter");
		const editor = await w.member("editor");
		const made = await w.call(commenter, "POST", "/suggestions", s);
		assert.equal(made.status, 201);
		const { suggestion } = (await made.json()) as { suggestion: { id: string } };
		const decide = (user: { id: string }, status: string) =>
			w.call(user, "POST", `/suggestions/${suggestion.id}/decision`, { status });
		assert.equal((await decide(commenter, "accepted")).status, 403);
		assert.equal((await decide(editor, "accepted")).status, 200);
		assert.equal((await decide(editor, "rejected")).status, 409);
	});

	test("an invalid decision value is rejected", async () => {
		const w = await world();
		const editor = await w.member("editor");
		const res = await w.call(editor, "POST", "/suggestions/x/decision", { status: "maybe" });
		assert.equal(res.status, 400);
	});
});

describe("versions over HTTP", () => {
	test("editors save and restore, viewers only read, deleting is owner-only", async () => {
		const w = await world();
		const viewer = await w.member("viewer");
		const editor = await w.member("editor");
		assert.equal((await w.call(viewer, "POST", "/versions", { name: "x" })).status, 403);
		const saved = await w.call(editor, "POST", "/versions", { name: "Submitted" });
		assert.equal(saved.status, 201);
		const { id } = (await saved.json()) as { id: string };
		const list = (await (await w.call(viewer, "GET", "/versions")).json()) as {
			versions: { name: string }[];
		};
		assert.equal(list.versions[0]?.name, "Submitted");
		assert.equal((await w.call(viewer, "GET", `/versions/${id}/file?path=main.tex`)).status, 200);
		assert.equal((await w.call(editor, "POST", `/versions/${id}/restore`)).status, 200);
		assert.equal((await w.call(editor, "DELETE", `/versions/${id}`)).status, 403);
		assert.equal((await w.call(w.owner, "DELETE", `/versions/${id}`)).status, 204);
	});

	test("a version name is required and bounded", async () => {
		const w = await world();
		const editor = await w.member("editor");
		assert.equal((await w.call(editor, "POST", "/versions", { name: "" })).status, 400);
		assert.equal(
			(await w.call(editor, "POST", "/versions", { name: "x".repeat(121) })).status,
			400
		);
	});
});

describe("git over HTTP", () => {
	test("only the owner links; invalid repository and branch names are rejected before any host call", async () => {
		const w = await world();
		const editor = await w.member("editor");
		const ok = { provider: "github", repo: "o/r", branch: "main" };
		assert.equal((await w.call(editor, "PUT", "/git", ok)).status, 403);
		for (const bad of [
			{ ...ok, repo: "no-slash" },
			{ ...ok, repo: "../etc" },
			{ ...ok, branch: "a/../b" },
			{ ...ok, branch: "/abs" },
			{ ...ok, provider: "svn" }
		]) {
			assert.equal((await w.call(w.owner, "PUT", "/git", bad)).status, 400, JSON.stringify(bad));
		}
	});

	test("with no host configured, linking says so and pull has nothing to pull", async () => {
		const w = await world();
		const res = await w.call(w.owner, "PUT", "/git", {
			provider: "github",
			repo: "o/r",
			branch: "main"
		});
		assert.equal(res.status, 404);
		assert.equal((await w.call(w.owner, "POST", "/git/pull")).status, 404);
		assert.deepEqual(await (await w.call(w.owner, "GET", "/git")).json(), { link: null });
	});

	test("viewers cannot pull or push", async () => {
		const w = await world();
		const viewer = await w.member("viewer");
		assert.equal((await w.call(viewer, "POST", "/git/pull")).status, 403);
		assert.equal((await w.call(viewer, "POST", "/git/push", { mode: "pr" })).status, 403);
	});
});
