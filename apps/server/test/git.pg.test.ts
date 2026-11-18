import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { projectFile, projectGitLink } from "../src/db/schema.ts";
import { sha256Hex } from "../src/lib/crypto.ts";
import { fileRepository } from "../src/repositories/files.ts";
import { gitService } from "../src/services/git.ts";
import { startPg } from "./pg.ts";

type Pg = Awaited<ReturnType<typeof startPg>>;
let pg: Pg;

before(async () => {
	pg = await startPg({ GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" });
});
after(() => pg.close());

/** A small stateful GitHub: branches, a file tree per commit, and the Git Data API writes. */
function fakeGitHub(initial: Record<string, string>) {
	let n = 0;
	let head = "c0";
	const trees = new Map<string, Record<string, string>>([["t-c0", { ...initial }]]);
	const commits = new Map<string, { tree: string }>([["c0", { tree: "t-c0" }]]);
	const blobs = new Map<string, string>();
	const state = { pullRequests: [] as unknown[], createdRefs: [] as string[], unauthorised: false };

	const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = new URL(String(input));
		const path = decodeURIComponent(url.pathname);
		const method = init?.method ?? "GET";
		const body = init?.body ? JSON.parse(String(init.body)) : undefined;
		const json = (value: unknown, status = 200) =>
			new Response(JSON.stringify(value), {
				status,
				headers: { "content-type": "application/json" }
			});
		if (state.unauthorised) return new Response("", { status: 401 });

		if (method === "GET" && path === "/repos/o/r/branches")
			return json([{ name: "main" }, { name: "dev" }]);
		if (method === "GET" && path === "/repos/o/r/branches/main") {
			return json({ sha: head, commit: { tree: { sha: commits.get(head)?.tree } } });
		}
		let m = path.match(/^\/repos\/o\/r\/git\/trees\/(.+)$/);
		if (method === "GET" && m) {
			const files = trees.get(m[1] as string) ?? {};
			return json({
				truncated: false,
				tree: Object.entries(files).map(([p, c]) => ({ path: p, type: "blob", size: c.length }))
			});
		}
		m = path.match(/^\/repos\/o\/r\/contents\/(.+)$/);
		if (method === "GET" && m) {
			const tree = trees.get(commits.get(url.searchParams.get("ref") ?? head)?.tree ?? "") ?? {};
			return new Response(tree[m[1] as string] ?? "", {
				status: (m[1] as string) in tree ? 200 : 404
			});
		}
		m = path.match(/^\/repos\/o\/r\/git\/commits\/(.+)$/);
		if (method === "GET" && m) return json({ tree: { sha: commits.get(m[1] as string)?.tree } });
		if (method === "POST" && path === "/repos/o/r/git/blobs") {
			const id = `b${++n}`;
			blobs.set(id, body.content);
			return json({ sha: id });
		}
		if (method === "POST" && path === "/repos/o/r/git/trees") {
			const next = { ...(trees.get(body.base_tree) ?? {}) };
			for (const e of body.tree as { path: string; sha: string | null }[]) {
				if (e.sha === null) delete next[e.path];
				else next[e.path] = blobs.get(e.sha) ?? "";
			}
			const id = `t${++n}`;
			trees.set(id, next);
			return json({ sha: id });
		}
		if (method === "POST" && path === "/repos/o/r/git/commits") {
			const id = `c${++n}`;
			commits.set(id, { tree: body.tree });
			return json({ sha: id });
		}
		if (method === "PATCH" && path === "/repos/o/r/git/refs/heads/main") {
			head = body.sha;
			return json({});
		}
		if (method === "POST" && path === "/repos/o/r/git/refs") {
			state.createdRefs.push(body.ref);
			return json({});
		}
		if (method === "POST" && path === "/repos/o/r/pulls") {
			state.pullRequests.push(body);
			return json({ html_url: "https://github.test/o/r/pull/1" });
		}
		return new Response("no route", { status: 404 });
	}) as typeof fetch;

	return {
		fetcher,
		state,
		/** What the repository holds on `main` now. */
		files: () => trees.get(commits.get(head)?.tree ?? "") ?? {},
		/** Simulates someone else pushing to the branch. */
		pushElsewhere(files: Record<string, string>) {
			const id = `c${++n}`;
			const tree = `t${++n}`;
			trees.set(tree, files);
			commits.set(id, { tree });
			head = id;
		},
		head: () => head
	};
}

