import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
	applyPatch,
	deleteBlock,
	escapeText,
	insertAfter,
	mergeIntoPrevious,
	parseTexDoc,
	printBlock,
	printInlines,
	setInlines,
	setListItem
} from "./.build/tex-doc.mjs";

const FIXTURES = path.join(import.meta.dirname, "fixtures");
const files = fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".tex"));
const read = (name) => fs.readFileSync(path.join(FIXTURES, name), "utf8");

const NATIVE = new Set(["heading", "paragraph", "list", "quote"]);

describe("printing is idempotent", () => {
	// The guarantee visual mode rests on: writing a block back and re-reading it
	// must produce the same block, or a round trip through the two modes drifts.
	for (const file of files) {
		test(`${file}: reprinting a block reparses to the same block`, () => {
			const src = read(file);
			const { blocks } = parseTexDoc(src);
			for (const block of blocks.filter((b) => NATIVE.has(b.kind))) {
				const printed = printBlock(block, src);
				const reparsed = parseTexDoc(printed).blocks;
				assert.equal(reparsed.length, 1, `${block.kind} reparsed into ${reparsed.length} blocks`);
				assert.equal(
					printBlock(reparsed[0], printed),
					printed,
					`${block.kind} is not stable under a second print`
				);
			}
		});

		test(`${file}: rewriting every block leaves the document parsing the same`, () => {
			const src = read(file);
			const before = parseTexDoc(src);

			// Patch back-to-front so earlier spans stay valid.
			let out = src;
			for (const block of [...before.blocks].reverse()) {
				out = applyPatch(out, {
					...block.span,
					insert: printBlock(block, src)
				});
			}

			const after = parseTexDoc(out);
			assert.equal(after.blocks.length, before.blocks.length);
			assert.deepEqual(
				after.blocks.map((b) => b.kind),
				before.blocks.map((b) => b.kind)
			);
		});
	}

	test("escaped punctuation survives the round trip", () => {
		const src = "\\begin{document}\n100\\% of \\$5 \\& more \\#1 a\\_b\n\\end{document}\n";
		const { blocks } = parseTexDoc(src);
		const printed = printBlock(blocks[0], src);
		assert.equal(printed, "100\\% of \\$5 \\& more \\#1 a\\_b");
		assert.equal(printBlock(parseTexDoc(printed).blocks[0], printed), printed);
	});

	test("escapeText never produces a macro by accident", () => {
		assert.equal(escapeText("50% off"), "50\\% off");
		assert.equal(escapeText("a\\b"), "a\\textbackslash{}b");
		assert.equal(escapeText("{x}"), "\\{x\\}");
	});

	test("a mark keeps the command it was written with", () => {
		const src = "\\begin{document}\n\\textsc{Small} and \\textbf{bold}\n\\end{document}\n";
		const { blocks } = parseTexDoc(src);
		assert.equal(printBlock(blocks[0], src), "\\textsc{Small} and \\textbf{bold}");
	});

	test("every mark the toolbars offer survives a round trip", () => {
		const marks =
			"\\textbf{a} \\textit{b} \\emph{c} \\texttt{d} \\textsc{e} \\underline{f} " +
			"\\sout{g} \\textsf{h} \\textsuperscript{i} \\textsubscript{j}";
		const src = `\\begin{document}\n${marks}\n\\end{document}\n`;
		const { blocks } = parseTexDoc(src);
		assert.equal(printBlock(blocks[0], src), marks);
		// Each one is a distinct mark, not everything collapsed onto \emph.
		const kinds = blocks[0].content.filter((r) => r.kind === "mark").map((r) => r.mark);
		assert.equal(new Set(kinds).size, 10);
	});

	test("links and footnotes round trip byte for byte", () => {
		const body =
			"See \\href{https://ex.com/a_b~c}{the site}, \\url{https://ex.com}" +
			"\\footnote{With \\textbf{markup} inside.}";
		const src = `\\begin{document}\n${body}\n\\end{document}\n`;
		const { blocks } = parseTexDoc(src);
		assert.equal(printBlock(blocks[0], src), body);
	});

	test("a citation keeps its variant", () => {
		const src = "\\begin{document}\nAs shown \\citep{a, b}.\n\\end{document}\n";
		const { blocks } = parseTexDoc(src);
		assert.equal(printBlock(blocks[0], src), "As shown \\citep{a, b}.");
	});

	test("a description list keeps its terms out of the item prose", () => {
		const src =
			"\\begin{document}\n\\begin{description}\n  \\item[Alpha] the first one\n  \\item[Beta] the second\n\\end{description}\n\\end{document}\n";
		const { blocks } = parseTexDoc(src);
		assert.deepEqual(
			blocks[0].items.map((i) => [i.term, printInlines(i.content)]),
			[
				["Alpha", "the first one"],
				["Beta", "the second"]
			]
		);
		const printed = printBlock(blocks[0], src);
		assert.equal(printed, src.slice(blocks[0].span.from, blocks[0].span.to));
	});

	test("a starred section stays starred", () => {
		const src = "\\begin{document}\n\\section*{Unnumbered}\n\\end{document}\n";
		const { blocks } = parseTexDoc(src);
		assert.equal(blocks[0].kind, "heading");
		assert.equal(blocks[0].starred, true);
		assert.equal(printBlock(blocks[0], src), "\\section*{Unnumbered}");
	});

	test("a block we do not model is returned as its exact bytes", () => {
		const src = read("tikz.tex");
		const { blocks } = parseTexDoc(src);
		for (const block of blocks.filter((b) => b.fidelity !== "native")) {
			assert.equal(printBlock(block, src), src.slice(block.span.from, block.span.to));
		}
	});
});

