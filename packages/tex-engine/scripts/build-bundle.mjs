import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TexEngine } from '../dist/index.js';
import { ALL_SAMPLES } from '../test/fixtures/groups.mjs';
import { globTexmf } from './lib/texmf.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const argv = process.argv.slice(2);
function flag(name, fallback) {
	const i = argv.indexOf(name);
	return i === -1 ? fallback : resolve(argv[i + 1]);
}
const positional = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const outDir = resolve(positional[0] ?? resolve(pkgRoot, '../../crates/tectonic-wasm/bundle'));
const formatDir = flag('--format', outDir);
const wasmPath = flag('--wasm', resolve(pkgRoot, '../../crates/tectonic-wasm/output/tectonic_wasm.wasm'));

for (const [label, path] of [
	['engine', wasmPath],
	['format', join(formatDir, 'latex.fmt')],
	['format input list', join(formatDir, 'format-inputs.json')]
]) {
	if (!existsSync(path)) {
		console.error(`missing ${label}: ${path}`);
		if (label !== 'engine') console.error('Generate it first:  pnpm bundle:format <dir>');
		process.exit(1);
	}
}
try {
	execFileSync('kpsewhich', ['--version'], { stdio: 'ignore' });
} catch {
	console.error('kpsewhich not found — a TeX Live installation is required (use WSL on Windows).');
	process.exit(1);
}

const lookup = new Map();
function kpse(name) {
	if (lookup.has(name)) return lookup.get(name);
	let path = null;
	try {
		const found = execFileSync('kpsewhich', [name], { encoding: 'utf8' }).trim();
		if (found && existsSync(found)) path = found;
	} catch {
		/* TeX probes speculatively; most of these never exist */
	}
	lookup.set(name, path);
	return path;
}

const WASM = new Uint8Array(readFileSync(wasmPath));
const files = new Map();

/**
 * The bundle is flat and the engine looks files up by bare name, so a name
 * carrying a path separator can never be served from it.
 *
 * Rejecting them is also what keeps the writer inside `outDir`: `resolve()`
 * lets an absolute name override the base entirely. TeX really does ask for
 * `/dev/null`, and kpsewhich really does "resolve" it, so without this the
 * builder wrote a file straight to /dev/null — which succeeds silently, leaving
 * the bundle one file short of what it reported. A name like `/etc/...` would
 * be the same mechanism aimed somewhere that matters.
 */
function isBareName(name) {
	return name !== '' && !name.includes('/') && !name.includes('\\') && name !== '..' && name !== '.';
}

function addFromTexLive(name) {
	if (files.has(name)) return false;
	if (!isBareName(name)) return false;
	const path = kpse(name);
	if (!path) return false;
	files.set(name, new Uint8Array(readFileSync(path)));
	return true;
}

files.set('latex.fmt', new Uint8Array(readFileSync(join(formatDir, 'latex.fmt'))));
for (const name of JSON.parse(readFileSync(join(formatDir, 'format-inputs.json'), 'utf8'))) {
	addFromTexLive(name);
}

// Loaded via `\@input`/`\InputIfFileExists`, which skip silently, so they never
// reach `missingFiles`; omitting first-aid broke `cleveref` after `hyperref`.
const KERNEL_SILENT_LOADS = [
	'latex2e-first-aid-for-external-files.ltx',
	'documentmetadata-support.ltx'
];
for (const name of KERNEL_SILENT_LOADS) {
	if (!addFromTexLive(name) && !files.has(name)) {
		console.warn(`warning: ${name} is not in this TeX Live — packages relying on it will break`);
	}
}

// Packages other packages load via `\IfFileExists` — a silent probe, so absent
// ones never reach `missingFiles`. scrlfile: beamer's sansmathaccent uses it to
// avoid wasting a mathgroup, and without it every beamer deck warns.
const OPTIONAL_SILENT_LOADS = ['scrlfile.sty'];
for (const name of OPTIONAL_SILENT_LOADS) {
	if (!addFromTexLive(name) && !files.has(name)) {
		console.warn(`note: ${name} not in this TeX Live — a cosmetic warning may remain`);
	}
}

// Latin Modern font definitions and metrics (~26 KB). XeTeX loads fonts
// internally, so these never reach `missingFiles`; without t1lmss.fd,
// `\usepackage[T1]{fontenc}` with sans fell back to CM and broke. The heavy
// Type1 outlines (.pfb, 8.6 MB) that actually embed the glyphs ride in the
// default-on `fonts-latinmodern` pack, keeping the core download lean.
let fontCount = 0;
for (const [name, path] of globTexmf(['lm*.tfm', '*lm*.fd'])) {
	if (!files.has(name) && isBareName(name)) {
		files.set(name, new Uint8Array(readFileSync(path)));
		fontCount++;
	}
}
console.log(`seeded ${files.size} files (format + inputs + silent loads + ${fontCount} font metrics)`);

