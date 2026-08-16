import { strict as assert } from "node:assert";
import { test, describe } from "node:test";

import {
	PILL_PADDING_EM,
	nextIndex,
	pillWidth,
	splitLetters
} from "./.build/landing/text-flip.mjs";

const NBSP = " ";

describe("splitLetters", () => {
	test("one entry per character", () => {
		assert.deepEqual(splitLetters("paper."), ["p", "a", "p", "e", "r", "."]);
	});

	// Each letter renders as its own inline-block, and a plain space collapses at
	// that boundary, so "lecture notes" would come out as "lecturenotes".
	test("spaces survive as non-breaking spaces", () => {
		assert.deepEqual(splitLetters("a b"), ["a", NBSP, "b"]);
		assert.equal(splitLetters("lecture notes").join(""), `lecture${NBSP}notes`);
	});

	test("astral characters stay whole", () => {
		assert.deepEqual(splitLetters("a👍"), ["a", "👍"]);
	});

	test("empty word yields no letters", () => {
		assert.deepEqual(splitLetters(""), []);
	});
});

describe("nextIndex", () => {
	test("advances and wraps", () => {
		assert.equal(nextIndex(0, 4), 1);
		assert.equal(nextIndex(3, 4), 0);
	});

	test("a single word never moves", () => {
		assert.equal(nextIndex(0, 1), 0);
	});

	// Guards the modulo: `n % 0` is NaN, which would set the width to `auto`.
	test("an empty list stays at zero", () => {
		assert.equal(nextIndex(0, 0), 0);
	});
});

describe("pillWidth", () => {
	// The pill is border-box with `px-[0.14em]`, so a width of exactly the
	// measured text would clip it by the padding on both sides.
	test("adds the padding back to the measured text", () => {
		assert.equal(pillWidth(120), `calc(120px + ${PILL_PADDING_EM}em)`);
	});

	test("falls back to auto before the first measurement", () => {
		assert.equal(pillWidth(0), "auto");
	});
});