function auth(connected = true) {
	return {
		api: {
			listUserAccounts: async () => (connected ? [{ id: "acc1", providerId: "github" }] : []),
			getAccessToken: async () => ({ accessToken: "tok" })
		}
	} as never;
}

async function setup(remote: Record<string, string>, opts: { connected?: boolean } = {}) {
	const owner = await pg.user("Ada");
	const p = await pg.project(owner.id);
	const host = fakeGitHub(remote);
	const svc = gitService(pg.deps({ auth: auth(opts.connected ?? true) }), host.fetcher);
	const headers = new Headers();
	const link = () =>
		svc.link(p.access(), owner.id, headers, { provider: "github", repo: "o/r", branch: "main" });
	const local = async (path: string) => (await fileRepository(pg.db).get(p.id, path))?.content;
	const stored = async () =>
		(await pg.db.select().from(projectGitLink).where(eq(projectGitLink.projectId, p.id)))[0];
	return { owner, p, host, svc, headers, link, local, stored };
}

describe("connecting", () => {
	test("linking needs a connected account and an existing branch", async () => {
		const x = await setup({}, { connected: false });
		await assert.rejects(x.link(), /Connect your GitHub account/);
		const y = await setup({});
		await assert.rejects(
			y.svc.link(y.p.access(), y.owner.id, y.headers, {
				provider: "github",
				repo: "o/r",
				branch: "nope"
			}),
			/doesn't exist/
		);
		await y.link();
		assert.equal((await y.svc.getLink(y.p.access()))?.branch, "main");
	});

	test("an expired token asks to reconnect instead of failing obscurely", async () => {
		const x = await setup({ "a.tex": "A" });
		await x.link();
		x.host.state.unauthorised = true;
		await assert.rejects(x.svc.pull(x.p.access(), x.owner.id, x.headers), /Reconnect your GitHub/);
	});

	test("a host without an OAuth app is simply unavailable", async () => {
		const bare = await startPg();
		const owner = await bare.user("Ada");
		const p = await bare.project(owner.id);
		const svc = gitService(bare.deps({ auth: auth() }));
		await assert.rejects(
			svc.link(p.access(), owner.id, new Headers(), {
				provider: "github",
				repo: "o/r",
				branch: "main"
			}),
			/not found/i
		);
		await bare.close();
	});
});

describe("pull", () => {
	test("creates files that don't exist yet and records the commit", async () => {
		const x = await setup({ "main.tex": "hello", "notes.md": "n", "logo.png": "png" });
		await x.link();
		const r = await x.svc.pull(x.p.access(), x.owner.id, x.headers);
		assert.equal(r.pulled, 3 - 1, "text files only; the png is skipped");
		assert.equal(r.skipped, 1);
		assert.equal(await x.local("main.tex"), "hello");
		assert.equal((await x.stored())?.lastCommit, "c0");
	});

	test("overwrites a file only the remote changed", async () => {
		const x = await setup({ "main.tex": "v1" });
		await x.link();
		await x.svc.pull(x.p.access(), x.owner.id, x.headers);
		x.host.pushElsewhere({ "main.tex": "v2" });
		const r = await x.svc.pull(x.p.access(), x.owner.id, x.headers);
		assert.equal(r.pulled, 1);
		assert.equal(await x.local("main.tex"), "v2");
	});

	test("keeps local edits and reports a conflict when both sides changed", async () => {
		const x = await setup({ "main.tex": "base" });
		await x.link();
		await x.svc.pull(x.p.access(), x.owner.id, x.headers);
		await pg.db
			.update(projectFile)
			.set({ content: "mine", sha256: await sha256Hex("mine"), version: 2 })
			.where(eq(projectFile.projectId, x.p.id));
		x.host.pushElsewhere({ "main.tex": "theirs" });
		const r = await x.svc.pull(x.p.access(), x.owner.id, x.headers);
		assert.deepEqual(r.conflicts, ["main.tex"]);
		assert.equal(r.pulled, 0);
		assert.equal(await x.local("main.tex"), "mine");
	});

	test("leaves a local-only edit alone when the remote did not change", async () => {
		const x = await setup({ "main.tex": "base" });
		await x.link();
		await x.svc.pull(x.p.access(), x.owner.id, x.headers);
		await pg.db
			.update(projectFile)
			.set({ content: "mine", sha256: await sha256Hex("mine"), version: 2 })
			.where(eq(projectFile.projectId, x.p.id));
		const r = await x.svc.pull(x.p.access(), x.owner.id, x.headers);
		assert.deepEqual([r.pulled, r.conflicts.length], [0, 0]);
		assert.equal(await x.local("main.tex"), "mine");
	});

	test("refuses a repository with more text files than a project allows", async () => {
		const many = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`f${i}.tex`, "x"]));
		const owner = await pg.user("Ada");
		const p = await pg.project(owner.id);
		const host = fakeGitHub(many);
		const svc = gitService(
			pg.deps({
				auth: auth(),
				config: { ...pg.config, limits: { ...pg.config.limits, filesPerProject: 3 } }
			}),
			host.fetcher
		);
		await svc.link(p.access(), owner.id, new Headers(), {
			provider: "github",
			repo: "o/r",
			branch: "main"
		});
		await assert.rejects(svc.pull(p.access(), owner.id, new Headers()), /more than 3 text files/);
	});
});

