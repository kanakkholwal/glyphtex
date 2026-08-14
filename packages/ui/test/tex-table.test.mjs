import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
	applyPatch,
	applyPatches,
	deleteTableColumn,
	deleteTableRow,
	ensurePackage,
	floatAlignment,
	floatLabel,
	floatPlacement,
	floatWidth,
	insertTableColumn,
	insertTableRow,
	parseTexDoc,
	printTable,
	readTable,
	setEnvironment,
	setFloatAlignment,
	setFloatCaption,
	setFloatLabel,
	setFloatPlacement,
	setFloatWidth,
	setFloatWrap,
	setTableCell,
	setTableColumnAlign,
	setTableRules,
	templateSource
} from './.build/tex-doc.mjs';

const body = (text) => `\\begin{document}\n${text}\n\\end{document}\n`;
const first = (src) => parseTexDoc(src).blocks[0];

const TABLE = templateSource('table');
const SRC = body(TABLE);

describe('reading a tabular as a grid', () => {
	const grid = readTable(SRC, first(SRC));

	test('the template table reads back as a real grid', () => {
		assert.ok(grid);
		assert.deepEqual(grid.columns, ['l', 'l']);
		assert.equal(grid.rows.length, 3);
		assert.deepEqual(
			grid.rows.map((r) => r.cells.map((c) => c.text)),
			[
				['Header 1', 'Header 2'],
				['Cell 1', 'Cell 2'],
				['Cell 3', 'Cell 4']
			]
		);
	});

	test('the grid spans only the tabular, not the float around it', () => {
		assert.ok(SRC.slice(grid.span.from, grid.span.to).startsWith('\\begin{tabular}'));
		assert.ok(SRC.slice(grid.span.from, grid.span.to).endsWith('\\end{tabular}'));
	});

	test('reprinting a grid and reading it back gives the same grid', () => {
		const printed = body(printTable(grid));
		const again = readTable(printed, first(printed));
		assert.deepEqual(
			again.rows.map((r) => r.cells.map((c) => c.text)),
			grid.rows.map((r) => r.cells.map((c) => c.text))
		);
		assert.equal(printTable(again), printTable(grid));
	});

	test('a cell holding a macro with braces keeps its columns straight', () => {
		const src = body(
			'\\begin{tabular}{l l}\n  \\textbf{a} & \\texttt{x & y} \\\\\n  c & d\n\\end{tabular}'
		);
		const read = readTable(src, first(src));
		assert.deepEqual(
			read.rows.map((r) => r.cells.map((c) => c.text)),
			[
				['\\textbf{a}', '\\texttt{x & y}'],
				['c', 'd']
			]
		);
	});

	test('a shape we cannot model reports null instead of guessing', () => {
		for (const inner of [
			'\\begin{tabular}{l l}\n  \\multicolumn{2}{c}{Wide} \\\\\n  a & b\n\\end{tabular}',
			'\\begin{tabular}{*{3}{c}}\n  a & b & c\n\\end{tabular}',
			'\\begin{tabular}{l}\n  a % trailing note\n\\end{tabular}'
		]) {
			const src = body(inner);
			assert.equal(readTable(src, first(src)), null, inner.slice(0, 40));
		}
	});
});

describe('editing a table', () => {
	const grid = () => readTable(SRC, first(SRC));
	const after = (patch) => {
		const out = applyPatch(SRC, patch);
		return readTable(out, first(out));
	};

	test('a cell edit rewrites only that cell', () => {
		const out = applyPatch(SRC, setTableCell(grid(), 1, 1, 'Rewritten'));
		assert.match(out, /Cell 1 & Rewritten/);
		assert.equal(out.replace('Rewritten', 'Cell 2'), SRC);
	});

	test('an ampersand typed into a cell is escaped, not left to break the row', () => {
		const out = applyPatch(SRC, setTableCell(grid(), 1, 0, 'Tom & Jerry'));
		const read = readTable(out, first(out));
		assert.equal(read.rows[1].cells[0].text, 'Tom \\& Jerry');
		assert.equal(read.rows[1].cells.length, 2);
	});

	test('a row is added with the right number of cells', () => {
		const read = after(insertTableRow(grid(), 2));
		assert.equal(read.rows.length, 4);
		assert.deepEqual(
			read.rows[2].cells.map((c) => c.text),
			['', '']
		);
	});

	test('a column is added to every row and to the spec', () => {
		const read = after(insertTableColumn(grid(), 2));
		assert.deepEqual(read.columns, ['l', 'l', 'l']);
		for (const row of read.rows) assert.equal(row.cells.length, 3);
	});

	test('deleting a row and a column keeps the rest', () => {
		const rows = after(deleteTableRow(grid(), 0));
		assert.deepEqual(
			rows.rows[0].cells.map((c) => c.text),
			['Cell 1', 'Cell 2']
		);
		const cols = after(deleteTableColumn(grid(), 0));
		assert.deepEqual(cols.columns, ['l']);
		assert.deepEqual(
			cols.rows[0].cells.map((c) => c.text),
			['Header 2']
		);
	});

	test('the last row and the last column cannot be deleted away', () => {
		const one = body('\\begin{tabular}{l}\n  a\n\\end{tabular}');
		const grid = readTable(one, first(one));
		assert.equal(deleteTableRow(grid, 0), null);
		assert.equal(deleteTableColumn(grid, 0), null);
	});

	test('column alignment is written into the spec', () => {
		const read = after(setTableColumnAlign(grid(), 1, 'c'));
		assert.deepEqual(read.columns, ['l', 'c']);
	});

	test('rules can be turned off and back on', () => {
		const off = applyPatch(SRC, setTableRules(grid(), false));
		assert.ok(!off.includes('\\hline'));
		const back = applyPatch(off, setTableRules(readTable(off, first(off)), true));
		assert.equal((back.match(/\\hline/g) ?? []).length, 3);
	});
});

