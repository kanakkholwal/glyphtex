// Every package group the installer offers must actually compile.
//
// bundle-manifest.json lists the files each group needs, and verify-bundle.mjs
// checks they are present — but presence is not support. A `.sty` can be in the
// bundle and still fail at compile time because a dependency, a font file, or
// the LaTeX kernel version is wrong. These tests close that gap: one real
// document per group, each asserted to produce a PDF.
//
// This is the same class of false promise as the old font fallback — the UI
// offering something the engine cannot deliver — one layer up.
import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TexEngine } from '../dist/index.js';
import { GROUP_FIXTURES } from './fixtures/groups.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const wasmPath = process.env.GLYPHX_WASM
	? resolve(process.env.GLYPHX_WASM)
	: resolve(here, '../../../crates/tectonic-wasm/output/tectonic_wasm.wasm');
const bundleDir = process.env.GLYPHX_BUNDLE ? resolve(process.env.GLYPHX_BUNDLE) : null;
const haveArtifacts = existsSync(wasmPath) && bundleDir && existsSync(bundleDir);

if (process.env.GLYPHX_REQUIRE_ENGINE && !haveArtifacts) {
	throw new Error('GLYPHX_REQUIRE_ENGINE is set but the engine or bundle is missing.');
}

describe('package groups', { skip: haveArtifacts ? false : 'wasm or bundle not available' }, () => {
	let engine;

	before(async () => {
		engine = await TexEngine.load(readFileSync(wasmPath));
		for (const name of readdirSync(bundleDir)) {
			const p = join(bundleDir, name);
			if (statSync(p).isFile()) engine.addFile(name, readFileSync(p));
		}
	});

	for (const group of GROUP_FIXTURES) {
		test(`${group.id} — ${group.label}`, () => {
			engine.clearOutputs();
			engine.addFile('main.tex', group.source);
			const result = engine.compile({ entry: 'main.tex' });

			// Report the engine's own diagnosis rather than a bare assertion
			// failure — "expected not 'failed'" says nothing actionable.
			const errors = result.diagnostics
				.filter((d) => d.severity === 'error')
				.slice(0, 3)
				.map((d) => d.message)
				.join(' | ');
			const detail = [result.message, errors].filter(Boolean).join(' — ');

			assert.notEqual(result.status, 'failed', `${group.label}: ${detail || 'no output'}`);

			const pdf = engine.pdf();
			assert.ok(pdf && pdf.length > 0, `${group.label}: no PDF bytes`);
			assert.equal(
				Buffer.from(pdf.subarray(0, 5)).toString('latin1'),
				'%PDF-',
				`${group.label}: output is not a PDF`
			);
			// A header-only PDF is the failure mode the font-fallback bug used to
			// produce: valid magic bytes, zero content, no error anywhere.
			assert.ok(pdf.length > 1000, `${group.label}: PDF is suspiciously small (${pdf.length} B)`);

			// A group whose packages loaded but errored is not "supported".
			assert.equal(
				result.status === 'errors',
				false,
				`${group.label} compiled with errors: ${errors}`
			);
		});
	}
});
