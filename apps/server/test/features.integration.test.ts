import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { type Integration, integrationEnabled, startIntegration } from "./support.ts";

type Client = InstanceType<Integration["Client"]>;

describe("a server with file storage and mail switched off", {
	skip: integrationEnabled ? false : "set GLYPHTEX_IT=1"
}, () => {
	let it: Integration;
	let user: Client;
	let projectId = "";

	before(async () => {
		it = await startIntegration({ BLOB_DRIVER: "none", MAIL_DRIVER: "none" });
		user = new it.Client("no-features");
	});

	after(async () => {
		await it?.stop();
	});

	test("the public config says what is off, and sign-up works without a verification email", async () => {
		const config = await user.request("/api/public/config");
		const body = (await config.json()) as { magicLink: boolean; features: object };
		assert.equal(body.magicLink, false);
		assert.deepEqual(body.features, { mail: false, blobs: false });

		const res = await user.json("/api/auth/sign-up/email", "POST", {
			email: user.email,
			password: "correct horse battery",
			name: "No Features"
		});
		assert.equal(res.status, 200, await res.clone().text());
		assert.equal((await user.request("/api/me")).status, 200, "signed in straight away");
	});

	test("text files save normally and binary files are refused with a clear code", async () => {
		const created = await user.json("/api/projects", "POST", { name: "Features text only" });
		assert.equal(created.status, 201);
		projectId = ((await created.json()) as { project: { id: string } }).project.id;

		const put = (path: string, body: BodyInit) =>
			user.request(`/api/projects/${projectId}/files/raw?path=${encodeURIComponent(path)}`, {
				method: "PUT",
				headers: { "if-none-match": "*" },
				body
			});
		assert.equal((await put("main.tex", "\\documentclass{article}")).status, 201);

		const image = await put("figure.png", new Blob([new Uint8Array([137, 80, 78, 71])]));
		assert.equal(image.status, 501);
		assert.equal(((await image.json()) as { code: string }).code, "storage_disabled");
	});

	test("a zip import keeps the text and reports the images it skipped", async () => {
		const zip = zipSync({
			"main.tex": strToU8("\\documentclass{article}"),
			"figures/plot.png": new Uint8Array([137, 80, 78, 71, 0, 1, 2])
		});
		const res = await user.request("/api/projects/import?name=Features%20import", {
			method: "POST",
			headers: { "content-type": "application/zip" },
			body: new Blob([zip as BlobPart])
		});
		assert.equal(res.status, 201, await res.clone().text());
		const body = (await res.json()) as { files: number; skipped: string[] };
		assert.equal(body.files, 1);
		assert.deepEqual(body.skipped, ["figures/plot.png"]);
	});
});
