// Copy the in-house TeX engine into the web app's static assets.
//
// Both files are build outputs of crates/tectonic-wasm, not sources, so they
// are gitignored under static/engine/ and copied in here — the same
// arrangement packages/tex-engine uses for the wasm binary. CI runs this
// before `vite build`; locally, run it after `crates/tectonic-wasm/scripts/
// build-wasm.sh`.
//
// A manifest carrying each file's size and a content hash is written alongside
// them. The hash is what the browser keys its persistent Cache API entries on,
// so shipping a new engine invalidates the old download instead of leaving
// users on a stale bundle.
import { copyFileSync, mkdirSync, existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const outputDir = process.argv[2] ?? resolve(appRoot, '../../crates/tectonic-wasm/output');

const SOURCES = ['tectonic_wasm.wasm', 'tectonic-bundle.tar.gz'];

const missing = SOURCES.filter((f) => !existsSync(resolve(outputDir, f)));
if (missing.length > 0) {
	console.error(`Missing engine artifacts in ${outputDir}:`);
	for (const f of missing) console.error(`  ${f}`);
	console.error('\nBuild them first:  cd crates/tectonic-wasm && ./scripts/build-wasm.sh');
	process.exit(1);
}

const destDir = resolve(appRoot, 'static/engine');
mkdirSync(destDir, { recursive: true });

/** Short content hash — enough to key a cache entry, not a security boundary. */
function hash(path) {
	return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16);
}

const files = {};
let total = 0;

for (const name of SOURCES) {
	const source = resolve(outputDir, name);
	const dest = resolve(destDir, name);
	copyFileSync(source, dest);

	const { size } = statSync(dest);
	files[basename(name)] = { bytes: size, hash: hash(dest) };
	total += size;

	console.log(`  ${name.padEnd(26)} ${(size / 1048576).toFixed(2)} MB`);
}

// One version string over both files: the browser downloads them as a pair, so
// a change to either has to invalidate the whole cached install.
const version = createHash('sha256')
	.update(SOURCES.map((n) => files[n].hash).join(':'))
	.digest('hex')
	.slice(0, 16);

writeFileSync(
	resolve(destDir, 'manifest.json'),
	JSON.stringify({ version, totalBytes: total, files }, null, '\t') + '\n'
);

console.log(`\nengine ${version} -> static/engine/ (${(total / 1048576).toFixed(2)} MB total)`);
