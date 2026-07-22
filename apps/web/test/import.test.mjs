import assert from 'node:assert/strict';
import test from 'node:test';

import { isTextPath } from './.build/storage/import.mjs';
import { readZip, writeZip } from './.build/storage/zip.mjs';

const text = (s) => new TextEncoder().encode(s);

test('classifies text vs binary by extension', () => {
	for (const p of ['main.tex', 'a/refs.bib', 'cls/thesis.cls', 'notes.md', 'data.csv']) {
		assert.equal(isTextPath(p), true, p);
	}
	// Unknown types are stored as bytes rather than decoded and corrupted.
	for (const p of ['fig.png', 'font.ttf', 'archive.tar', 'mystery.dat', 'noext']) {
		assert.equal(isTextPath(p), false, p);
	}
});

test('a zip written then read keeps nested paths intact', async () => {
	const zip = await writeZip([
		{ path: 'thesis/main.tex', data: text('\\documentclass{book}') },
		{ path: 'thesis/chapters/one.tex', data: text('chapter one') },
		{ path: 'thesis/figures/plot.png', data: new Uint8Array([137, 80, 78, 71]) }
	]);
	const entries = await readZip(zip);
	assert.deepEqual(entries.map((e) => e.path).sort(), [
		'thesis/chapters/one.tex',
		'thesis/figures/plot.png',
		'thesis/main.tex'
	]);
});

test('zip round-trip is byte-exact for binary payloads', async () => {
	// Every byte value, to catch any latin1/utf8 mangling in the deflate path.
	const all = new Uint8Array(256);
	for (let i = 0; i < 256; i++) all[i] = i;
	const entries = await readZip(await writeZip([{ path: 'b.bin', data: all }]));
	assert.deepEqual(entries[0].data, all);
});
