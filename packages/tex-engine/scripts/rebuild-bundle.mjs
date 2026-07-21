// node scripts/rebuild-bundle.mjs [work-dir]  — format, bundle, packs, pack, verify.
// One command because every step must share a TeX Live snapshot: a format from
// one with packages from another fails as "kernel too old", not a missing file.
// Requires TeX Live on PATH (use WSL on Windows).
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const workDir = resolve(process.argv[2] ?? resolve(pkgRoot, '.bundle-work'));
const outputDir = resolve(pkgRoot, '../../crates/tectonic-wasm/output');
const coreDir = resolve(workDir, 'core');

mkdirSync(coreDir, { recursive: true });

// Echo each step so a failure is traceable to a command.
function step(label, script, args) {
	console.log(`\n=== ${label} ===`);
	const result = spawnSync(process.execPath, [resolve(here, script), ...args], {
		stdio: 'inherit',
		cwd: pkgRoot
	});
	if (result.status !== 0) {
		console.error(`\n${label} failed (exit ${result.status}).`);
		process.exit(result.status ?? 1);
	}
}

// Format first: the bundle is seeded with it and its recorded input list.
step('format', 'make-format.mjs', [workDir]);
step('core bundle', 'build-bundle.mjs', [coreDir, '--format', workDir]);
step('packs', 'build-packs.mjs', ['--bundle', coreDir, '--out', resolve(outputDir, 'packs')]);
step('pack tarball', 'pack-bundle.mjs', [coreDir]);
step('verify', 'verify-bundle.mjs', [coreDir]);

console.log('\nBundle rebuilt.');
console.log(`  work dir: ${workDir}`);
console.log(`  artifacts: ${outputDir}`);
console.log('\nNext:  pnpm engine:sync && pnpm engine:web:sync');