describe("editing one block touches nothing else", () => {
	test("renaming a heading leaves every other byte identical", () => {
		const src = read("article.tex");
		const { blocks } = parseTexDoc(src);
		const heading = blocks.find((b) => b.kind === "heading");
		const patch = setInlines(src, heading, [{ kind: "text", text: "Overview" }]);
		const out = applyPatch(src, patch);

		assert.equal(out.slice(0, patch.from), src.slice(0, patch.from));
		assert.equal(out.slice(patch.from + patch.insert.length), src.slice(patch.to));
		// The folded \label rides along instead of being orphaned.
		assert.match(patch.insert, /^\\section\{Overview\}\n\\label\{sec:intro\}$/);
	});

	test("a TikZ picture is byte-identical after editing the paragraph next to it", () => {
		// Hand-built rather than a fixture: the point is the exact bytes of the
		// picture, including the spacing nobody would want reformatted.
		const picture =
			"\\begin{tikzpicture}[scale=1.4]\n  \\draw[->]   (0,0) -- (2,0)   node[right] {$x$};\n\\end{tikzpicture}";
		const src = `\\begin{document}\nBefore.\n\n${picture}\n\nAfter.\n\\end{document}\n`;
		const doc = parseTexDoc(src);
		const paragraph = doc.blocks.find((b) => b.kind === "paragraph");

		const out = applyPatch(src, setInlines(src, paragraph, [{ kind: "text", text: "Edited." }]));
		assert.ok(out.includes(picture), "the tikzpicture was rewritten");
		assert.ok(out.includes("Edited.") && !out.includes("Before."));
	});

	test("editing a list item rewrites only that item", () => {
		const src = read("article.tex");
		const { blocks } = parseTexDoc(src);
		const list = blocks.find((b) => b.kind === "list");
		const out = applyPatch(src, setListItem(src, list, 1, [{ kind: "text", text: "Replaced" }]));
		const rewritten = parseTexDoc(out).blocks.find((b) => b.kind === "list");

		assert.equal(rewritten.items.length, list.items.length);
		assert.equal(rewritten.items[1].content[0].text, "Replaced");
		assert.equal(printInlines(rewritten.items[0].content), printInlines(list.items[0].content));
	});
});

describe("structural edits", () => {
	const DOC = "\\begin{document}\nFirst para.\n\nSecond para.\n\nThird para.\n\\end{document}\n";

	test("deleting a block takes its blank line with it", () => {
		const { blocks } = parseTexDoc(DOC);
		const out = applyPatch(DOC, deleteBlock(DOC, blocks[1]));
		assert.equal(out, "\\begin{document}\nFirst para.\n\nThird para.\n\\end{document}\n");
	});

	test("deleting the last block does not leave a trailing gap", () => {
		const { blocks } = parseTexDoc(DOC);
		const out = applyPatch(DOC, deleteBlock(DOC, blocks[2]));
		assert.equal(parseTexDoc(out).blocks.length, 2);
		assert.ok(!/\n{3,}/.test(out), `left a widening gap: ${JSON.stringify(out)}`);
	});

	test("merging a paragraph into the one above joins their text", () => {
		const { blocks } = parseTexDoc(DOC);
		const patch = mergeIntoPrevious(DOC, blocks[0], blocks[1]);
		const merged = parseTexDoc(applyPatch(DOC, patch));
		assert.equal(merged.blocks.length, 2);
		assert.equal(printInlines(merged.blocks[0].content), "First para.Second para.");
	});

	test("merging into a figure is refused rather than mangling it", () => {
		const src = read("article.tex");
		const doc = parseTexDoc(src);
		const float = doc.blocks.findIndex((b) => b.kind === "float");
		const next = doc.blocks[float + 1];
		assert.ok(next, "fixture needs a block after the figure");
		assert.equal(mergeIntoPrevious(src, doc.blocks[float], next), null);
	});

	test("inserting after a block opens a new paragraph", () => {
		const { blocks } = parseTexDoc(DOC);
		const out = applyPatch(DOC, insertAfter(blocks[0], "Inserted."));
		const kinds = parseTexDoc(out).blocks;
		assert.equal(kinds.length, 4);
		assert.equal(printInlines(kinds[1].content), "Inserted.");
	});
});
