import assert from 'node:assert/strict';
import test from 'node:test';

import { isBinaryPath, normalisePath } from './.build/storage/projects.mjs';
import { toCompileFiles, toGlyphFiles, toNewFiles } from './.build/storage/bridge.mjs';

test('normalisePath', async (t) => {
	await t.test('normalises separators and strips leading slashes', () => {
		assert.equal(normalisePath('sections\\intro.tex'), 'sections/intro.tex');
		assert.equal(normalisePath('/main.tex'), 'main.tex');
		assert.equal(normalisePath('./a/./b.tex'), 'a/b.tex');
		assert.equal(normalisePath('a//b.tex'), 'a/b.tex');
	});

	await t.test('rejects traversal and empty names', () => {
		for (const bad of ['../secrets.tex', 'a/../../b.tex', '', '/', './']) {
			assert.throws(() => normalisePath(bad), /not a valid file name/, `accepted ${bad}`);
		}
	});

	await t.test('a file merely starting with dots is fine', () => {
		assert.equal(normalisePath('..hidden.tex'), '..hidden.tex');
		assert.equal(normalisePath('a/..b/c.tex'), 'a/..b/c.tex');
	});
});

test('isBinaryPath', () => {
	for (const p of ['fig.png', 'a/b/photo.JPEG', 'logo.pdf', 'font.woff2']) {
		assert.equal(isBinaryPath(p), true, p);
	}
	for (const p of ['main.tex', 'refs.bib', 'notes.md', 'pngfile.tex']) {
		assert.equal(isBinaryPath(p), false, p);
	}
});

test('bridge round-trip preserves binary bytes', () => {
	const bytes = new Uint8Array([137, 80, 78, 71]);
	const stored = [
		{ key: 'p:main.tex', projectId: 'p', path: 'main.tex', text: 'hello', size: 5, updatedAt: 0 },
		{ key: 'p:fig.png', projectId: 'p', path: 'fig.png', data: bytes, size: 4, updatedAt: 0 }
	];

	const files = toGlyphFiles(stored);
	assert.equal(files.length, 2);
	assert.equal(files[0].content, 'hello');
	// The editor cannot hold bytes, so a binary file shows a placeholder.
	assert.match(files[1].content, /^% Binary file/);

	const binary = new Map([['fig.png', bytes]]);
	const back = toNewFiles(files, binary);
	assert.equal(back[0].text, 'hello');
	assert.equal(back[1].data, bytes, 'binary bytes must survive a save');
	assert.equal(back[1].text, undefined, 'the placeholder must never overwrite the bytes');
});

test('toCompileFiles sends saved text and real bytes', () => {
	const bytes = new Uint8Array([1, 2, 3]);
	const files = [
		{ id: 'main.tex', name: 'main.tex', content: 'live edit', saved: 'saved text' },
		{ id: 'fig.png', name: 'fig.png', content: '% Binary file', saved: '% Binary file' }
	];

	const out = toCompileFiles(files, new Map([['fig.png', bytes]]));
	assert.equal(out[0].text, 'saved text', 'the engine compiles saved content, not the live buffer');
	assert.equal(out[1].data, bytes);
	assert.equal(out[1].text, undefined);
});

test('toCompileFiles falls back to live content for a never-saved file', () => {
	const out = toCompileFiles([{ id: 'a.tex', name: 'a.tex', content: 'brand new' }], new Map());
	assert.equal(out[0].text, 'brand new');
});
