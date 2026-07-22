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
import { copyFileSync, mkdirSync, existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
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

// Default packs ship too, for the same reason the bundle does: they are not
// extras. Every pack is non-optional, the worker loads them all on boot, and a
// consumer without them gets a quietly lesser engine — \usetheme and \rowcolor
// fail on a package that otherwise looks complete.
const packsSrc = resolve(outputDir, 'packs');
if (existsSync(packsSrc)) {
	const packsDest = resolve(pkgRoot, 'wasm', 'packs');
	mkdirSync(packsDest, { recursive: true });

	let packBytes = 0;
	const names = readdirSync(packsSrc).filter((n) => n.endsWith('.tar.gz') || n.endsWith('.json'));
	for (const name of names) {
		copyFileSync(resolve(packsSrc, name), resolve(packsDest, name));
		packBytes += statSync(resolve(packsDest, name)).size;
	}
	total += packBytes;

	const index = JSON.parse(readFileSync(resolve(packsDest, 'packs-index.json'), 'utf8'));
	const defaults = index.packs.filter((p) => !p.optional).length;
	console.log(
		`  ${'packs'.padEnd(26)} ${(packBytes / 1048576).toFixed(2)} MB -> wasm/packs/ ` +
			`(${index.packs.length} packs, ${defaults} default)`
	);
} else {
	console.warn(`  no packs at ${packsSrc} — run: pnpm engine:bundle:packs`);
}

console.log(`synced ${(total / 1048576).toFixed(2)} MB total`);
