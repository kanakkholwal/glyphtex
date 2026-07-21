import {
	copyFileSync,
	mkdirSync,
	existsSync,
	statSync,
	readFileSync,
	readdirSync,
	writeFileSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
// Build outputs, not sources: gitignored under static/engine/ and copied in here.
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

// Packs are optional and versioned by their own hashes, not the engine version,
// so a new engine build does not force a re-download of unchanged packs.
const packSource = resolve(outputDir, 'packs');
if (existsSync(packSource)) {
	const packDest = resolve(destDir, 'packs');
	mkdirSync(packDest, { recursive: true });

	let packBytes = 0;
	let packCount = 0;
	for (const name of readdirSync(packSource)) {
		const from = join(packSource, name);
		if (!statSync(from).isFile()) continue;
		copyFileSync(from, resolve(packDest, name));
		packBytes += statSync(from).size;
		if (name.endsWith('.tar.gz')) packCount++;
	}
	console.log(
		`  ${String(packCount).padStart(2)} packs${' '.repeat(20)} ${(packBytes / 1048576).toFixed(2)} MB`
	);
} else {
	console.log('  (no packs — run pnpm engine:bundle:packs to build them)');
}

console.log(`\nengine ${version} -> static/engine/ (${(total / 1048576).toFixed(2)} MB core)`);
