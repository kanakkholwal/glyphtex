import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
	applyPatch,
	BLOCK_TEMPLATES,
	CARET,
	INLINE_TEMPLATES,
	floatWidth,
	parseTexDoc,
	setFloatCaption,
	setFloatGraphic,
	setFloatWidth,
	templateSource
} from './.build/tex-doc.mjs';

const body = (text) => `\\begin{document}\n${text}\n\\end{document}\n`;

const FIGURE_TEMPLATE = [
	'\\begin{figure}[h]',
	'  \\centering',
	'  \\includegraphics[width=0.6\\linewidth]{example-image}',
	'  \\caption{Caption text.}',
	'  \\label{fig:placeholder}',
	'\\end{figure}'
].join('\n');

describe('block templates', () => {
	// The `/` menu and the LaTeX format toolbar insert from this one list, so a
	// template that does not parse would break both surfaces at once.
	const EXPECTED = {
		part: 'heading',
		chapter: 'heading',
		section: 'heading',
		subsection: 'heading',
		subsubsection: 'heading',
		'paragraph-heading': 'heading',
		subparagraph: 'heading',
		itemize: 'list',
		enumerate: 'list',
		description: 'list',
		equation: 'math',
		displaymath: 'math',
		align: 'math',
		matrix: 'math',
		cases: 'math',
		figure: 'float',
		table: 'float',
		quote: 'quote',
		verbatim: 'code',
		sample: 'paragraph'
	};

	for (const template of BLOCK_TEMPLATES.filter((t) => t.id !== 'paragraph')) {
		test(`${template.id} inserts one block the parser recognises`, () => {
			const text = templateSource(template.id);
			assert.ok(!text.includes(CARET), 'the caret marker leaked into the inserted source');
			const blocks = parseTexDoc(body(text)).blocks;
			assert.equal(blocks.length, 1, `produced ${blocks.map((b) => b.kind).join(', ')}`);
			assert.equal(blocks[0].kind, EXPECTED[template.id]);
		});
	}

	// Parity guard. Anything the LaTeX toolbar can insert has to be reachable in
	// visual mode too, and both surfaces read from these two lists.
	test('every template the LaTeX toolbar inserts exists in the shared list', () => {
		const toolbar = fs.readFileSync(
			path.join(
				import.meta.dirname,
				'..',
				'src',
				'components',
				'application',
				'format-toolbar.svelte'
			),
			'utf8'
		);
		const used = [...toolbar.matchAll(/\bt\('([^']+)'\)/g)].map((m) => m[1]);
		assert.ok(used.length >= 10, `only found ${used.length} shared templates in the toolbar`);
		for (const id of used) {
			assert.ok(
				BLOCK_TEMPLATES.some((t) => t.id === id),
				`the toolbar inserts "${id}", which the / menu does not offer`
			);
		}
	});

	test('every template has an icon in the insert menu', () => {
		const menu = fs.readFileSync(
			path.join(
				import.meta.dirname,
				'..',
				'src',
				'components',
				'application',
				'workbench',
				'visual',
				'slash-menu.svelte'
			),
			'utf8'
		);
		const icons = menu.slice(menu.indexOf('const ICONS'), menu.indexOf('const GROUP_LABEL'));
		for (const { id } of [...BLOCK_TEMPLATES, ...INLINE_TEMPLATES]) {
			assert.ok(icons.includes(`${/^[a-z]+$/.test(id) ? id : `'${id}'`}:`), `no icon for ${id}`);
		}
	});

	test('the figure template is the one with a real placeholder graphic', () => {
		// Matches the LaTeX toolbar's Insert → Figure byte for byte: `example-image`
		// ships with mwe, so an inserted figure renders on the first compile.
		assert.equal(templateSource('figure'), FIGURE_TEMPLATE);
	});

	test('an inserted figure reads back with all of its parts', () => {
		const float = parseTexDoc(body(FIGURE_TEMPLATE)).blocks[0];
		assert.equal(float.graphic, 'example-image');
		assert.equal(float.caption, 'Caption text.');
		assert.equal(float.label, 'fig:placeholder');
	});
});

describe('editing a float in place', () => {
	const SRC = body(FIGURE_TEMPLATE);
	const float = (src = SRC) => parseTexDoc(src).blocks[0];

	test('the caption is rewritten and nothing around it moves', () => {
		const out = applyPatch(SRC, setFloatCaption(SRC, float(), 'Convergence of the estimator.'));
		assert.match(out, /\\caption\{Convergence of the estimator\.\}/);
		assert.equal(out.replace('Convergence of the estimator.', 'Caption text.'), SRC);
	});

	test('the graphic path is rewritten without touching its options', () => {
		const out = applyPatch(SRC, setFloatGraphic(SRC, float(), 'figures/plot'));
		assert.match(out, /\\includegraphics\[width=0\.6\\linewidth\]\{figures\/plot\}/);
		assert.equal(out.replace('figures/plot', 'example-image'), SRC);
	});

	test('the width is rewritten without touching the path', () => {
		const out = applyPatch(SRC, setFloatWidth(SRC, float(), '\\linewidth'));
		assert.match(out, /\\includegraphics\[width=\\linewidth\]\{example-image\}/);
		assert.equal(floatWidth(out, float(out)), '\\linewidth');
	});

	test('a caption edit finds its own float, not the next one', () => {
		const two = body(
			`${FIGURE_TEMPLATE}\n\n\\begin{figure}[t]\n  \\includegraphics{other}\n  \\caption{Second.}\n\\end{figure}`
		);
		const blocks = parseTexDoc(two).blocks;
		const out = applyPatch(two, setFloatCaption(two, blocks[1], 'Edited.'));
		assert.match(out, /\\caption\{Caption text\.\}/);
		assert.match(out, /\\caption\{Edited\.\}/);
		assert.ok(!out.includes('Second.'));
	});

	// Regression guard: matching on the found text rather than the capture group's
	// own offsets rewrote the wrong copy whenever the caption repeated a word.
	test('a caption containing the command name still patches correctly', () => {
		const src = body(
			'\\begin{figure}\n  \\includegraphics{x}\n  \\caption{caption}\n\\end{figure}'
		);
		const out = applyPatch(src, setFloatCaption(src, float(src), 'New'));
		assert.match(out, /\\caption\{New\}/);
	});

	test('a float with no caption or width reports no patch rather than inventing one', () => {
		const src = body('\\begin{figure}\n  \\includegraphics{x}\n\\end{figure}');
		assert.equal(setFloatCaption(src, float(src), 'Nope'), null);
		assert.equal(setFloatWidth(src, float(src), '\\linewidth'), null);
		assert.equal(floatWidth(src, float(src)), null);
		// The path is still editable: that is the one command it does have.
		assert.ok(setFloatGraphic(src, float(src), 'y'));
	});
});