describe("push", () => {
	async function pulled(remote: Record<string, string>) {
		const x = await setup(remote);
		await x.link();
		await x.svc.pull(x.p.access(), x.owner.id, x.headers);
		return x;
	}

	test("requires a pull first", async () => {
		const x = await setup({ "a.tex": "A" });
		await x.link();
		await assert.rejects(
			x.svc.push(x.p.access(), x.owner.id, x.headers, { message: "m", mode: "commit" }),
			/Pull from the repository once/
		);
	});

	test("commits edits, new files and deletions to the linked branch", async () => {
		const x = await pulled({ "main.tex": "v1", "old.tex": "old" });
		await pg.db
			.update(projectFile)
			.set({ content: "v2", sha256: await sha256Hex("v2"), version: 2 })
			.where(eq(projectFile.path, "main.tex"));
		await x.p.id;
		await pg.textFile(x.p.id, "new.tex", "fresh");
		await fileRepository(pg.db).deleteIfVersion(x.p.id, "old.tex", 1);
		const r = await x.svc.push(x.p.access(), x.owner.id, x.headers, {
			message: "Update",
			mode: "commit"
		});
		assert.equal(r.pushed, 3);
		assert.deepEqual(x.host.files(), { "main.tex": "v2", "new.tex": "fresh" });
		assert.equal((await x.stored())?.lastCommit, r.commit);
	});

	test("opens a pull request on a new branch and leaves the sync base alone", async () => {
		const x = await pulled({ "main.tex": "v1" });
		await pg.db
			.update(projectFile)
			.set({ content: "v2", sha256: await sha256Hex("v2"), version: 2 })
			.where(eq(projectFile.projectId, x.p.id));
		const before = (await x.stored())?.lastCommit;
		const r = await x.svc.push(x.p.access(), x.owner.id, x.headers, {
			message: "Fix intro\n\nmore",
			mode: "pr"
		});
		assert.equal(r.pullRequestUrl, "https://github.test/o/r/pull/1");
		assert.match(x.host.state.createdRefs[0] ?? "", /^refs\/heads\/glyphtex\/\d{14}$/);
		assert.equal((x.host.state.pullRequests[0] as { title: string }).title, "Fix intro");
		assert.equal(x.host.files()["main.tex"], "v1", "main is untouched until the PR merges");
		assert.equal((await x.stored())?.lastCommit, before);
	});

	test("refuses when the branch moved since the last pull", async () => {
		const x = await pulled({ "main.tex": "v1" });
		x.host.pushElsewhere({ "main.tex": "other" });
		await assert.rejects(
			x.svc.push(x.p.access(), x.owner.id, x.headers, { message: "m", mode: "commit" }),
			/has new commits/
		);
	});

	test("nothing changed sends nothing", async () => {
		const x = await pulled({ "main.tex": "v1" });
		const r = await x.svc.push(x.p.access(), x.owner.id, x.headers, {
			message: "m",
			mode: "commit"
		});
		assert.equal(r.pushed, 0);
		assert.equal(x.host.head(), "c0");
	});
});

describe("unlink", () => {
	test("removes the link", async () => {
		const x = await setup({ "a.tex": "A" });
		await x.link();
		await x.svc.unlink(x.p.access());
		assert.equal(await x.svc.getLink(x.p.access()), null);
	});
});
