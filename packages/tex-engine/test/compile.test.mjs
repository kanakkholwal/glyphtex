// End-to-end tests against a real engine build.
//
// Skipped unless a wasm artifact and a TeX bundle are present, so the suite
// stays runnable on a machine without the Emscripten toolchain:
//
//   GLYPHX_WASM=../../crates/tectonic-wasm/output/tectonic_wasm.wasm \
//   GLYPHX_BUNDLE=/path/to/extracted/bundle \
//   node --test test/
import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TexEngine } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const wasmPath = process.env.GLYPHX_WASM
	? resolve(process.env.GLYPHX_WASM)
	: resolve(here, '../../../crates/tectonic-wasm/output/tectonic_wasm.wasm');
const bundleDir = process.env.GLYPHX_BUNDLE ? resolve(process.env.GLYPHX_BUNDLE) : null;

const haveArtifacts = existsSync(wasmPath) && bundleDir && existsSync(bundleDir);

describe('TexEngine', { skip: haveArtifacts ? false : 'wasm or bundle not available' }, () => {
	let engine;

	before(async () => {
		engine = await TexEngine.load(readFileSync(wasmPath));
		for (const name of readdirSync(bundleDir)) {
			const p = join(bundleDir, name);
			if (statSync(p).isFile()) engine.addFile(name, readFileSync(p));
		}
	});

	function compile(source, options = {}) {
		engine.clearOutputs();
		engine.addFile('main.tex', source);
		return engine.compile({ entry: 'main.tex', ...options });
	}

	test('compiles a minimal document to a PDF', () => {
		const result = compile(
			'\\documentclass{article}\\begin{document}Hello.\\end{document}'
		);
		assert.notEqual(result.status, 'failed', result.message ?? '');
		const pdf = engine.pdf();
		assert.ok(pdf && pdf.length > 0, 'expected PDF bytes');
		assert.equal(Buffer.from(pdf.subarray(0, 5)).toString('latin1'), '%PDF-');
	});

	test('reports missing files instead of substituting them', () => {
		const result = compile(
			'\\documentclass{article}\\usepackage{definitelynotreal}\\begin{document}x\\end{document}'
		);
		assert.ok(
			result.missingFiles.some((f) => f.includes('definitelynotreal')),
			`expected the missing package to be reported, got ${JSON.stringify(result.missingFiles)}`
		);
	});

	// The regression this whole rewrite exists for: the previous font fallback
	// served a Type1 .pfb where TFM metrics were wanted, which hung the engine
	// on booktabs and produced a 15-byte PDF for \Large.
	test('booktabs compiles instead of hanging', () => {
		const result = compile(
			[
				'\\documentclass{article}',
				'\\usepackage{booktabs}',
				'\\begin{document}',
				'\\begin{tabular}{lr}\\toprule A & 1 \\\\ \\midrule B & 2 \\\\ \\bottomrule\\end{tabular}',
				'\\end{document}'
			].join('\n')
		);
		assert.notEqual(result.status, 'failed', result.message ?? '');
		assert.ok(engine.pdf().length > 1000, 'expected a PDF with real content');
	});

	test('font size changes produce a non-empty PDF', () => {
		const result = compile(
			'\\documentclass{article}\\begin{document}{\\Large Big} and {\\small small}.\\end{document}'
		);
		assert.notEqual(result.status, 'failed', result.message ?? '');
		assert.ok(
			engine.pdf().length > 1000,
			'expected real content, not just a PDF header'
		);
	});

	test('resolves cross-references across passes', () => {
		const result = compile(
			[
				'\\documentclass{article}',
				'\\begin{document}',
				'\\tableofcontents',
				'\\section{Intro}\\label{sec:intro}',
				'See section \\ref{sec:intro}.',
				'\\end{document}'
			].join('\n')
		);
		assert.notEqual(result.status, 'failed', result.message ?? '');
		assert.ok(result.passesRun >= 2, `expected a rerun, got ${result.passesRun} pass(es)`);
		const log = engine.log() ?? '';
		assert.ok(
			!/Reference `sec:intro' .*undefined/.test(log),
			'reference should have resolved by the final pass'
		);
	});

	test('converges rather than always running the maximum passes', () => {
		const result = compile(
			'\\documentclass{article}\\begin{document}No references here.\\end{document}',
			{ maxPasses: 4 }
		);
		assert.ok(
			result.passesRun < 4,
			`a document with no cross-references should converge early, ran ${result.passesRun}`
		);
	});

	test('emits synctex when asked', () => {
		const result = compile(
			'\\documentclass{article}\\begin{document}Hello.\\end{document}',
			{ synctex: true }
		);
		assert.notEqual(result.status, 'failed', result.message ?? '');
		assert.ok(
			result.outputs.some((o) => o.kind === 'synctex'),
			`expected a synctex output, got ${result.outputs.map((o) => o.name).join(', ')}`
		);
	});

	test('honours a custom jobname', () => {
		engine.clearOutputs();
		engine.addFile('doc.tex', '\\documentclass{article}\\begin{document}x\\end{document}');
		const result = engine.compile({ entry: 'doc.tex', jobname: 'report' });
		assert.notEqual(result.status, 'failed', result.message ?? '');
		assert.ok(result.outputs.some((o) => o.name === 'report.pdf'));
	});

	test('surfaces TeX errors as diagnostics without failing outright', () => {
		const result = compile(
			'\\documentclass{article}\\begin{document}\\undefinedcommand\\end{document}'
		);
		assert.equal(result.status, 'errors');
		assert.ok(
			result.diagnostics.some((d) => d.severity === 'error'),
			'expected at least one error diagnostic'
		);
	});

	test('reports a clean failure when the entry file is absent', () => {
		const result = engine.compile({ entry: 'nosuchfile.tex' });
		assert.equal(result.status, 'failed');
		assert.match(result.message ?? '', /nosuchfile\.tex/);
	});
});
