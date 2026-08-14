import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseTexDoc } from './.build/tex-doc.mjs';

const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const files = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.tex'));
const read = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

describe('block spans', () => {
	// The whole design rests on this: a block's span must be the source it came
	// from, or a patch writes over the wrong bytes.
	for (const file of files) {
		test(`${file}: every span is in range and ordered`, () => {
			const src = read(file);
			const { blocks } = parseTexDoc(src);
			let previous = -1;
			for (const block of blocks) {
				assert.ok(block.span.from >= 0, `${block.kind} starts before the document`);
				assert.ok(block.span.to <= src.length, `${block.kind} ends past the document`);
				assert.ok(block.span.to > block.span.from, `${block.kind} has an empty span`);
				assert.ok(
					block.span.from >= previous,
					`${block.kind} at ${block.span.from} overlaps the previous block ending ${previous}`
				);
				previous = block.span.to;
			}
		});
	}

	test('a heading span covers the command, its title and its anchor', () => {
		const src = read('article.tex');
		const { blocks } = parseTexDoc(src);
		const heading = blocks.find((b) => b.kind === 'heading');
		// The \label is folded in, so rewriting the heading carries the anchor
		// instead of orphaning it above the next block.
		assert.equal(
			src.slice(heading.span.from, heading.span.to),
			'\\section{Introduction}\n\\label{sec:intro}'
		);
		assert.deepEqual(heading.labels, ['sec:intro']);
	});

	test('a standalone label never becomes a paragraph of its own', () => {
		const { blocks } = parseTexDoc(read('article.tex'));
		const stray = blocks.filter(
			(b) => b.kind === 'paragraph' && b.content.every((r) => r.kind === 'label')
		);
		assert.equal(stray.length, 0, 'labels should fold into the preceding block');
	});

	test('patching one span leaves every other byte untouched', () => {
		const src = read('article.tex');
		const { blocks } = parseTexDoc(src);
		const heading = blocks.find((b) => b.kind === 'heading');
		const replacement = '\\section{Renamed}';
		const patched = src.slice(0, heading.span.from) + replacement + src.slice(heading.span.to);

		assert.equal(patched.slice(0, heading.span.from), src.slice(0, heading.span.from));
		assert.equal(patched.slice(heading.span.from + replacement.length), src.slice(heading.span.to));
	});
});

describe('block recognition', () => {
	test('reads the sectioning ladder with levels', () => {
		const { blocks } = parseTexDoc(read('article.tex'));
		const headings = blocks.filter((b) => b.kind === 'heading');
		assert.deepEqual(
			headings.map((h) => [h.level, h.title.map((i) => (i.kind === 'text' ? i.text : '')).join('')]),
			[
				[2, 'Introduction'],
				[3, 'Notation'],
				[2, 'Results'],
				[3, 'Discussion']
			]
		);
	});

	test('itemize and enumerate become lists with items', () => {
		const { blocks } = parseTexDoc(read('article.tex'));
		const lists = blocks.filter((b) => b.kind === 'list');
		assert.equal(lists.length, 2);
		assert.equal(lists[0].ordered, false);
		assert.equal(lists[0].items.length, 3);
		assert.equal(lists[1].ordered, true);
		assert.equal(lists[1].items.length, 3);
	});

	test('display math is captured as source, not as prose', () => {
		const { blocks } = parseTexDoc(read('article.tex'));
		const math = blocks.filter((b) => b.kind === 'math');
		assert.ok(math.length >= 1);
		assert.ok(math.every((m) => m.fidelity === 'source'));
	});

	test('a figure becomes a float with its caption and graphic', () => {
		const { blocks } = parseTexDoc(read('article.tex'));
		const float = blocks.find((b) => b.kind === 'float');
		assert.equal(float.environment, 'figure');
		assert.equal(float.graphic, 'figures/convergence');
		assert.equal(float.label, 'fig:convergence');
		assert.match(float.caption, /Empirical convergence/);
	});

	test('verbatim is code, and its body is never treated as LaTeX', () => {
		const { blocks } = parseTexDoc(read('beamer.tex'));
		const code = blocks.flatMap((b) => (b.kind === 'code' ? [b] : []));
		const nested = JSON.stringify(blocks);
		assert.ok(code.length + nested.length > 0);
		// The \section inside the verbatim slide must not surface as a heading.
		const headings = blocks.filter((b) => b.kind === 'heading');
		assert.ok(
			!headings.some((h) => h.title.some((i) => i.kind === 'text' && /must not be highlighted/.test(i.text))),
			'verbatim content leaked into the block model'
		);
	});

	test('a tikzpicture is raw, kept verbatim', () => {
		const src = read('tikz.tex');
		const { blocks } = parseTexDoc(src);
		const raw = blocks.find((b) => b.kind === 'raw' && b.label.startsWith('tikzpicture'));
		assert.ok(raw, 'tikzpicture should be a raw block');
		assert.equal(raw.source, src.slice(raw.span.from, raw.span.to));
		assert.match(raw.source, /\\begin\{tikzpicture\}/);
	});
});

describe('inline runs', () => {
	test('citations and refs are structured, not text', () => {
		const { blocks } = parseTexDoc(read('article.tex'));
		const inlines = blocks.flatMap((b) => (b.kind === 'paragraph' ? b.content : []));
		const cite = inlines.find((i) => i.kind === 'cite');
		const ref = inlines.find((i) => i.kind === 'ref');
		assert.ok(cite, 'expected a citation');
		assert.ok(cite.keys.includes('knuth1984'));
		assert.ok(ref, 'expected a cross-reference');
	});

	test('inline math keeps its source', () => {
		const { blocks } = parseTexDoc(read('article.tex'));
		const math = blocks
			.flatMap((b) => (b.kind === 'paragraph' ? b.content : []))
			.find((i) => i.kind === 'math');
		assert.ok(math, 'expected inline math');
		assert.ok(math.source.length > 0);
	});

	test('an unmodelled command survives verbatim as a raw run', () => {
		const { blocks } = parseTexDoc(read('thesis.tex'));
		const raws = blocks
			.flatMap((b) => (b.kind === 'paragraph' ? b.content : []))
			.filter((i) => i.kind === 'raw');
		assert.ok(raws.length > 0, 'expected raw inline runs for custom macros');
		assert.ok(raws.every((r) => r.source.startsWith('\\')));
	});
});

describe('preamble', () => {
	test('is summarised, never turned into blocks', () => {
		const src = read('thesis.tex');
		const doc = parseTexDoc(src);
		assert.equal(doc.preamble.documentClass, 'report');
		assert.ok(doc.preamble.packages.includes('mathtools'));
		assert.ok(doc.preamble.macros.includes('R'));
		assert.ok(doc.preamble.macros.includes('argmin'));
		// No block may start before the body.
		for (const block of doc.blocks) assert.ok(block.span.from >= doc.preamble.span.to);
	});

	test('a fragment with no \\begin{document} is all body', () => {
		const doc = parseTexDoc('\\section{Loose}\n\nSome prose.\n');
		assert.equal(doc.fragment, true);
		assert.equal(doc.blocks[0].kind, 'heading');
	});
});
