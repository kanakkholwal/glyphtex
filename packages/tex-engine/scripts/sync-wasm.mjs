// Copy the built engine and its TeX support bundle into the package so it can
// be packed or tested.
//
// Both are artifacts of crates/tectonic-wasm and are gitignored here; CI does
// the same copy before `npm publish`.
//
// The bundle ships with the package deliberately. The wasm on its own cannot
// typeset anything — it has no format, no classes, no fonts — so publishing
// just the binary would give consumers something that instantiates fine and
// then fails on the first \documentclass. The engine is the pair.
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const outputDir = process.argv[2] ?? resolve(pkgRoot, '../../crates/tectonic-wasm/output');

const ARTIFACTS = [
	{ name: 'tectonic_wasm.wasm', dest: 'wasm' },
	{ name: 'tectonic-bundle.tar.gz', dest: 'wasm' }
];

const missing = ARTIFACTS.filter(({ name }) => !existsSync(resolve(outputDir, name)));
if (missing.length > 0) {
	console.error(`Missing artifacts in ${outputDir}:`);
	for (const { name } of missing) console.error(`  ${name}`);
	console.error('\nBuild the engine:  cd crates/tectonic-wasm && ./scripts/build-wasm.sh');
	console.error('Build the bundle:  pnpm engine:bundle:build && pnpm engine:bundle:pack');
	process.exit(1);
}

let total = 0;
for (const { name, dest } of ARTIFACTS) {
	const destDir = resolve(pkgRoot, dest);
	mkdirSync(destDir, { recursive: true });
	const target = resolve(destDir, basename(name));
	copyFileSync(resolve(outputDir, name), target);

	const bytes = statSync(target).size;
	total += bytes;
	console.log(`  ${name.padEnd(26)} ${(bytes / 1048576).toFixed(2)} MB -> ${dest}/`);
}

console.log(`synced ${ARTIFACTS.length} artifacts (${(total / 1048576).toFixed(2)} MB total)`);
