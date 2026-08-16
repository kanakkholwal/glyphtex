import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
	enclosingHeadings,
	latexCompletions,
	latexHoverAt,
	sectionHeadings,
	toSnippetTemplate
} from "./.build/editor.mjs";

const DOC = `\\documentclass{article}
\\usepackage{amsmath}
\\newcommand{\\myvec}[1]{\\mathbf{#1}}
\\begin{document}
\\section{Introduction}
\\label{sec:intro}
Prior work \\cite{knuth1984} is relevant.
\\begin{equation}
\\label{eq:main}
E = mc^2
\\end{equation}
`;

function completeAfter(fragment) {
	const text = DOC + fragment;
	return latexCompletions(text, text.length) ?? { from: text.length, options: [] };
}

const labelsOf = (result) => result.options.map((o) => o.label);

describe("LaTeX completion", () => {
	test("\\ref{ offers labels defined in the document", () => {
		const labels = labelsOf(completeAfter("See \\ref{"));
		assert.ok(labels.includes("sec:intro"), `expected sec:intro, got ${labels}`);
		assert.ok(labels.includes("eq:main"), `expected eq:main, got ${labels}`);
		assert.equal(labels.length, 2, "should offer only labels");
	});

	test("\\cite{ offers keys already cited", () => {
		assert.deepEqual(labelsOf(completeAfter("Also \\cite{")), ["knuth1984"]);
	});

	test("\\begin{ offers environments and closes them", () => {
		const itemize = completeAfter("\\begin{").options.find((i) => i.label === "itemize");
		assert.ok(itemize, "itemize should be offered");
		assert.match(itemize.insert, /^itemize\}/, "should close the opening brace");
		assert.match(itemize.insert, /\\end\{itemize\}$/, "should insert the matching \\end");
		assert.equal(itemize.isSnippet, true, "should insert as a snippet");
	});

	test("\\end{ offers only the bare name", () => {
		const itemize = completeAfter("\\end{").options.find((i) => i.label === "itemize");
		assert.equal(itemize.insert, "itemize");
		assert.equal(itemize.isSnippet, false);
	});

	test("a partial command offers commands, replacing from the backslash", () => {
		const result = completeAfter("\\fra");
		const frac = result.options.find((i) => i.label === "\\frac");
		assert.ok(frac, "frac should be offered");
		assert.equal(frac.insert, "\\frac{$1}{$2}$0");
		// The replaced range must cover "\fra" or the insert reads "\fra\frac".
		assert.equal(DOC.length + "\\fra".length - result.from, 4);
	});

	test("user-defined \\newcommand is offered", () => {
		assert.ok(labelsOf(completeAfter("\\myv")).includes("\\myvec"));
	});

	test("\\usepackage{ offers packages, \\documentclass{ offers classes", () => {
		assert.ok(labelsOf(completeAfter("\\usepackage{")).includes("graphicx"));
		assert.ok(labelsOf(completeAfter("\\documentclass{")).includes("beamer"));
		assert.ok(!labelsOf(completeAfter("\\documentclass{")).includes("graphicx"));
	});

	test("math context ranks math commands above text ones", () => {
		const inMath = completeAfter("$x = \\al").options.find((i) => i.label === "\\alpha");
		assert.ok(inMath, "alpha should be offered");
		assert.equal(inMath.boost, 1, "math command should rank first inside math");

		const inText = completeAfter("Plain text \\al").options.find((i) => i.label === "\\alpha");
		assert.equal(inText.boost, -1, "math command should rank lower outside math");
	});

	test("escaped dollar does not fool the math heuristic", () => {
		const alpha = completeAfter("Costs \\$5 and \\al").options.find((i) => i.label === "\\alpha");
		assert.equal(alpha.boost, -1, "\\$ is not a math delimiter");
	});

	test("plain prose offers nothing", () => {
		const text = `${DOC}just some words `;
		assert.equal(latexCompletions(text, text.length), null);
	});
});

describe("snippet templates", () => {
	test("numbered fields become CodeMirror placeholders", () => {
		assert.equal(toSnippetTemplate("\\frac{$1}{$2}$0"), "\\frac{${1}}{${2}}${3}");
	});

	test("$0 becomes the last field, not the first", () => {
		// TextMate treats $0 as "finish here"; CodeMirror orders fields numerically,
		// so a literal ${0} would jump the caret to the front of the snippet.
		const out = toSnippetTemplate("begin{$1}\n\t$0\n\\end{$1}");
		assert.equal(out, "begin{${1}}\n\t${2}\n\\end{${1}}");
	});

	test("defaults are left alone", () => {
		assert.equal(
			toSnippetTemplate("documentclass[${1:11pt}]{${2:article}}$0"),
			"documentclass[${1:11pt}]{${2:article}}${3}"
		);
	});
});

describe("LaTeX hover", () => {
	test("describes the command under the cursor", () => {
		const hover = latexHoverAt("We use \\frac{1}{2} here.", 10);
		assert.ok(hover, "should return a hover");
		assert.equal(hover.name, "frac");
	});

	test("returns nothing over plain words", () => {
		assert.equal(latexHoverAt("We use \\frac{1}{2} here.", 1), null);
	});
});

describe("section headings", () => {
	const NESTED = [
		"\\section{One}",
		"text",
		"\\subsection{One A}",
		"more text",
		"\\section{Two}",
		"tail"
	].join("\n");

	test("reads titles and strips markup", () => {
		const found = sectionHeadings("\\section{A \\textbf{bold} title}\\label{s}");
		assert.deepEqual(
			found.map((h) => h.title),
			["A bold title"]
		);
	});

	test("pins the enclosing path, outermost first", () => {
		const headings = sectionHeadings(NESTED);
		assert.deepEqual(
			enclosingHeadings(headings, 4).map((h) => h.title),
			["One", "One A"]
		);
	});

	test("pins nothing on the heading line itself", () => {
		const headings = sectionHeadings(NESTED);
		assert.deepEqual(enclosingHeadings(headings, 1), []);
	});

	test("a later section replaces the earlier one", () => {
		const headings = sectionHeadings(NESTED);
		assert.deepEqual(
			enclosingHeadings(headings, 6).map((h) => h.title),
			["Two"]
		);
	});
});
