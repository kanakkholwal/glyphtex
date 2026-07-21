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
		for (const sample of group.documents) {
			test(`${group.id}: ${sample.label}`, () => {
				engine.clearOutputs();
				engine.addFile('main.tex', sample.source);
				const result = engine.compile({ entry: 'main.tex' });

				const errors = result.diagnostics
					.filter((d) => d.severity === 'error')
					.slice(0, 3)
					.map((d) => d.message)
					.join(' | ');
				const detail = [result.message, errors].filter(Boolean).join(' — ');
				const where = `${group.label} / ${sample.label}`;

				assert.notEqual(result.status, 'failed', `${where}: ${detail || 'no output'}`);

				const pdf = engine.pdf();
				assert.ok(pdf && pdf.length > 0, `${where}: no PDF bytes`);
				assert.equal(
					Buffer.from(pdf.subarray(0, 5)).toString('latin1'),
					'%PDF-',
					`${where}: output is not a PDF`
				);
				// The font-fallback bug produced header-only PDFs: valid magic bytes,
				// no content, no error anywhere.
				assert.ok(pdf.length > 1000, `${where}: PDF suspiciously small (${pdf.length} B)`);

				assert.notEqual(result.status, 'errors', `${where} compiled with errors: ${errors}`);
			});
		}
	}
});
