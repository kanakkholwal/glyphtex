// Hand-written because these archives are committed: system `tar` implementations
// disagree on padding and `./` prefixes, so the same input would not give the
// same bytes. Reader is apps/web/src/lib/tex/tar.ts — flat ustar, regular files.
import { constants, gunzipSync, gzipSync } from "node:zlib";

const BLOCK = 512;

/** Octal, NUL-terminated, right-aligned — the ustar convention for numbers. */
function octal(value, width) {
	return value.toString(8).padStart(width - 1, "0") + "\0";
}

function header(name, size) {
	const block = Buffer.alloc(BLOCK);
	const encoded = Buffer.from(name, "utf8");
	// TeX filenames are short, so 100 bytes means something is wrong upstream.
	if (encoded.length > 100)
		throw new Error(`name too long for ustar (${encoded.length}b): ${name}`);
	encoded.copy(block, 0);

	block.write(octal(0o644, 8), 100); // mode
	block.write(octal(0, 8), 108); // uid
	block.write(octal(0, 8), 116); // gid
	block.write(octal(size, 12), 124);
	block.write(octal(0, 12), 136); // mtime — fixed, for reproducibility
	block.write("        ", 148); // checksum field is spaces while summing
	block.write("0", 156); // typeflag: regular file
	block.write("ustar\0", 257);
	block.write("00", 263);

	let sum = 0;
	for (const byte of block) sum += byte;
	block.write(octal(sum, 8), 148);
	return block;
}

// Sorted, so archive order never depends on collection order.
export function packTarGz(files) {
	const names = [...files.keys()].sort();
	const chunks = [];
	let raw = 0;

	for (const name of names) {
		const body = Buffer.from(files.get(name));
		chunks.push(header(name, body.length), body);
		const pad = (BLOCK - (body.length % BLOCK)) % BLOCK;
		if (pad) chunks.push(Buffer.alloc(pad));
		raw += body.length;
	}
	// Two zero blocks terminate the archive.
	chunks.push(Buffer.alloc(BLOCK * 2));

	// `mtime: 0` keeps the gzip header stamp out; without it the same input packs
	// to different bytes every run and the artifact churns on every rebuild.
	const gz = gzipSync(Buffer.concat(chunks), { level: constants.Z_BEST_COMPRESSION, mtime: 0 });
	return { gz, raw, count: names.length };
}

/** The inverse of packTarGz: flat regular files by name, for reading committed packs back. */
export function unpackTarGz(gz) {
	const bytes = gunzipSync(gz);
	const files = new Map();
	const field = (at, len) => {
		const slice = bytes.subarray(at, at + len);
		const end = slice.indexOf(0);
		return Buffer.from(end === -1 ? slice : slice.subarray(0, end)).toString("utf8");
	};
	for (let at = 0; at + BLOCK <= bytes.length; ) {
		const name = field(at, 100);
		if (!name) break;
		const size = Number.parseInt(field(at + 124, 12).trim() || "0", 8);
		if (bytes[at + 156] === 0x30)
			files.set(name, new Uint8Array(bytes.subarray(at + BLOCK, at + BLOCK + size)));
		at += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
	}
	return files;
}
