// One command: rebuild the TeX bundle + packs and sync them into the package and
// the web app, so a running dev server serves the change.
//
//   node scripts/refresh-engine.mjs [--format] [--wasm]
//
// Run this after adding a package to a fixture or a pack to packs.config.json.
// Adding TeX packages does NOT change the wasm binary — only the bundle changes
// — so the wasm build is opt-in (--wasm); the format (a slow INITEX dump) is
// cached and only regenerated when the wasm is newer than it, or --format forces.
//
// Needs TeX Live on PATH (kpsewhich); on Windows run it from WSL.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const repoRoot = resolve(pkgRoot, '../..');
const outputDir = resolve(repoRoot, 'crates/tectonic-wasm/output');
const wasmPath = resolve(outputDir, 'tectonic_wasm.wasm');

const argv = process.argv.slice(2);
const forceFormat = argv.includes('--format');
const withWasm = argv.includes('--wasm');

const work = resolve(pkgRoot, '.engine-work');
const formatDir = resolve(work, 'format');
const coreDir = resolve(work, 'core');
mkdirSync(coreDir, { recursive: true });
mkdirSync(formatDir, { recursive: true });

// TeX Live (kpsewhich) is required. On Windows it lives in WSL, so when it is
// not on PATH here, re-run the whole thing inside a WSL login shell — which is
// what makes `pnpm engine:refresh` a single command on Windows too.
function hasKpsewhich() {
	try {
		execFileSync('kpsewhich', ['--version'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}
if (!hasKpsewhich()) {
	if (process.platform !== 'win32') {
		console.error('kpsewhich not found — install TeX Live, or add it to PATH.');
		process.exit(1);
	}
	const wslPath = repoRoot.replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`).replace(/\\/g, '/');
	const rel = 'packages/tex-engine/scripts/refresh-engine.mjs';
	// Login shell (-l) so the user's ~/.bash_profile PATH (TeX Live, node) loads.
	const r = spawnSync(
		'wsl.exe',
		['bash', '-lc', `cd '${wslPath}' && node ${rel} ${argv.join(' ')}`],
		{ stdio: 'inherit' }
	);
	if (r.error) {
		console.error('Could not launch WSL. Run from a WSL shell with TeX Live on PATH.');
		process.exit(1);
	}
	process.exit(r.status ?? 1);
}

function step(label, script, args, cwd = pkgRoot) {
	console.log(`\n=== ${label} ===`);
	const r = spawnSync(process.execPath, [resolve(here, script), ...args], { stdio: 'inherit', cwd });
	if (r.status !== 0) {
		console.error(`\n${label} failed (exit ${r.status}).`);
		process.exit(r.status ?? 1);
	}
}

if (withWasm) {
	console.log('\n=== wasm ===');
	const r = spawnSync('bash', ['scripts/build-wasm.sh'], {
		stdio: 'inherit',
		cwd: resolve(repoRoot, 'crates/tectonic-wasm')
	});
	if (r.status !== 0) process.exit(r.status ?? 1);
}

// A format is a memory image of the engine that dumped it, so a new wasm needs a
// new format. Otherwise the cached one stands — regenerating it every run would
// add a slow INITEX pass to a one-line pack change.
const haveFormat = existsSync(resolve(formatDir, 'latex.fmt'));
const stale = haveFormat && statSync(wasmPath).mtimeMs > statSync(resolve(formatDir, 'latex.fmt')).mtimeMs;
if (forceFormat || !haveFormat || stale) {
	step('format (INITEX dump)', 'make-format.mjs', [formatDir]);
} else {
	console.log('\n=== format (cached; pass --format to regenerate) ===');
}

step('core bundle', 'build-bundle.mjs', [coreDir, '--format', formatDir]);
step('pack core tarball', 'pack-bundle.mjs', [coreDir]);
step('packs', 'build-packs.mjs', ['--bundle', coreDir, '--out', resolve(outputDir, 'packs')]);
step('verify', 'verify-bundle.mjs', [coreDir]);

// Sync into both consumers: the npm package (wasm/) and the web app
// (static/engine/ + a fresh manifest, whose version hash invalidates the
// browser's cached install so the dev server serves the new bundle).
step('sync → package', 'sync-wasm.mjs', []);
step('sync → web', '../../../apps/web/scripts/sync-engine.mjs', [outputDir]);

console.log('\nEngine refreshed and synced. Reload the dev server tab to pick it up.');
