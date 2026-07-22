// Built on the platform's own compression streams so import/export needs no
// dependency. Stored (0) and deflate (8) only — what real-world archives use.
const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const ZIP64_LOCATOR_SIG = 0x07064b50;

export type ZipEntry = { path: string; data: Uint8Array };

export class ZipError extends Error {
	constructor(
		message: string,
		readonly cause?: unknown
	) {
		super(message);
		this.name = 'ZipError';
	}
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
	if (typeof DecompressionStream === 'undefined') {
		throw new ZipError('This browser cannot decompress .zip files.');
	}
	try {
		const stream = new Blob([bytes as BlobPart])
			.stream()
			.pipeThrough(new DecompressionStream('deflate-raw'));
		return new Uint8Array(await new Response(stream).arrayBuffer());
	} catch (cause) {
		throw new ZipError('A file inside the .zip is corrupt.', cause);
	}
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([bytes as BlobPart])
		.stream()
		.pipeThrough(new CompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Locates the end-of-central-directory record, which trails any comment. */
function findEocd(view: DataView): number {
	const max = Math.min(view.byteLength, 0xffff + 22);
	for (let i = 22; i <= max; i++) {
		const at = view.byteLength - i;
		if (view.getUint32(at, true) === EOCD_SIG) return at;
	}
	throw new ZipError('That file is not a .zip archive.');
}

export async function readZip(bytes: Uint8Array): Promise<ZipEntry[]> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const eocd = findEocd(view);

	// Zip64 keeps the real counts in a separate record; the 32-bit fields are
	// saturated. Rejecting is honest — silently reading 65535 entries is not.
	if (view.getUint32(eocd - 20, true) === ZIP64_LOCATOR_SIG) {
		throw new ZipError('Zip64 archives are not supported yet.');
	}

	const count = view.getUint16(eocd + 10, true);
	let at = view.getUint32(eocd + 16, true);
	const entries: ZipEntry[] = [];
	const decoder = new TextDecoder();

	for (let i = 0; i < count; i++) {
		if (view.getUint32(at, true) !== CENTRAL_SIG) {
			throw new ZipError('The .zip directory is damaged.');
		}
		const method = view.getUint16(at + 10, true);
		const compressedSize = view.getUint32(at + 20, true);
		const nameLen = view.getUint16(at + 28, true);
		const extraLen = view.getUint16(at + 30, true);
		const commentLen = view.getUint16(at + 32, true);
		const localAt = view.getUint32(at + 42, true);
		const path = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
		at += 46 + nameLen + extraLen + commentLen;

		// Directory markers carry no content.
		if (path.endsWith('/')) continue;

		if (view.getUint32(localAt, true) !== LOCAL_SIG) {
			throw new ZipError(`"${path}" is damaged inside the .zip.`);
		}
		// The local header's own name/extra lengths are authoritative; they can
		// differ from the central directory's.
		const localNameLen = view.getUint16(localAt + 26, true);
		const localExtraLen = view.getUint16(localAt + 28, true);
		const start = localAt + 30 + localNameLen + localExtraLen;
		const raw = bytes.subarray(start, start + compressedSize);

		if (method === 0) entries.push({ path, data: raw.slice() });
		else if (method === 8) entries.push({ path, data: await inflateRaw(raw) });
		else throw new ZipError(`"${path}" uses an unsupported compression method.`);
	}

	return entries;
}

// PKZIP's own table-driven CRC-32, required by the format.
const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[i] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array): number {
	let c = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

export async function writeZip(entries: ZipEntry[]): Promise<Uint8Array> {
	const encoder = new TextEncoder();
	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;

	for (const entry of entries) {
		const name = encoder.encode(entry.path);
		const crc = crc32(entry.data);
		const deflated = await deflateRaw(entry.data);
		// Never let "compression" grow a file.
		const useDeflate = deflated.byteLength < entry.data.byteLength;
		const body = useDeflate ? deflated : entry.data;
		const method = useDeflate ? 8 : 0;

		const local = new Uint8Array(30 + name.length + body.length);
		const lv = new DataView(local.buffer);
		lv.setUint32(0, LOCAL_SIG, true);
		lv.setUint16(4, 20, true); // version needed
		lv.setUint16(6, 0, true); // flags
		lv.setUint16(8, method, true);
		lv.setUint32(14, crc, true);
		lv.setUint32(18, body.length, true);
		lv.setUint32(22, entry.data.length, true);
		lv.setUint16(26, name.length, true);
		local.set(name, 30);
		local.set(body, 30 + name.length);
		locals.push(local);

		const central = new Uint8Array(46 + name.length);
		const cv = new DataView(central.buffer);
		cv.setUint32(0, CENTRAL_SIG, true);
		cv.setUint16(4, 20, true); // version made by
		cv.setUint16(6, 20, true); // version needed
		cv.setUint16(10, method, true);
		cv.setUint32(16, crc, true);
		cv.setUint32(20, body.length, true);
		cv.setUint32(24, entry.data.length, true);
		cv.setUint16(28, name.length, true);
		cv.setUint32(42, offset, true);
		central.set(name, 46);
		centrals.push(central);

		offset += local.length;
	}

	const centralSize = centrals.reduce((n, c) => n + c.length, 0);
	const eocd = new Uint8Array(22);
	const ev = new DataView(eocd.buffer);
	ev.setUint32(0, EOCD_SIG, true);
	ev.setUint16(8, entries.length, true);
	ev.setUint16(10, entries.length, true);
	ev.setUint32(12, centralSize, true);
	ev.setUint32(16, offset, true);

	const total = offset + centralSize + eocd.length;
	const out = new Uint8Array(total);
	let at = 0;
	for (const part of [...locals, ...centrals, eocd]) {
		out.set(part, at);
		at += part.length;
	}
	return out;
}