describe('float controls', () => {
	const FIGURE = templateSource('figure');
	const fig = body(FIGURE);
	const block = () => first(fig);

	test('a caption can be added to a float that has none', () => {
		const bare = body('\\begin{figure}\n  \\includegraphics{x}\n\\end{figure}');
		const out = applyPatch(bare, setFloatCaption(bare, first(bare), 'A new caption.'));
		assert.match(out, /\\includegraphics\{x\}\n\s*\\caption\{A new caption\.\}\n\\end\{figure\}/);
		assert.equal(first(out).caption, 'A new caption.');
	});

	test('clearing a caption removes the command, not just its text', () => {
		const out = applyPatch(fig, setFloatCaption(fig, block(), ''));
		assert.ok(!out.includes('\\caption'));
		assert.ok(out.includes('\\includegraphics'));
	});

	test('a label can be added, changed and removed', () => {
		const bare = body('\\begin{figure}\n  \\includegraphics{x}\n\\end{figure}');
		const added = applyPatch(bare, setFloatLabel(bare, first(bare), 'fig:new'));
		assert.equal(floatLabel(added, first(added)), 'fig:new');
		const renamed = applyPatch(added, setFloatLabel(added, first(added), 'fig:other'));
		assert.equal(floatLabel(renamed, first(renamed)), 'fig:other');
		const removed = applyPatch(renamed, setFloatLabel(renamed, first(renamed), ''));
		assert.equal(floatLabel(removed, first(removed)), null);
	});

	test('placement is read and rewritten', () => {
		assert.equal(floatPlacement(fig, block()), 'h');
		const out = applyPatch(fig, setFloatPlacement(fig, block(), 'tbp'));
		assert.match(out, /\\begin\{figure\}\[tbp\]/);
		const none = applyPatch(out, setFloatPlacement(out, first(out), ''));
		assert.match(none, /\\begin\{figure\}\n/);
		const back = applyPatch(none, setFloatPlacement(none, first(none), 'h'));
		assert.match(back, /\\begin\{figure\}\[h\]/);
	});

	test('alignment is a command that can be swapped or dropped', () => {
		assert.equal(floatAlignment(fig, block()), 'centering');
		const left = applyPatch(fig, setFloatAlignment(fig, block(), 'raggedright'));
		assert.equal(floatAlignment(left, first(left)), 'raggedright');
		const none = applyPatch(left, setFloatAlignment(left, first(left), null));
		assert.equal(floatAlignment(none, first(none)), null);
		const back = applyPatch(none, setFloatAlignment(none, first(none), 'centering'));
		assert.equal(floatAlignment(back, first(back)), 'centering');
	});

	test('width is added to a graphic that has no options at all', () => {
		const bare = body('\\begin{figure}\n  \\includegraphics{x}\n\\end{figure}');
		const out = applyPatch(bare, setFloatWidth(bare, first(bare), '0.5\\linewidth'));
		assert.match(out, /\\includegraphics\[width=0\.5\\linewidth\]\{x\}/);
	});

	test('width joins options that are already there', () => {
		const src = body('\\begin{figure}\n  \\includegraphics[angle=90]{x}\n\\end{figure}');
		const out = applyPatch(src, setFloatWidth(src, first(src), '\\linewidth'));
		assert.match(out, /\[angle=90, width=\\linewidth\]/);
		assert.equal(floatWidth(out, first(out)), '\\linewidth');
	});

	test('wrapping turns the figure into a wrapfigure and back', () => {
		const wrapped = applyPatch(fig, setFloatWrap(fig, block(), 'r'));
		assert.match(wrapped, /\\begin\{wrapfigure\}\{r\}\{0\.45\\linewidth\}/);
		assert.match(wrapped, /\\end\{wrapfigure\}/);
		assert.equal(first(wrapped).kind, 'float');
		assert.ok(wrapped.includes('\\includegraphics[width=0.6\\linewidth]{example-image}'));
		const back = applyPatch(wrapped, setFloatWrap(wrapped, first(wrapped), null));
		assert.equal(back, fig);
	});

	test('a package is added once, and only when it is missing', () => {
		const src = '\\documentclass{article}\n\\usepackage{graphicx}\n' + fig;
		const end = parseTexDoc(src).preamble.span.to;
		const out = applyPatch(src, ensurePackage(src, end, 'wrapfig'));
		assert.match(out, /\\usepackage\{graphicx\}\n\\usepackage\{wrapfig\}/);
		assert.equal(ensurePackage(out, parseTexDoc(out).preamble.span.to, 'wrapfig'), null);
	});

	test('two patches at once keep each other in place', () => {
		const src = '\\documentclass{article}\n\\usepackage{graphicx}\n' + fig;
		const end = parseTexDoc(src).preamble.span.to;
		const block = parseTexDoc(src).blocks[0];
		const out = applyPatches(src, [
			ensurePackage(src, end, 'wrapfig'),
			setFloatWrap(src, block, 'l')
		]);
		assert.match(out, /\\usepackage\{wrapfig\}/);
		assert.match(out, /\\begin\{wrapfigure\}\{l\}/);
	});

	test('a quote can be swapped for another environment', () => {
		const src = body('\\begin{quote}\n  Said it.\n\\end{quote}');
		const out = applyPatch(src, setEnvironment(src, first(src), 'quotation'));
		assert.equal(out, body('\\begin{quotation}\n  Said it.\n\\end{quotation}'));
		assert.equal(first(out).kind, 'quote');
	});
});
