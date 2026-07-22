import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TexEngine } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const args = process.argv.slice(2);
const wasmFlag = args.indexOf('--wasm');
const wasmValue = wasmFlag === -1 ? -1 : wasmFlag + 1;
const wasmPath =
	wasmFlag === -1
		? resolve(pkgRoot, '../../crates/tectonic-wasm/output/tectonic_wasm.wasm')
		: resolve(args[wasmValue]);
// Guard by index, not value: with no `--wasm`, `wasmFlag + 1` is 0, and a value
// comparison would drop the output dir and silently fall back to `.`.
const positional = args.filter((a, i) => !a.startsWith('--') && i !== wasmValue);
if (positional.length === 0) {
	console.error('usage: node scripts/make-format.mjs <output-dir> [--wasm <path>]');
	process.exit(1);
}
const outDir = resolve(positional[0]);

try {
	execFileSync('kpsewhich', ['--version'], { stdio: 'ignore' });
} catch {
	console.error('kpsewhich not found — a TeX Live installation is required.');
	console.error('On Windows use WSL; TeX Live installs into $HOME without root.');
	process.exit(1);
}
if (!existsSync(wasmPath)) {
	console.error(`engine not found at ${wasmPath}`);
	console.error('Build it first:  cd crates/tectonic-wasm && ./scripts/build-wasm.sh');
	process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const lookup = new Map();
function kpse(name) {
	if (lookup.has(name)) return lookup.get(name);
	let path = null;
	try {
		const found = execFileSync('kpsewhich', [name], { encoding: 'utf8' }).trim();
		if (found && existsSync(found)) path = found;
	} catch {
		/* TeX probes speculatively; most names never exist */
	}
	lookup.set(name, path);
	return path;
}

const WASM = new Uint8Array(readFileSync(wasmPath));
const inputs = new Map();

// Bare names only. The engine's filesystem is flat, and this list is consumed
// by build-bundle.mjs as filenames to write — TeX asks for `/dev/null`, which
// kpsewhich happily resolves, and an absolute name there escapes the output
// directory entirely.
function isBareName(name) {
	return name !== '' && !name.includes('/') && !name.includes('\\') && name !== '..' && name !== '.';
}

function add(name) {
	if (inputs.has(name)) return false;
	if (!isBareName(name)) return false;
	const path = kpse(name);
	if (!path) return false;
	inputs.set(name, new Uint8Array(readFileSync(path)));
	return true;
}

// xelatex.ini adds XeTeX's \pdfmapfile shims then \input latex.ltx, which ends
// in \dump; jobname `latex` makes it land as latex.fmt, the name the engine asks for.
for (const seed of ['xelatex.ini', 'latex.ltx']) {
	if (!add(seed)) {
		console.error(`cannot resolve ${seed} — is this a complete TeX Live?`);
		process.exit(1);
	}
}

// Pulled in by latex.ltx via `\@input`, which skips silently, so `missingFiles`
// never names them; first-aid must be here, not in the runtime bundle (too late).
for (const seed of ['latex2e-first-aid-for-external-files.ltx']) {
	if (!add(seed)) {
		console.error(`cannot resolve ${seed} — run: tlmgr install firstaid`);
		process.exit(1);
	}
}

/*
 * The format reports LaTeX 2026, so packages take their modern branches, but
 * Tectonic's XeTeX predates `\partokencontext` — microtype's tagging branch then
 * expands an undefined control sequence and every beamer frame collapses into
 * "Missing number"/"Illegal unit of measure". As a count register the assignment
 * `\partokencontext\z@` is a well-formed no-op, which is what "tagging off" means
 * for an engine that emits no tagged PDF.
 *
 * It has to be defined before `\dump`, and latex.ltx dumps at its own end, so
 * nothing after `\input latex.ltx` would run. Neutralising `\dump` and calling it
 * ourselves adds the shim without editing an upstream file. No `@` in the saved
 * name: it is catcode 12 until latex.ltx runs.
 */
const ENTRY = 'glyphx-format.ini';
inputs.set(
	ENTRY,
	new TextEncoder().encode(
		[
			'\\let\\glyphxdump\\dump',
			'\\let\\dump\\relax',
			'\\input xelatex.ini',
			'\\ifdefined\\partokencontext\\else \\newcount\\partokencontext \\fi',
			'\\glyphxdump',
			''
		].join('\n')
	)
);

// Fresh instance per attempt: a failed INITEX aborts through C without unwinding
// Rust, so reuse leaks TeX arrays and later fails as "xmalloc request failed".
async function attempt() {
	const engine = await TexEngine.load(WASM);
	for (const [name, bytes] of inputs) engine.addFile(name, bytes);
	const result = engine.compile({ entry: ENTRY, jobname: 'latex', initex: true });
	return { engine, result };
}

// TeX stops at the first file it cannot open, so each attempt reveals ~one new
// input; convergence takes tens of rounds.
const MAX_ROUNDS = 400;
let dumped = null;

for (let round = 1; round <= MAX_ROUNDS; round++) {
	const { engine, result } = await attempt();

	const fmt = result.outputs.find((o) => o.kind === 'format');
	if (fmt) {
		// INITEX dumps whenever it reaches \dump, even after errors; such a format
		// loads fine and fails later as what looks like a package bug.
		const errors = result.diagnostics.filter((d) => d.severity === 'error');
		if (errors.length > 0 || result.status === 'errors') {
			console.error(`\nround ${round}: INITEX reached \\dump but reported errors:`);
			for (const d of errors.slice(0, 10)) console.error(`  ${d.message}`);
			console.error('\nRefusing to write a format built from an erroring run.');
			process.exit(1);
		}

		dumped = engine.output(fmt.name);
		console.log(`round ${round}: dumped ${fmt.name} (${(dumped.length / 1048576).toFixed(2)} MB)`);
		break;
	}

	let gained = 0;
	for (const name of result.missingFiles) if (add(name)) gained++;

	if (gained === 0) {
		console.error(`\nstalled at round ${round}: ${result.message ?? 'no format produced'}`);
		const unresolved = result.missingFiles.filter((n) => !inputs.has(n) && kpse(n) === null);
		if (unresolved.length) {
			console.error(`${unresolved.length} requested file(s) are not in this TeX Live:`);
			for (const n of unresolved.slice(0, 15)) console.error(`  ${n}`);
			console.error('Install the packages providing them with tlmgr, then retry.');
		}
		process.exit(1);
	}
}

if (!dumped) {
	console.error(`no format after ${MAX_ROUNDS} rounds`);
	process.exit(1);
}

writeFileSync(resolve(outDir, 'latex.fmt'), dumped);
// What INITEX consumed is the kernel's runtime input set; a bundle needs these
// alongside the format, from the same snapshot, or version skew returns.
writeFileSync(
	resolve(outDir, 'format-inputs.json'),
	JSON.stringify(
		[...inputs.keys()].filter((n) => n !== ENTRY).sort(),
		null,
		'\t'
	) + '\n'
);

console.log(`wrote ${outDir}/latex.fmt from ${inputs.size} input files`);
