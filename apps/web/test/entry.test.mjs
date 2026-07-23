import assert from 'node:assert/strict';
import { test } from 'node:test';

import { keepOrPickEntry, pickEntry } from './.build/storage/entry.mjs';

const f = (path, text) => ({ path, text });
const CLASS = '\\documentclass{article}\n\\begin{document}\nhi\n\\end{document}';
const CHAPTER = '\\chapter{One}\nSome prose.';

test('a lone root is chosen without asking', () => {
	const r = pickEntry([f('main.tex', CLASS), f('refs.bib', '')]);
	assert.equal(r.entry, 'main.tex');
	assert.equal(r.confident, true);
});

test('a nested chapter never outranks a root-level document', () => {
	const r = pickEntry([
		f('chapters/01-intro.tex', CHAPTER),
		f('thesis.tex', CLASS),
		f('chapters/02-method.tex', CHAPTER)
	]);
	assert.equal(r.entry, 'thesis.tex');
	assert.equal(r.confident, true);
});

// The reported bug: the archive listed a nested file first, so it won.
test('listing order does not decide the entry', () => {
	const files = [
		f('sections/appendix.tex', CHAPTER),
		f('figures/diagram.tex', CHAPTER),
		f('main.tex', CLASS)
	];
	assert.equal(pickEntry(files).entry, 'main.tex');
	assert.equal(pickEntry([...files].reverse()).entry, 'main.tex');
});

test('a nested file that declares a class is still not preferred over a root one', () => {
	const r = pickEntry([f('standalone/poster.tex', CLASS), f('paper.tex', CLASS)]);
	assert.equal(r.entry, 'paper.tex');
	assert.deepEqual(r.candidates, ['paper.tex']);
});

test('several roots at the top level are all offered, conventional name first', () => {
	const r = pickEntry([f('supplement.tex', CLASS), f('main.tex', CLASS), f('cover.tex', CLASS)]);
	assert.equal(r.entry, 'main.tex');
	assert.equal(r.confident, false);
	assert.deepEqual(r.candidates, ['main.tex', 'cover.tex', 'supplement.tex']);
});

test('files without a documentclass are not candidates when one exists', () => {
	const r = pickEntry([f('preamble.tex', '\\usepackage{amsmath}'), f('main.tex', CLASS)]);
	assert.deepEqual(r.candidates, ['main.tex']);
});

test('a commented-out documentclass does not make a chapter a root', () => {
	const r = pickEntry([
		f('chapters/one.tex', '% \\documentclass{article}\n\\chapter{One}'),
		f('main.tex', CLASS)
	]);
	assert.equal(r.entry, 'main.tex');
	assert.equal(r.confident, true);
});

test('an escaped percent does not swallow the rest of the line', () => {
	const r = pickEntry([f('main.tex', '100\\% done\n\\documentclass{article}')]);
	assert.equal(r.entry, 'main.tex');
	assert.equal(r.confident, true);
});

test('subfiles chapters are excluded so the parent wins', () => {
	const r = pickEntry([
		f(
			'main.tex',
			'\\documentclass{book}\n\\usepackage{subfiles}\n\\begin{document}\\end{document}'
		),
		f('ch1.tex', '\\documentclass[main.tex]{subfiles}\n\\begin{document}One\\end{document}')
	]);
	assert.equal(r.entry, 'main.tex');
	assert.deepEqual(r.candidates, ['main.tex']);
});

test('with no documentclass anywhere it falls back to shallowest .tex', () => {
	const r = pickEntry([f('deep/nested/a.tex', CHAPTER), f('b.tex', CHAPTER)]);
	assert.equal(r.entry, 'b.tex');
});

test('a project entirely inside a folder still resolves', () => {
	const r = pickEntry([f('proj/main.tex', CLASS), f('proj/ch1.tex', CHAPTER)]);
	assert.equal(r.entry, 'proj/main.tex');
	assert.equal(r.confident, true);
});

test('no .tex at all does not throw', () => {
	const r = pickEntry([f('notes.md', '# hi')]);
	assert.equal(r.entry, 'notes.md');
	assert.deepEqual(r.candidates, []);
});

test('an empty project falls back to main.tex', () => {
	assert.equal(pickEntry([]).entry, 'main.tex');
});

test('text is optional; extensions alone still pick a plausible root', () => {
	const r = pickEntry([{ path: 'chapters/one.tex' }, { path: 'main.tex' }]);
	assert.equal(r.entry, 'main.tex');
});

test('keepOrPickEntry leaves a surviving choice alone', () => {
	const files = [f('main.tex', CLASS), f('paper.tex', CLASS)];
	assert.equal(keepOrPickEntry(files, 'paper.tex').entry, 'paper.tex');
});

test('keepOrPickEntry re-picks when the chosen file is gone', () => {
	const r = keepOrPickEntry([f('main.tex', CLASS)], 'deleted.tex');
	assert.equal(r.entry, 'main.tex');
});
