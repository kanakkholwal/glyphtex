import { inflateRawSync } from "node:zlib";
import { gunzip } from "glyphtex-engine";

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** The last path segment, whichever separator the archive used. */
const leaf = (path: string) => path.split(/[\\/]/).pop() ?? path;

/**
 * Reads one named file out of a .zip. In-process on purpose: shelling out to `tar` breaks where
 * the first `tar` on PATH is GNU tar, which reads `C:\\file.zip` as a remote host.
 */
export function readFromZip(zip: Uint8Array, name: string): Uint8Array | null {
	const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
	let eocd = -1;
	for (let i = zip.byteLength - 22; i >= Math.max(0, zip.byteLength - 66_000); i--) {
		if (view.getUint32(i, true) === EOCD) {
			eocd = i;
			break;
		}
	}
	if (eocd === -1) throw new Error("This is not a valid .zip file.");
	const count = view.getUint16(eocd + 10, true);
	let at = view.getUint32(eocd + 16, true);

	for (let n = 0; n < count; n++) {
		if (view.getUint32(at, true) !== CENTRAL) throw new Error("The .zip directory is damaged.");
		const method = view.getUint16(at + 10, true);
		const compressed = view.getUint32(at + 20, true);
		const nameLen = view.getUint16(at + 28, true);
		const extraLen = view.getUint16(at + 30, true);
		const commentLen = view.getUint16(at + 32, true);
		const local = view.getUint32(at + 42, true);
		const entry = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLen));
		at += 46 + nameLen + extraLen + commentLen;
		if (leaf(entry) !== name) continue;

		if (view.getUint32(local, true) !== LOCAL) throw new Error("The .zip entry is damaged.");
		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
		const body = zip.subarray(start, start + compressed);
		if (method === 0) return body;
		if (method === 8) return new Uint8Array(inflateRawSync(body));
		throw new Error(`The .zip uses an unsupported compression method (${method}).`);
	}
	return null;
}

const BLOCK = 512;
const text = (block: Uint8Array, at: number, len: number) => {
	const raw = block.subarray(at, at + len);
	const end = raw.indexOf(0);
	return new TextDecoder().decode(end === -1 ? raw : raw.subarray(0, end)).trim();
};
const octal = (block: Uint8Array, at: number, len: number) =>
	Number.parseInt(text(block, at, len) || "0", 8);

/**
 * One named file out of a tar. The engine's own reader handles only what the TeX bundle uses; the
 * Tectonic Linux release stores its binary as a GNU sparse file (type `S`), so this one reads
 * regular and sparse entries and skips the rest.
 */
export function readFromTar(tar: Uint8Array, name: string): Uint8Array | null {
	let offset = 0;
	while (offset + BLOCK <= tar.length) {
		const header = tar.subarray(offset, offset + BLOCK);
		offset += BLOCK;
		if (header.every((b) => b === 0)) break;
		const stored = octal(header, 124, 12);
		const type = String.fromCharCode(header[156] || 0x30);
		const entry = leaf(text(header, 0, 100));
		let dataStart = offset;
		let data: Uint8Array | null = null;

		if (type === "S") {
			// GNU sparse: the header lists (offset, length) chunks of a larger file; only the chunks are stored.
			const realSize = octal(header, 483, 12);
			const chunks: Array<[number, number]> = [];
			const readMap = (block: Uint8Array, at: number, count: number) => {
				for (let i = 0; i < count; i++) {
					const start = octal(block, at + i * 24, 12);
					const length = octal(block, at + i * 24 + 12, 12);
					if (start !== 0 || length !== 0) chunks.push([start, length]);
				}
			};
			readMap(header, 386, 4);
			let extended = header[482] === 1;
			while (extended) {
				const more = tar.subarray(dataStart, dataStart + BLOCK);
				dataStart += BLOCK;
				readMap(more, 0, 21);
				extended = more[504] === 1;
			}
			if (entry === name) {
				const out = new Uint8Array(realSize);
				let at = dataStart;
				for (const [start, length] of chunks) {
					out.set(tar.subarray(at, at + length), start);
					at += length;
				}
				data = out;
			}
		} else if ((type === "0" || type === "\0") && entry === name) {
			data = tar.slice(dataStart, dataStart + stored);
		}
		if (data) return data;
		offset = dataStart + Math.ceil(stored / BLOCK) * BLOCK;
	}
	return null;
}

/** One named file from a downloaded archive, picked by format from the file name. */
export async function readFromArchive(
	archive: Uint8Array,
	archiveName: string,
	name: string
): Promise<Uint8Array | null> {
	if (archiveName.endsWith(".zip")) return readFromZip(archive, name);
	return readFromTar(await gunzip(archive), name);
}