// Fresh instance per document: an aborted compile tears down the wasm stack
// without unwinding Rust, so a shared instance stays locked and poisons the rest.
async function freshEngine() {
	const engine = await TexEngine.load(WASM);
	for (const [name, bytes] of files) engine.addFile(name, bytes);
	return engine;
}

const MAX_ROUNDS = 300;
const passing = new Set();

for (let round = 1; round <= MAX_ROUNDS; round++) {
	let gained = 0;
	const unresolved = new Set();

	for (const sample of ALL_SAMPLES) {
		const key = `${sample.groupId}/${sample.label}`;
		const engine = await freshEngine();
		engine.addFile('main.tex', sample.source);

		let result;
		try {
			result = engine.compile({ entry: 'main.tex' });
		} catch (error) {
			passing.delete(key);
			console.log(`  ${key}: engine crashed — ${String(error.message).slice(0, 80)}`);
			continue;
		}

		for (const name of result.missingFiles) {
			if (addFromTexLive(name)) gained++;
			else if (!files.has(name)) unresolved.add(name);
		}

		const pdf = result.status === 'failed' ? null : engine.pdf();
		const ok = result.status !== 'failed' && result.status !== 'errors' && pdf && pdf.length > 1000;
		if (ok) passing.add(key);
		else passing.delete(key);
	}

	console.log(
		`round ${String(round).padStart(3)}  files=${String(files.size).padStart(4)}  ` +
			`resolved=${String(gained).padStart(3)}  passing=${passing.size}/${ALL_SAMPLES.length}`
	);

	if (passing.size === ALL_SAMPLES.length) break;

	if (gained === 0) {
		console.error(`\nstalled at round ${round}: ${passing.size}/${ALL_SAMPLES.length} passing.`);
		const wanted = [...unresolved].filter((n) => /\.(sty|cls|def|cfg|clo|fd|tex|otf|ttf|tfm)$/.test(n));
		if (wanted.length) {
			console.error(`${wanted.length} requested file(s) are not in this TeX Live:`);
			for (const n of wanted.slice(0, 20)) console.error(`  ${n}`);
			console.error('\nInstall the packages providing them, then re-run:');
			console.error('  tlmgr install <package>');
		} else {
			console.error('No unresolved file names — the remaining failures are not missing files.');
			console.error('Compile a failing fixture directly to see its diagnostics.');
		}
		process.exit(1);
	}
}

if (passing.size !== ALL_SAMPLES.length) {
	console.error(`\nnot converged after ${MAX_ROUNDS} rounds`);
	process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// The engine looks files up by the exact name it asked for, so two keys that
// land on one path silently drop a file — and the bundle still looks complete.
const byPath = new Map();
for (const name of files.keys()) {
	const path = resolve(outDir, name);
	if (!byPath.has(path)) byPath.set(path, []);
	byPath.get(path).push(name);
}
const collisions = [...byPath.values()].filter((n) => n.length > 1);
if (collisions.length) {
	console.error(`\n${collisions.length} name(s) collide on disk:`);
	for (const names of collisions) console.error(`  ${names.join('  ==  ')}`);
	process.exit(1);
}

for (const [name, bytes] of files) writeFileSync(resolve(outDir, name), bytes);

// Count what actually landed. Resolving every key to a distinct path is not the
// same as producing that many files, and a bundle silently one file short is
// indistinguishable from a complete one until some document cannot compile.
const written = readdirSync(outDir);
if (written.length !== files.size) {
	const onDisk = new Set(written);
	const absent = [...files.keys()].filter((n) => !onDisk.has(n));
	console.error(`\nresolved ${files.size} files but wrote ${written.length}.`);
	if (absent.length) for (const n of absent) console.error(`  never landed: ${JSON.stringify(n)}`);
	else console.error('  every key is present — the extra is on disk, not in the set.');
	process.exit(1);
}

const total = [...files.values()].reduce((n, b) => n + b.length, 0);
console.log(`\nevery fixture compiles.`);
console.log(`wrote ${files.size} files (${(total / 1048576).toFixed(1)} MB raw) to ${outDir}`);
console.log('Next:  pnpm bundle:verify ' + outDir);
