import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { planPull, planPush } from "../src/git/plan.ts";

describe("planPull", () => {
	const text = (sha: string) => ({ sha, isText: true });

	test("a file we don't have is written", () => {
		assert.equal(planPull({ remoteSha: "r" }), "write");
	});
	test("identical content needs nothing", () => {
		assert.equal(planPull({ remoteSha: "x", local: text("x"), baseSha: "old" }), "same");
	});
	test("only the remote changed: overwrite", () => {
		assert.equal(planPull({ remoteSha: "new", local: text("base"), baseSha: "base" }), "write");
	});
	test("only we changed: keep ours", () => {
		assert.equal(planPull({ remoteSha: "base", local: text("mine"), baseSha: "base" }), "skip");
	});
	test("both changed: conflict, never overwrite", () => {
		assert.equal(
			planPull({ remoteSha: "theirs", local: text("mine"), baseSha: "base" }),
			"conflict"
		);
	});
	test("no agreed base and the contents differ: conflict", () => {
		assert.equal(planPull({ remoteSha: "theirs", local: text("mine") }), "conflict");
	});
	test("a binary file with that name is left alone", () => {
		assert.equal(planPull({ remoteSha: "r", local: { sha: "b", isText: false } }), "skip");
	});
});

describe("planPush", () => {
	test("sends new and edited files and deletions of synced files", () => {
		const plan = planPush({
			local: [
				{ path: "same.tex", sha: "1" },
				{ path: "edited.tex", sha: "2b" },
				{ path: "new.tex", sha: "3" }
			],
			base: { "same.tex": "1", "edited.tex": "2a", "deleted.tex": "4", "gone-upstream.tex": "5" },
			remotePaths: new Set(["same.tex", "edited.tex", "deleted.tex"])
		});
		assert.deepEqual(plan.upserts, ["edited.tex", "new.tex"]);
		assert.deepEqual(plan.deletes, ["deleted.tex"]);
	});

	test("nothing changed sends nothing", () => {
		const plan = planPush({
			local: [{ path: "a.tex", sha: "1" }],
			base: { "a.tex": "1" },
			remotePaths: new Set(["a.tex"])
		});
		assert.deepEqual(plan, { upserts: [], deletes: [] });
	});
});
