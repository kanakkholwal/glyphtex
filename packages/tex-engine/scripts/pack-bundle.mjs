// Pack a bundle directory into the gzipped tar the engine ships.
//
//   node scripts/pack-bundle.mjs <bundle-dir> [--out <file.tar.gz>]
//
// The archive format and the reasons it is written by hand live in
// scripts/lib/targz.mjs, shared with the pack builder.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { packTarGz } from './lib/targz.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const argv = process.argv.slice(2);
const outFlag = argv.indexOf('--out');
// -1 when absent, so that `outFlag + 1` cannot alias index 0 and swallow the
// bundle directory — the same off-by-one that made make-format.mjs silently
// write its output to the current directory.
const outValue = outFlag === -1 ? -1 : outFlag + 1;
const positional = argv.filter((a, i) => !a.startsWith('--') && i !== outValue);
if (positional.length === 0) {
	console.error('usage: node scripts/pack-bundle.mjs <bundle-dir> [--out <file.tar.gz>]');
	process.exit(1);
}
const bundleDir = resolve(positional[0]);
const outFile =
	outFlag === -1
		? resolve(pkgRoot, '../../crates/tectonic-wasm/output/tectonic-bundle.tar.gz')
		: resolve(argv[outValue]);

if (!existsSync(bundleDir)) {
	console.error(`no such bundle directory: ${bundleDir}`);
	process.exit(1);
}

const files = new Map();
for (const name of readdirSync(bundleDir)) {
	const path = join(bundleDir, name);
	if (statSync(path).isFile()) files.set(name, readFileSync(path));
}
if (files.size === 0) {
	console.error(`${bundleDir} contains no files`);
	process.exit(1);
}

const { gz, raw, count } = packTarGz(files);
writeFileSync(outFile, gz);

const digest = createHash('sha256').update(gz).digest('hex').slice(0, 16);
console.log(`${count} files, ${(raw / 1048576).toFixed(1)} MB raw`);
console.log(`-> ${outFile}`);
console.log(`   ${(gz.length / 1048576).toFixed(2)} MB gzipped, sha256:${digest}`);
