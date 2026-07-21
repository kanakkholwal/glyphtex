// Pack a bundle directory into the gzipped tar the engine ships.
//
//   node scripts/pack-bundle.mjs <bundle-dir> [--out <file.tar.gz>]
//
// Written in Node rather than shelling out to `tar` on purpose: the archive is
// a committed artifact, so it has to come out byte-identical from the same
// input on any machine. GNU tar, bsdtar and Windows tar disagree about field
// padding, device numbers and whether a `./` prefix is emitted, and gzip stamps
// an mtime into its header unless told not to. Producing the bytes here removes
// all of that variance.
//
// The reader is apps/web/src/lib/tex/tar.ts — plain POSIX ustar, flat, no
// nesting. Names are written bare (no `./`) and every entry is a regular file,
// which is the subset that reader implements.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, constants } from 'node:zlib';

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

const BLOCK = 512;

/** Octal, NUL-terminated, right-aligned — the ustar convention for numbers. */
function octal(value, width) {
	return value.toString(8).padStart(width - 1, '0') + '\0';
}

function header(name, size) {
	const block = Buffer.alloc(BLOCK);
	const encoded = Buffer.from(name, 'utf8');
	// 100 bytes is the ustar name field. The prefix field could extend it, but
	// this bundle is flat with short TeX filenames, so a name that long means
	// something is wrong upstream — say so rather than silently truncating.
	if (encoded.length > 100) throw new Error(`name too long for ustar (${encoded.length}b): ${name}`);
	encoded.copy(block, 0);

	block.write(octal(0o644, 8), 100); // mode
	block.write(octal(0, 8), 108); // uid
	block.write(octal(0, 8), 116); // gid
	block.write(octal(size, 12), 124);
	block.write(octal(0, 12), 136); // mtime — fixed, see below
	block.write('        ', 148); // checksum field is spaces while summing
	block.write('0', 156); // typeflag: regular file
	block.write('ustar\0', 257);
	block.write('00', 263);

	let sum = 0;
	for (const byte of block) sum += byte;
	block.write(octal(sum, 8), 148);
	return block;
}

// Sorted so entry order does not depend on the filesystem's readdir order.
const names = readdirSync(bundleDir)
	.filter((n) => statSync(join(bundleDir, n)).isFile())
	.sort();

if (names.length === 0) {
	console.error(`${bundleDir} contains no files`);
	process.exit(1);
}

const chunks = [];
let raw = 0;
for (const name of names) {
	const body = readFileSync(join(bundleDir, name));
	chunks.push(header(name, body.length), body);
	const pad = (BLOCK - (body.length % BLOCK)) % BLOCK;
	if (pad) chunks.push(Buffer.alloc(pad));
	raw += body.length;
}
// Two zero blocks terminate the archive.
chunks.push(Buffer.alloc(BLOCK * 2));

const tar = Buffer.concat(chunks);
// `mtime: 0` keeps the gzip header stamp out; without it the same input packs
// to different bytes every run and the artifact churns on every rebuild.
const gz = gzipSync(tar, { level: constants.Z_BEST_COMPRESSION, mtime: 0 });

writeFileSync(outFile, gz);

const digest = createHash('sha256').update(gz).digest('hex').slice(0, 16);
console.log(`${names.length} files, ${(raw / 1048576).toFixed(1)} MB raw`);
console.log(`-> ${outFile}`);
console.log(`   ${(gz.length / 1048576).toFixed(2)} MB gzipped, sha256:${digest}`);
