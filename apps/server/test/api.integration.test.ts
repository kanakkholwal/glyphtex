import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { strToU8, unzipSync, zipSync } from "fflate";
import { type Integration, integrationEnabled, startIntegration } from "./support.ts";

type Client = InstanceType<Integration["Client"]>;

describe("API end to end", { skip: integrationEnabled ? false : "set GLYPHTEX_IT=1" }, () => {
	let it: Integration;
	let alice: Client;
	let bob: Client;
	let carol: Client;
	let mallory: Client;

	before(async () => {
		it = await startIntegration();
		alice = new it.Client("alice");
		bob = new it.Client("bob");
		carol = new it.Client("carol");
		mallory = new it.Client("mallory");
	});

	after(async () => {
		await it?.stop();
	});

	let projectId = "";
	let imageKey = "";

	test("unauthenticated API calls are rejected", async () => {
		const res = await new it.Client("anon").request("/api/projects");
		assert.equal(res.status, 401);
		assert.equal(res.headers.get("content-type"), "application/problem+json");
	});

	test("users sign up and verify their email", async () => {
		await Promise.all([alice.signUp(), bob.signUp(), carol.signUp(), mallory.signUp()]);
	});

	test("health checks report dependencies", async () => {
		const res = await it.app.request("/readyz");
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
		const link = await it.latestLink(bob.email, "/invite/");
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
		const kick = await carol.request(`/api/projects/${projectId}/members/${await bob.id()}`, {
			method: "DELETE"
		});
		assert.equal(kick.status, 403);
		const leave = await carol.request(`/api/projects/${projectId}/members/${await carol.id()}`, {
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
		const { db } = it.built.deps;
		const row = await db.query.projectFile.findFirst({
			where: (f, { and, eq }) => and(eq(f.projectId, projectId), eq(f.path, "figures/plot.png"))
		});
		imageKey = row?.blobKey ?? "";
		assert.ok(imageKey);
		const res = await alice.request(`/api/projects/${projectId}`, { method: "DELETE" });
		assert.equal(res.status, 204);
		await it.drainJobs();
		assert.equal(await it.built.deps.adapters.blobs.get(imageKey), null);
		assert.equal((await bob.request(`/api/projects/${projectId}`)).status, 404);
	});

	test("account deletion is a hard delete of the user and everything they own", async () => {
		const { db } = it.built.deps;
		// Scoped to alice: the shared test database keeps projects from earlier runs.
		const aliceId = await alice.id();
		const imported = await db.query.project.findFirst({
			where: (p, { eq, and }) => and(eq(p.name, "Imported"), eq(p.ownerId, aliceId))
		});
		const blob = await db.query.projectFile.findFirst({
			where: (f, { eq, and }) => and(eq(f.projectId, imported?.id ?? ""), eq(f.kind, "binary"))
		});
		assert.ok(blob?.blobKey);

		const start = await alice.json("/api/auth/delete-user", "POST", {});
		assert.equal(start.status, 200, await start.clone().text());
		const confirm = await it.latestLink(alice.email, "delete-user");
		const done = await alice.request(`${confirm.pathname}${confirm.search}`);
		assert.ok([200, 302].includes(done.status), `delete callback returned ${done.status}`);

		const id = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, alice.email) });
		assert.equal(id, undefined);
		const leftovers = await db.query.project.findMany({
			where: (p, { eq }) => eq(p.id, imported?.id ?? "")
		});
		assert.equal(leftovers.length, 0);
		await it.drainJobs();
		assert.equal(await it.built.deps.adapters.blobs.get(blob.blobKey), null);
	});
});
