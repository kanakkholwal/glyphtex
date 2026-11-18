import { strict as assert } from "node:assert";
import { describe, test } from "node:test";

import { locate } from "./.build/review/anchor.mjs";

describe("locate", () => {
	test("keeps the offsets while the quote is still there", () => {
		assert.deepEqual(locate("hello world", { from: 6, to: 11, quote: "world" }), {
			from: 6,
			to: 11
		});
	});

	test("follows the quote when text before it changed", () => {
		assert.deepEqual(locate("oh hello world", { from: 6, to: 11, quote: "world" }), {
			from: 9,
			to: 14
		});
	});

	test("picks the closest of several matches", () => {
		const text = "ab ab ab";
		assert.deepEqual(locate(text, { from: 5, to: 7, quote: "ab" }), { from: 6, to: 8 });
	});

	test("returns null when the quoted text is gone", () => {
		assert.equal(locate("hello", { from: 0, to: 3, quote: "xyz" }), null);
	});

	test("a range without a quote just clamps to the document", () => {
		assert.deepEqual(locate("abc", { from: 1, to: 99, quote: null }), { from: 1, to: 3 });
		assert.equal(locate("abc", { from: 10, to: 12, quote: null }), null);
	});
});
