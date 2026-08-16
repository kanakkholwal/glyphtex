import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { analyzeSemantics, setWorkspaceFiles, clearWorkspace } from "./.build/editor.mjs";

// Resolve each token back against the ORIGINAL source: the analyser blanks
// comments in a copy, so an offset bug looks fine raw but paints wrong characters.
function tokensOf(source) {
	return analyzeSemantics(source).map((token) => {
		const before = source.slice(0, token.offset);
		const line = before.split("\n").length;
		return {
			line,
			column: token.offset - (before.lastIndexOf("\n") + 1) + 1,
			length: token.length,
			type: token.kind,
			text: source.slice(token.offset, token.offset + token.length)
		};
	});
}

beforeEach(() => clearWorkspace());

describe("semantic tokens", () => {
	test("flags a command nothing defines", () => {
		const tokens = tokensOf("\\reff{x} and \\frac{1}{2}");
		const unknown = tokens.filter((t) => t.type === "unknownMacro");
		assert.deepEqual(
			unknown.map((t) => t.text),
			["\\reff"]
		);
	});

	test("marks a user-defined macro, and stops calling it unknown", () => {
		const tokens = tokensOf("\\newcommand{\\myvec}[1]{\\mathbf{#1}}\nUse \\myvec{x}.");
		const macros = tokens.filter((t) => t.type === "macro");
		assert.ok(macros.length >= 1, "the macro should be marked");
		assert.deepEqual([...new Set(macros.map((t) => t.text))], ["\\myvec"]);
		assert.equal(tokens.filter((t) => t.text === "\\myvec" && t.type === "unknownMacro").length, 0);
	});

	test("token text lines up with the source after a comment", () => {
		// Comments are blanked, not removed; removing them slides later offsets left.
		const tokens = tokensOf("% a long comment that would shift things\n\\reff{a}");
		const unknown = tokens.find((t) => t.type === "unknownMacro");
		assert.equal(unknown.text, "\\reff", "decoded text must match the real source");
		assert.equal(unknown.line, 2);
		assert.equal(unknown.column, 1);
	});

	test("offsets stay aligned across several comments", () => {
		const text = [
			"% first comment",
			"\\alpha",
			"% second, rather longer, comment",
			"\\badcmd",
			"% third",
			"\\alsobad"
		].join("\n");
		for (const token of tokensOf(text)) {
			// Starting with a backslash in the real source is the cheapest alignment proof.
			assert.ok(token.text.startsWith("\\"), `misaligned token: ${JSON.stringify(token)}`);
		}
	});

	test("ignores a command that only appears in a comment", () => {
		const tokens = tokensOf("% \\reff is mentioned here only\n\\frac{1}{2}");
		assert.equal(tokens.filter((t) => t.type === "unknownMacro").length, 0);
	});

	test("resolves a ref against a label in the document", () => {
		const tokens = tokensOf("\\label{sec:a}\nSee \\ref{sec:a} and \\ref{sec:missing}.");
		assert.deepEqual(
			tokens.filter((t) => t.type === "resolvedRef").map((t) => t.text),
			["sec:a"]
		);
		assert.deepEqual(
			tokens.filter((t) => t.type === "danglingRef").map((t) => t.text),
			["sec:missing"]
		);
	});

	test("resolves a ref against a label in another project file", () => {
		setWorkspaceFiles([{ path: "chapter2.tex", content: "\\label{sec:elsewhere}" }]);
		const tokens = tokensOf("See \\ref{sec:elsewhere}.");
		assert.deepEqual(
			tokens.filter((t) => t.type === "resolvedRef").map((t) => t.text),
			["sec:elsewhere"]
		);
	});

	test("says nothing about refs when no labels are known at all", () => {
		// Otherwise a fresh single file lights up every \ref in warning colour.
		const tokens = tokensOf("See \\ref{nothing:indexed}.");
		assert.equal(tokens.filter((t) => t.type === "danglingRef").length, 0);
	});

	test("judges each key in a multi-key cite separately", () => {
		setWorkspaceFiles([{ path: "refs.bib", content: "@book{good, title={G}}" }]);
		const tokens = tokensOf("\\cite{good,bad}");
		assert.deepEqual(
			tokens.filter((t) => t.type === "resolvedRef").map((t) => t.text),
			["good"]
		);
		assert.deepEqual(
			tokens.filter((t) => t.type === "danglingRef").map((t) => t.text),
			["bad"]
		);
	});

	test("emits strictly increasing offsets", () => {
		// CodeMirror's RangeSet.of throws on unsorted ranges, so order is not optional.
		const tokens = analyzeSemantics("\\badone\n\\label{a}\n\\ref{a} \\badtwo \\ref{missing}");
		for (let i = 1; i < tokens.length; i++) {
			assert.ok(
				tokens[i].offset >= tokens[i - 1].offset,
				`out of order at ${i}: ${JSON.stringify([tokens[i - 1], tokens[i]])}`
			);
		}
	});
});
