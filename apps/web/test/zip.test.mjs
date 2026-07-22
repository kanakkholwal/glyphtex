import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readZip, writeZip } from './.build/storage/zip.mjs';

const text = (s) => new TextEncoder().encode(s);
const str = (b) => new TextDecoder().decode(b);

test('round-trips text and binary through our own writer', async () => {
	// Incompressible, so it exercises the stored-not-deflated branch.
	const random = new Uint8Array(512);
	for (let i = 0; i < random.length; i++) random[i] = (i * 7919) % 256;

	const entries = [
		{ path: 'main.tex', data: text('\\documentclass{article}\n') },
		{ path: 'sections/intro.tex', data: text('nested\n') },
		{ path: 'figures/blob.bin', data: random }
	];

	const zip = await writeZip(entries);
	assert.equal(str(zip.subarray(0, 2)), 'PK');

	const back = await readZip(zip);
	assert.deepEqual(back.map((e) => e.path).sort(), [
		'figures/blob.bin',
		'main.tex',
		'sections/intro.tex'
	]);
	assert.equal(str(back.find((e) => e.path === 'main.tex').data), '\\documentclass{article}\n');
	assert.deepEqual(back.find((e) => e.path === 'figures/blob.bin').data, random);
});

test('compresses repetitive content', async () => {
	const big = text('x'.repeat(10_000));
	const zip = await writeZip([{ path: 'a.tex', data: big }]);
	assert.ok(zip.byteLength < 1000, `expected deflate, got ${zip.byteLength} bytes`);
	assert.equal(str((await readZip(zip))[0].data).length, 10_000);
});

test('rejects a file that is not a zip', async () => {
	await assert.rejects(
		() => readZip(text('not a zip at all, just some bytes here')),
		/not a \.zip/
	);
});

test('reads an archive produced by the system zip tool', async (t) => {
	// The real interop check: our reader against a foreign writer.
	let dir;
	try {
		dir = mkdtempSync(join(tmpdir(), 'glyphx-zip-'));
		mkdirSync(join(dir, 'sections'));
		writeFileSync(join(dir, 'main.tex'), 'hello from powershell\n');
		writeFileSync(join(dir, 'sections', 'a.tex'), 'y'.repeat(5000));
		execFileSync(
			'powershell.exe',
			[
				'-NoProfile',
				'-Command',
				`Compress-Archive -Path '${join(dir, '*')}' -DestinationPath '${join(dir, 'out.zip')}' -Force`
			],
			{ stdio: 'pipe' }
		);
	} catch (error) {
		t.skip(`system zip unavailable: ${error.message}`);
		return;
	}

	try {
		const entries = await readZip(new Uint8Array(readFileSync(join(dir, 'out.zip'))));
		const byPath = Object.fromEntries(entries.map((e) => [e.path.replace(/\\/g, '/'), e.data]));
		assert.equal(str(byPath['main.tex']), 'hello from powershell\n');
		assert.equal(str(byPath['sections/a.tex']).length, 5000);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
