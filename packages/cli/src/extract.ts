import { inflateRawSync } from "node:zlib";
import { unpackTarGz } from "glyphtex-engine";

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

/** One named file from a downloaded archive, picked by format from the file name. */
export async function readFromArchive(
	archive: Uint8Array,
	archiveName: string,
	name: string
): Promise<Uint8Array | null> {
	if (archiveName.endsWith(".zip")) return readFromZip(archive, name);
	const files = await unpackTarGz(archive);
	for (const [path, data] of files) if (leaf(path) === name) return data;
	return null;
}
