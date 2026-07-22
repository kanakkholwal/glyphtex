import assert from 'node:assert/strict';
import test from 'node:test';

import { compileIgnore, defaultIgnore, importIgnore } from './.build/storage/ignore.mjs';

test('blacklists dependency trees and build output at any depth', () => {
	for (const p of [
		'node_modules/left-pad/index.js',
		'paper/node_modules/x.js',
		'.git/HEAD',
		'.next/server/app.js',
		'__pycache__/mod.pyc',
		'target/debug/build.rs',
		'.DS_Store',
		'figures/.DS_Store'
	]) {
		assert.equal(defaultIgnore(p), true, p);
	}
});

test('keeps real project sources', () => {
	for (const p of [
		'main.tex',
		'chapters/intro.tex',
		'refs.bib',
		'figures/plot.png',
		'.gitignore'
	]) {
		assert.equal(defaultIgnore(p), false, p);
	}
});

test('drops regenerated TeX artifacts but keeps the source beside them', () => {
	assert.equal(defaultIgnore('main.aux'), true);
	assert.equal(defaultIgnore('main.synctex.gz'), true);
	assert.equal(defaultIgnore('build/main.log'), true);
	assert.equal(defaultIgnore('main.tex'), false);
	assert.equal(defaultIgnore('main.pdf'), false);
});

test('a bare pattern matches at any depth, a slashed one anchors to the root', () => {
	const anywhere = compileIgnore(['drafts']);
	assert.equal(anywhere('drafts/old.tex'), true);
	assert.equal(anywhere('paper/drafts/old.tex'), true);

	const rooted = compileIgnore(['/drafts']);
	assert.equal(rooted('drafts/old.tex'), true);
	assert.equal(rooted('paper/drafts/old.tex'), false);
});

test('negation rescues a path, and the last matching rule wins', () => {
	const ignore = compileIgnore(['*.pdf', '!final.pdf']);
	assert.equal(ignore('draft.pdf'), true);
	assert.equal(ignore('final.pdf'), false);

	const reversed = compileIgnore(['!final.pdf', '*.pdf']);
	assert.equal(reversed('final.pdf'), true);
});

test('globs: * stops at a separator, ** spans them', () => {
	const single = compileIgnore(['figures/*.png']);
	assert.equal(single('figures/plot.png'), true);
	assert.equal(single('figures/raw/plot.png'), false);

	const deep = compileIgnore(['figures/**/*.png']);
	assert.equal(deep('figures/raw/plot.png'), true);
});

test('comments and blank lines are not patterns', () => {
	const ignore = compileIgnore(['', '   ', '# build output', 'build/']);
	assert.equal(ignore('build/main.pdf'), true);
	assert.equal(ignore('main.tex'), false);
});

test('a project .gitignore layers on top of the blacklist', () => {
	const ignore = importIgnore('*.pdf\n!keep.pdf\n');
	assert.equal(ignore('draft.pdf'), true);
	assert.equal(ignore('keep.pdf'), false);
	// The built-in blacklist still applies alongside it.
	assert.equal(ignore('node_modules/x.js'), true);
	// .gitignore itself is a source file worth keeping.
	assert.equal(ignore('.gitignore'), false);
});
