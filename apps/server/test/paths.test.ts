import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../src/lib/errors.ts";
import { isTextPath, normalizePath } from "../src/lib/paths.ts";
import { detectMainFile } from "../src/services/archive.ts";

test("accepts ordinary project paths", () => {
	assert.equal(normalizePath("main.tex"), "main.tex");
	assert.equal(normalizePath("chapters/intro.tex"), "chapters/intro.tex");
	assert.equal(normalizePath("figures/plot 1.png"), "figures/plot 1.png");
});

test("rejects traversal, absolute and malformed paths", () => {
	for (const bad of [
		"",
		"/etc/passwd",
		"../secret",
		"a/../../b",
		"a//b",
		"./a",
		"a\\b",
		"C:/x",
		"a/\u0000b",
		" a",
		"x".repeat(513)
	]) {
		assert.throws(() => normalizePath(bad), AppError, JSON.stringify(bad));
	}
});

test("NFC-normalises so the same name can't exist twice", () => {
	assert.equal(normalizePath("cafe\u0301.tex"), "caf\u00e9.tex");
});

test("classifies text vs binary by extension", () => {
	assert.equal(isTextPath("main.tex"), true);
	assert.equal(isTextPath("refs.BIB"), true);
	assert.equal(isTextPath(".latexmkrc"), true);
	assert.equal(isTextPath("fig.png"), false);
	assert.equal(isTextPath("paper.pdf"), false);
});

test("detects the main file", () => {
	assert.equal(detectMainFile([{ path: "main.tex", content: "" }]), "main.tex");
	assert.equal(
		detectMainFile([
			{ path: "sections/a.tex", content: "\\section{A}" },
			{ path: "paper.tex", content: "\\documentclass{article}" }
		]),
		"paper.tex"
	);
});
