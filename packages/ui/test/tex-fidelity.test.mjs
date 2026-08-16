import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { applyPatch, escapeText, parseTexDoc, printBlock, setInlines } from './.build/tex-doc.mjs';

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

/** What a paragraph becomes once the visual editor has written it back. */
function reprint(src) {
	const block = parseTexDoc(src).blocks[0];
	assert.ok(block, `nothing parsed out of ${JSON.stringify(src)}`);
	return printBlock(block, src);
}

describe('inline LaTeX survives being written back', () => {
	// Each of these used to lose its braces, which changes what the document says
	// and in several cases stops it compiling at all.
	const CASES = {
		'two-argument macro': 'See \\textcolor{red}{this bit} for detail.',
		'optional then mandatory': 'A \\includegraphics[width=1cm]{logo} inline.',
		siunitx: 'Held at \\SI{298.15}{\\kelvin} throughout.',
		hyperref: 'See \\hyperref[sec:a]{that section}.',
		'font switch in a group': 'Some {\\bfseries bold text} and more.',
		'bare grouping': 'A {tricky} word.',
		'nested braces in one argument': 'Use \\mycmd{a {b} c} here.',
		'starred unknown macro': 'A \\foo*{x} here.',
		'tie before a reference': 'See Figure~\\ref{fig:one}.',
		'citation keys keep their spacing': 'Prior work \\citep{knuth1984,lamport1994} assumes.',
		'escaped punctuation': '100\\% of Tom \\& Jerry, a\\_b, \\$5, \\#1.',
		'nested marks': '\\textbf{bold \\emph{and italic}} tail.',
		'line break': 'One\\\\Two.',
		'inline maths': 'Value $\\frac{a}{b}$ shown.',
		'inline maths in parens': 'Value \\( \\frac{a}{b} \\) shown.'
	};

	for (const [label, source] of Object.entries(CASES)) {
		test(label, () => assert.equal(reprint(source + '\n'), source));
	}
});

describe('comments', () => {
	test('one inside a paragraph survives an edit, newline and all', () => {
		const src = 'First line.\n% keep me: a reviewer note\nSecond line.\n';
		const block = parseTexDoc(src).blocks[0];
		const patch = setInlines(src, block, [...block.content, { kind: 'text', text: ' Added.' }]);
		const out = applyPatch(src, patch);
		assert.equal(out, 'First line.\n% keep me: a reviewer note\nSecond line. Added.\n');
	});

	test('the lines it separated do not run together', () => {
		assert.equal(reprint('Alpha\n% note\nBeta\n'), 'Alpha\n% note\nBeta');
	});

	test('one after the text is left outside the block, not duplicated', () => {
		const src = 'A paragraph.  % trailing note\n\nAnother.\n';
		const block = parseTexDoc(src).blocks[0];
		const out = applyPatch(src, setInlines(src, block, [{ kind: 'text', text: 'Replaced.' }]));
		assert.equal(out, 'Replaced.  % trailing note\n\nAnother.\n');
	});

	test('one on its own line between paragraphs is never touched', () => {
		const src = 'A.\n\n% standalone\n\nB.\n';
		const { blocks } = parseTexDoc(src);
		let out = src;
		for (const block of [...blocks].reverse())
			out = applyPatch(out, { ...block.span, insert: printBlock(block, src) });
		assert.equal(out, src);
	});
});

describe('escaping what the user types', () => {
	// A caret or a tilde typed as prose is not punctuation in LaTeX: one is a
	// superscript outside maths, the other a non-breaking space.
	const CASES = [
		['x^2 is squared', 'x\\textasciicircum{}2 is squared'],
		['a ~ b', 'a \\textasciitilde{} b'],
		['C:\\Users', 'C:\\textbackslash{}Users'],
		['50% off', '50\\% off'],
		['a_b', 'a\\_b'],
		['{braced}', '\\{braced\\}']
	];
	for (const [typed, escaped] of CASES) {
		test(JSON.stringify(typed), () => {
			assert.equal(escapeText(typed), escaped);
			// And it has to survive being read back, or the next edit doubles it.
			assert.equal(reprint(escaped + '\n'), escaped);
		});
	}
});

describe('the fidelity guard', () => {
	// Broken or unrepresentable source. Each is left exactly as the author wrote
	// it rather than being quietly "corrected" by a rewrite.
	const DEMOTED = [
		'Paths like file_name.tex need care.',
		'Tom & Jerry without an escape.',
		'A \\ref{fig:\\myid} link.',
		'A $ lone dollar.'
	];
	for (const source of DEMOTED) {
		const src = source + '\n';
		test(`not editable: ${source}`, () => {
			const block = parseTexDoc(src).blocks[0];
			assert.equal(block.fidelity, 'source');
			assert.equal(printBlock(block, src), source, 'a demoted block did not print its own bytes');
		});

		test(`not rewritable: ${source}`, () => {
			const block = parseTexDoc(src).blocks[0];
			const patch = setInlines(src, block, [{ kind: 'text', text: 'Overwritten.' }]);
			assert.equal(applyPatch(src, patch), src, 'a source-fidelity block was rewritten');
		});
	}

	test('every native block in every fixture reproduces its own source', () => {
		const settle = (text) => text.replace(/\s+/g, ' ').trim();
		for (const file of fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.tex'))) {
			const src = fs.readFileSync(path.join(FIXTURES, file), 'utf8');
			for (const block of parseTexDoc(src).blocks) {
				if (block.fidelity !== 'native') continue;
				assert.equal(
					settle(printBlock(block, src)),
					settle(src.slice(block.span.from, block.span.to)),
					`${file}: a ${block.kind} claims native fidelity but does not round-trip`
				);
			}
		}
	});

	test('the fixtures stay editable: nothing is demoted by the guard', () => {
		const counts = {};
		for (const file of fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.tex'))) {
			const src = fs.readFileSync(path.join(FIXTURES, file), 'utf8');
			for (const block of parseTexDoc(src).blocks) {
				if (['heading', 'paragraph', 'list', 'quote'].includes(block.kind))
					counts[block.fidelity] = (counts[block.fidelity] ?? 0) + 1;
			}
		}
		assert.ok(counts.native > 15, `only ${counts.native} editable prose blocks left`);
		assert.equal(counts.source, undefined, 'a fixture paragraph was demoted');
	});
});
