import { strict as assert } from "node:assert";
import { describe, test } from "node:test";

import { parseOpenParams, safeRemoteUrl } from "./.build/open/request.mjs";
import { activeLink } from "./.build/storage/projects.mjs";

const parse = (params) => parseOpenParams((k) => params[k] ?? null);

describe("parseOpenParams", () => {
	test("accepts a snippet with defaults", () => {
		const r = parse({ snip: "documentclass{article}" });
		assert.equal(r.ok, true);
		assert.equal(r.request.main, "main.tex");
		assert.equal(r.request.name, "Imported");
	});

	test("needs exactly one source", () => {
		assert.equal(parse({}).ok, false);
		assert.equal(parse({ snip: "a", encoded_snip: "b" }).ok, false);
	});

	test("decodes encoded_snip and rejects bad encoding", () => {
		assert.equal(parse({ encoded_snip: "%5Cfoo" }).request.source.text, String.raw`\foo`);
		assert.equal(parse({ encoded_snip: "%E0%A4%A" }).ok, false);
	});

	test("rejects path traversal and non-tex entry files", () => {
		assert.equal(parse({ snip: "a", main_document: "../x.tex" }).ok, false);
		assert.equal(parse({ snip: "a", main_document: "/etc/passwd.tex" }).ok, false);
		assert.equal(parse({ snip: "a", main_document: "main.sh" }).ok, false);
		assert.equal(parse({ snip: "a", main_document: "ch/one.tex" }).ok, true);
	});

	test("rejects oversize and binary snippets", () => {
		assert.equal(parse({ snip: "x".repeat(512 * 1024 + 1) }).ok, false);
		assert.equal(parse({ snip: "a\u0000b" }).ok, false);
	});

	test("rejects unknown engines", () => {
		assert.equal(parse({ snip: "a", engine: "evil" }).ok, false);
		assert.equal(parse({ snip: "a", engine: "XeLaTeX" }).request.engine, "xelatex");
	});
});

describe("safeRemoteUrl", () => {
	test("allows public https only", () => {
		assert.ok(safeRemoteUrl("https://example.org/a.tex"));
		for (const bad of [
			"http://example.org/a.tex",
			"https://user:pw@example.org/a.tex",
			"https://localhost/a.tex",
			"https://127.0.0.1/a.tex",
			"https://[::1]/a.tex",
			"https://intranet/a.tex",
			"https://printer.local/a.tex",
			"file:///etc/passwd",
			"javascript:alert(1)"
		]) {
			assert.equal(safeRemoteUrl(bad), null, bad);
		}
	});
});

describe("activeLink", () => {
	const project = (remote) => ({ id: "p", remote });
	test("is the link only for the account that made it", () => {
		const link = { id: "r", userId: "u1", role: "owner" };
		assert.equal(activeLink(project(link), "u1"), link);
		assert.equal(activeLink(project(link), "u2"), undefined);
		assert.equal(activeLink(project(link), null), undefined);
	});
	test("legacy links without an account belong to whoever is signed in", () => {
		const link = { id: "r", role: "owner" };
		assert.equal(activeLink(project(link), "u2"), link);
		assert.equal(activeLink(project(link), null), undefined);
	});
	test("a plain browser document has no link", () => {
		assert.equal(activeLink(project(undefined), "u1"), undefined);
	});
});
