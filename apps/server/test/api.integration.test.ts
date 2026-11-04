import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { strToU8, unzipSync, zipSync } from "fflate";
import { createApp } from "../src/app.ts";
import { buildNodeDeps } from "../src/entry/node-deps.ts";
import { waitReady } from "../src/adapters/redis/index.ts";
import { redisConsumer } from "../src/jobs/consumers.ts";

const enabled = process.env.GLYPHTEX_IT === "1";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8026";
const APP_URL = "http://localhost:5173";
const run = Date.now().toString(36);

describe("API end to end", { skip: enabled ? false : "set GLYPHTEX_IT=1" }, () => {
	let built: Awaited<ReturnType<typeof buildNodeDeps>>;
	let app: ReturnType<typeof createApp>;
	let consumer: ReturnType<typeof redisConsumer>;
	let blocking: ReturnType<typeof built.redis.duplicate>;

	before(async () => {
		built = await buildNodeDeps({
			PUBLIC_URL: "http://localhost:8787",
			APP_URL,
			BETTER_AUTH_SECRET: "integration-secret-integration-secret-0123",
			DATABASE_URL:
				process.env.DATABASE_URL ?? "postgres://glyphtex:glyphtex@localhost:5433/glyphtex",
			REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6380",
			BLOB_DRIVER: "s3",
			S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:9002",
			S3_REGION: "us-east-1",
			S3_BUCKET: "glyphtex",
			S3_ACCESS_KEY_ID: "glyphtex",
			S3_SECRET_ACCESS_KEY: "glyphtex-secret",
			MAIL_DRIVER: "smtp",
			SMTP_URL: process.env.SMTP_URL ?? "smtp://localhost:1025",
			API_RATE_LIMIT: "10000"
		});
		await migrate(built.deps.db, {
			migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url))
		});
		app = createApp(() => ({ deps: built.deps }));
		blocking = built.redis.duplicate();
		await waitReady(blocking);
		consumer = redisConsumer(built.redis, blocking, {
			db: built.deps.db,
			blobs: built.deps.adapters.blobs,
			mailer: built.deps.adapters.mailer,
			logger: built.deps.logger
		});
	});

	after(async () => {
		blocking?.disconnect();
		await built?.close();
	});

	/** Runs every queued job, including delayed ones, as the worker eventually would. */
	async function drainJobs() {
		await consumer.promoteDue(Number.POSITIVE_INFINITY);
		while (await consumer.processOne(1)) {}
	}

	async function latestLink(to: string, pathPart: string) {
		await drainJobs();
		const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
		const { messages } = (await search.json()) as { messages: { ID: string }[] };
		for (const m of messages) {
			const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as {
				Text: string;
			};
			const url = msg.Text.match(/https?:\/\/\S+/g)?.find((u) => u.includes(pathPart));
			if (url) return new URL(url);
		}
		throw new Error(`no email to ${to} containing ${pathPart}`);
	}

	let clients = 0;
	class Client {
		cookies = new Map<string, string>();
		email: string;
		// Distinct client IPs, so Better Auth's per-IP auth limits apply per test user.
		ip = `10.0.0.${++clients}`;
		constructor(name: string) {
			this.email = `${name}-${run}@example.test`;
		}
		async request(path: string, init: RequestInit = {}) {
			const headers = new Headers(init.headers);
			headers.set("origin", APP_URL);
			headers.set("x-forwarded-for", this.ip);
			if (this.cookies.size) {
				headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
			}
			const res = await app.request(path, { ...init, headers });
			for (const c of res.headers.getSetCookie()) {
				const [pair] = c.split(";");
				const [k, ...v] = (pair ?? "").split("=");
				if (k) this.cookies.set(k.trim(), v.join("="));
			}
			return res;
		}
		json(path: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
			return this.request(path, {
				method,
				headers: { "content-type": "application/json", ...headers },
				body: body === undefined ? undefined : JSON.stringify(body)
			});
		}
		async signUp() {
			const res = await this.json("/api/auth/sign-up/email", "POST", {
				email: this.email,
				password: "correct horse battery",
				name: this.email.split("@")[0]
			});
			assert.equal(res.status, 200, await res.clone().text());
			const verify = await latestLink(this.email, "verify-email");
			const done = await this.request(`${verify.pathname}${verify.search}`);
			assert.ok([200, 302].includes(done.status), `verify returned ${done.status}`);
			const me = await this.request("/api/me");
			assert.equal(me.status, 200, "auto sign-in after verification");
			return this;
		}
	}

	const alice = new Client("alice");
	const bob = new Client("bob");
	const carol = new Client("carol");
	const mallory = new Client("mallory");
	let projectId = "";
	let imageKey = "";

	test("unauthenticated API calls are rejected", async () => {
		const res = await new Client("anon").request("/api/projects");
		assert.equal(res.status, 401);
		assert.equal(res.headers.get("content-type"), "application/problem+json");
	});

	test("users sign up and verify their email", async () => {
		await Promise.all([alice.signUp(), bob.signUp(), carol.signUp(), mallory.signUp()]);
	});

	test("health checks report dependencies", async () => {
		const res = await app.request("/readyz");
		assert.equal(res.status, 200);
	});

	test("owner creates a project and writes files with preconditions", async () => {
		const created = await alice.json("/api/projects", "POST", { name: "Thesis" });
		assert.equal(created.status, 201);
		projectId = ((await created.json()) as { project: { id: string } }).project.id;

		const base = `/api/projects/${projectId}/files/raw?path=`;
		const noPrecondition = await alice.request(`${base}main.tex`, { method: "PUT", body: "x" });
		assert.equal(noPrecondition.status, 428);

		const tex = await alice.request(`${base}main.tex`, {
			method: "PUT",
			headers: { "if-none-match": "*" },
			body: "\\documentclass{article}\\begin{document}Hi\\end{document}"
		});
		assert.equal(tex.status, 201);
		assert.equal(tex.headers.get("etag"), '"1"');

		const dup = await alice.request(`${base}main.tex`, {
			method: "PUT",
			headers: { "if-none-match": "*" },
			body: "again"
		});
		assert.equal(dup.status, 409);

		const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
		const img = await alice.request(`${base}${encodeURIComponent("figures/plot.png")}`, {
			method: "PUT",
			headers: { "if-none-match": "*", "content-type": "image/png" },
			body: png
		});
		assert.equal(img.status, 201);
		const raw = await alice.request(`${base}${encodeURIComponent("figures/plot.png")}`);
		assert.deepEqual(new Uint8Array(await raw.arrayBuffer()), png);
		assert.equal(raw.headers.get("content-type"), "image/png");

		const traversal = await alice.request(`${base}${encodeURIComponent("../etc/passwd")}`, {
			method: "PUT",
			headers: { "if-none-match": "*" },
			body: "x"
		});
		assert.equal(traversal.status, 400);
	});

	test("stale writes conflict instead of overwriting", async () => {
		const base = `/api/projects/${projectId}/files/raw?path=main.tex`;
		const v2 = await alice.request(base, {
			method: "PUT",
			headers: { "if-match": '"1"' },
			body: "\\documentclass{article}\\begin{document}v2\\end{document}"
		});
		assert.equal(v2.status, 200);
		const stale = await alice.request(base, {
			method: "PUT",
			headers: { "if-match": '"1"' },
			body: "lost update"
		});
		assert.equal(stale.status, 409);
		assert.equal(((await stale.json()) as { currentVersion: number }).currentVersion, 2);
		const cached = await alice.request(base, { headers: { "if-none-match": '"2"' } });
		assert.equal(cached.status, 304);
	});

	test("strangers can't tell the project exists", async () => {
		const res = await mallory.request(`/api/projects/${projectId}`);
		assert.equal(res.status, 404);
		const write = await mallory.request(`/api/projects/${projectId}/files/raw?path=x.tex`, {
			method: "PUT",
			headers: { "if-none-match": "*" },
			body: "x"
		});
		assert.equal(write.status, 404);
	});

	test("email invites are bound to the invited address", async () => {
		const invite = await alice.json(`/api/projects/${projectId}/invites`, "POST", {
			email: bob.email,
			role: "editor"
		});
		assert.equal(invite.status, 201);
		const link = await latestLink(bob.email, "/invite/");
		const token = decodeURIComponent(link.pathname.split("/").pop() ?? "");

		const wrongUser = await mallory.json("/api/invites/accept", "POST", { token });
		assert.equal(wrongUser.status, 403);
		const accepted = await bob.json("/api/invites/accept", "POST", { token });
		assert.equal(accepted.status, 200);
		const reuse = await bob.json("/api/invites/accept", "POST", { token });
		assert.equal(reuse.status, 404, "invite tokens are single use");

		const view = await bob.request(`/api/projects/${projectId}`);
		const body = (await view.json()) as { project: { role: string; capabilities: string[] } };
		assert.equal(body.project.role, "editor");
		assert.ok(body.project.capabilities.includes("project:write"));
		assert.ok(!body.project.capabilities.includes("project:share"));
	});

	test("editors write but can't share or delete", async () => {
		const write = await bob.request(`/api/projects/${projectId}/files/raw?path=refs.bib`, {
			method: "PUT",
			headers: { "if-none-match": "*" },
			body: "@article{a, title={A}}"
		});
		assert.equal(write.status, 201);
		const share = await bob.json(`/api/projects/${projectId}/links`, "POST", { role: "viewer" });
		assert.equal(share.status, 403);
		const del = await bob.request(`/api/projects/${projectId}`, { method: "DELETE" });
		assert.equal(del.status, 403);
	});

	test("share links grant their role and never downgrade", async () => {
		const res = await alice.json(`/api/projects/${projectId}/links`, "POST", { role: "viewer" });
		assert.equal(res.status, 201);
		const { link } = (await res.json()) as {
			link: { id: string; url: string; tokenHash?: string };
		};
		assert.equal(link.tokenHash, undefined, "token hash never leaves the server");
		const token = decodeURIComponent(link.url.split("/").pop() ?? "");

		const joined = await carol.json("/api/links/redeem", "POST", { token });
		assert.deepEqual(await joined.json(), { projectId, role: "viewer" });
		const write = await carol.request(`/api/projects/${projectId}/files/raw?path=x.tex`, {
			method: "PUT",
			headers: { "if-none-match": "*" },
			body: "x"
		});
		assert.equal(write.status, 403);

		const bobRedeems = await bob.json("/api/links/redeem", "POST", { token });
		assert.equal(((await bobRedeems.json()) as { role: string }).role, "editor");

		const revoke = await alice.request(`/api/projects/${projectId}/links/${link.id}`, {
			method: "DELETE"
		});
		assert.equal(revoke.status, 204);
		const afterRevoke = await mallory.json("/api/links/redeem", "POST", { token });
		assert.equal(afterRevoke.status, 404);
	});

	test("members can leave; viewers can't remove others", async () => {
		const kick = await carol.request(`/api/projects/${projectId}/members/${await userId(bob)}`, {
			method: "DELETE"
		});
		assert.equal(kick.status, 403);
		const leave = await carol.request(`/api/projects/${projectId}/members/${await userId(carol)}`, {
			method: "DELETE"
		});
		assert.equal(leave.status, 204);
		assert.equal((await carol.request(`/api/projects/${projectId}`)).status, 404);
	});

	test("rename keeps content and bumps the version", async () => {
		const res = await alice.json(
			`/api/projects/${projectId}/files/rename`,
			"POST",
			{ from: "refs.bib", to: "bib/refs.bib" },
			{ "if-match": '"1"' }
		);
		assert.equal(res.status, 200);
		const list = await alice.request(`/api/projects/${projectId}/files`);
		const { files } = (await list.json()) as { files: { path: string }[] };
		assert.deepEqual(
			files.map((f) => f.path),
			["bib/refs.bib", "figures/plot.png", "main.tex"]
		);
	});

	test("zip import detects the main file and strips the wrapper folder", async () => {
		const zip = zipSync({
			"paper/paper.tex": strToU8("\\documentclass{article}\\begin{document}x\\end{document}"),
			"paper/sec/intro.tex": strToU8("\\section{Intro}"),
			"paper/img/a.png": new Uint8Array([1, 2, 3]),
			"__MACOSX/paper/._paper.tex": strToU8("junk")
		});
		const res = await alice.request("/api/projects/import?name=Imported", {
			method: "POST",
			headers: { "content-type": "application/zip" },
			body: zip
		});
		assert.equal(res.status, 201, await res.clone().text());
		const body = (await res.json()) as { project: { mainFile: string }; files: number };
		assert.equal(body.project.mainFile, "paper.tex");
		assert.equal(body.files, 3);
	});

	test("export streams every owned project as a zip", async () => {
		const res = await alice.request("/api/me/export");
		assert.equal(res.status, 200);
		const entries = unzipSync(new Uint8Array(await res.arrayBuffer()));
		assert.ok(entries["Thesis/main.tex"]);
		assert.deepEqual(
			entries["Thesis/figures/plot.png"]?.slice(0, 4),
			new Uint8Array([137, 80, 78, 71])
		);
		assert.ok(entries["Imported/paper.tex"]);
	});

	test("deleting a project removes rows and purges blobs", async () => {
		const { db } = built.deps;
		const row = await db.query.projectFile.findFirst({
			where: (f, { and, eq }) => and(eq(f.projectId, projectId), eq(f.path, "figures/plot.png"))
		});
		imageKey = row?.blobKey ?? "";
		assert.ok(imageKey);
		const res = await alice.request(`/api/projects/${projectId}`, { method: "DELETE" });
		assert.equal(res.status, 204);
		await drainJobs();
		assert.equal(await built.deps.adapters.blobs.get(imageKey), null);
		assert.equal((await bob.request(`/api/projects/${projectId}`)).status, 404);
	});

	test("account deletion is a hard delete of the user and everything they own", async () => {
		const { db } = built.deps;
		const imported = await db.query.project.findFirst({
			where: (p, { eq, and }) => and(eq(p.name, "Imported"))
		});
		const blob = await db.query.projectFile.findFirst({
			where: (f, { eq, and }) => and(eq(f.projectId, imported?.id ?? ""), eq(f.kind, "binary"))
		});
		assert.ok(blob?.blobKey);

		const start = await alice.json("/api/auth/delete-user", "POST", {});
		assert.equal(start.status, 200, await start.clone().text());
		const confirm = await latestLink(alice.email, "delete-user");
		const done = await alice.request(`${confirm.pathname}${confirm.search}`);
		assert.ok([200, 302].includes(done.status), `delete callback returned ${done.status}`);

		const id = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, alice.email) });
		assert.equal(id, undefined);
		const leftovers = await db.query.project.findMany({
			where: (p, { eq }) => eq(p.id, imported?.id ?? "")
		});
		assert.equal(leftovers.length, 0);
		await drainJobs();
		assert.equal(await built.deps.adapters.blobs.get(blob.blobKey), null);
	});

	async function userId(client: Client) {
		const res = await client.request("/api/me");
		return ((await res.json()) as { user: { id: string } }).user.id;
	}
});
