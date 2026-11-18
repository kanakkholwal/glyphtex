import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bitbucketProvider } from "../src/git/bitbucket.ts";
import { githubProvider } from "../src/git/github.ts";
import { gitlabProvider } from "../src/git/gitlab.ts";
import { bitbucketUser } from "../src/auth/bitbucket.ts";

type Call = { url: string; method: string; body: string | undefined };

/** A fake host: records every request and answers from a route table keyed by "METHOD path". */
function host(routes: Record<string, unknown>) {
	const calls: Call[] = [];
	const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const method = init?.method ?? "GET";
		calls.push({ url, method, body: init?.body ? String(init.body) : undefined });
		const path = url.replace(/^https:\/\/[^/]+/, "").split("?")[0];
		const key = `${method} ${path}`;
		if (!(key in routes)) return new Response("no route", { status: 404 });
		const value = routes[key];
		return value instanceof Response
			? value
			: new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
	}) as typeof fetch;
	return { calls, fetcher };
}

describe("github adapter", () => {
	test("commits changes through blobs, a tree, a commit and a ref update", async () => {
		const { calls, fetcher } = host({
			"GET /repos/o/r/git/commits/p1": { tree: { sha: "t0" } },
			"POST /repos/o/r/git/blobs": { sha: "b1" },
			"POST /repos/o/r/git/trees": { sha: "t1" },
			"POST /repos/o/r/git/commits": { sha: "c1" },
			"PATCH /repos/o/r/git/refs/heads/main": {}
		});
		const gh = githubProvider(fetcher);
		const out = await gh.commit("tok", "o/r", {
			branch: "main",
			parent: "p1",
			message: "msg",
			existing: new Set(),
			changes: [
				{ path: "a.tex", content: "hello" },
				{ path: "old.tex", content: null }
			]
		});
		assert.equal(out.commit, "c1");
		const tree = JSON.parse(calls.find((c) => c.url.endsWith("/git/trees"))?.body ?? "{}");
		assert.equal(tree.base_tree, "t0");
		assert.deepEqual(
			tree.tree.map((e: { path: string; sha: string | null }) => [e.path, e.sha]),
			[
				["a.tex", "b1"],
				["old.tex", null]
			]
		);
		assert.equal(calls.at(-1)?.method, "PATCH");
	});

	test("a new branch creates a ref instead of moving one", async () => {
		const { calls, fetcher } = host({
			"GET /repos/o/r/git/commits/p1": { tree: { sha: "t0" } },
			"POST /repos/o/r/git/trees": { sha: "t1" },
			"POST /repos/o/r/git/commits": { sha: "c1" },
			"POST /repos/o/r/git/refs": {}
		});
		await githubProvider(fetcher).commit("tok", "o/r", {
			branch: "glyphtex/x",
			parent: "p1",
			message: "m",
			existing: new Set(),
			newBranch: true,
			changes: [{ path: "gone.tex", content: null }]
		});
		const ref = calls.at(-1);
		assert.equal(ref?.method, "POST");
		assert.match(ref?.body ?? "", /refs\/heads\/glyphtex\/x/);
	});

	test("an expired token asks the user to reconnect", async () => {
		const { fetcher } = host({
			"GET /user/repos": new Response("", { status: 401 })
		});
		await assert.rejects(githubProvider(fetcher).repos("tok"), /Reconnect your GitHub/);
	});
});

describe("gitlab adapter", () => {
	test("sends create, update and delete actions and starts a new branch from the parent", async () => {
		const { calls, fetcher } = host({
			"POST /api/v4/projects/g%2Fp/repository/commits": { id: "c9" }
		});
		await gitlabProvider("https://gitlab.example", fetcher).commit("tok", "g/p", {
			branch: "b",
			parent: "p1",
			message: "m",
			newBranch: true,
			existing: new Set(["keep.tex"]),
			changes: [
				{ path: "keep.tex", content: "x" },
				{ path: "new.tex", content: "y" },
				{ path: "rm.tex", content: null }
			]
		});
		const body = JSON.parse(calls[0]?.body ?? "{}");
		assert.equal(body.start_sha, "p1");
		assert.deepEqual(
			body.actions.map((a: { action: string }) => a.action),
			["update", "create", "delete"]
		);
	});
});

describe("bitbucket adapter", () => {
	test("posts files as form fields and lists deletions under files", async () => {
		const { calls, fetcher } = host({
			"POST /2.0/repositories/w/r/src": new Response("", { status: 201 }),
			"GET /2.0/repositories/w/r/refs/branches/main": { target: { hash: "h2" } }
		});
		const out = await bitbucketProvider(fetcher).commit("tok", "w/r", {
			branch: "main",
			parent: "h1",
			message: "m",
			existing: new Set(),
			changes: [
				{ path: "a.tex", content: "A" },
				{ path: "b.tex", content: null }
			]
		});
		assert.equal(out.commit, "h2");
		const form = new URLSearchParams(calls[0]?.body);
		assert.equal(form.get("a.tex"), "A");
		assert.equal(form.get("files"), "b.tex");
		assert.equal(form.get("parents"), "h1");
	});
});

describe("bitbucket account mapping", () => {
	test("uses the primary email when Bitbucket shares one", () => {
		const user = bitbucketUser({ uuid: "{u-1}", display_name: "Ada" }, "ada@example.org");
		assert.equal(user?.email, "ada@example.org");
		assert.equal(user?.emailVerified, true);
	});

	test("falls back to an address that cannot receive mail", () => {
		const user = bitbucketUser({ uuid: "{u-1}", nickname: "ada" });
		assert.equal(user?.email, "u-1@bitbucket.invalid");
		assert.equal(user?.emailVerified, false);
		assert.equal(bitbucketUser({}), null);
	});
});
