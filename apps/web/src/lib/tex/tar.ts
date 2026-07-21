const BLOCK = 512;

/** Offsets and widths of the header fields we read (POSIX ustar). */
const NAME = { at: 0, len: 100 } as const;
const SIZE = { at: 124, len: 12 } as const;
const TYPEFLAG = 156;
const MAGIC = { at: 257, len: 6 } as const;
const PREFIX = { at: 345, len: 155 } as const;

const decoder = new TextDecoder();

/** Read a NUL/space-terminated ASCII field. */
function str(block: Uint8Array, at: number, len: number): string {
	const raw = block.subarray(at, at + len);
	let end = raw.indexOf(0);
	if (end === -1) end = raw.length;
	return decoder.decode(raw.subarray(0, end)).replace(/[\s\0]+$/, '');
}

// Sizes are octal ASCII, except GNU's base-256 form flagged by the first byte's
// high bit; mis-reading one desynchronises every entry after it.
function size(block: Uint8Array): number {
	if ((block[SIZE.at] & 0x80) !== 0) {
		let n = 0;
		for (let i = SIZE.at + 1; i < SIZE.at + SIZE.len; i++) n = n * 256 + block[i];
		return n;
	}
	const text = str(block, SIZE.at, SIZE.len);
	return text === '' ? 0 : parseInt(text, 8);
}

/** A block of all zero bytes marks the end of the archive. */
function isZeroBlock(block: Uint8Array): boolean {
	for (let i = 0; i < block.length; i++) if (block[i] !== 0) return false;
	return true;
}

/**
 * Extract every regular file, keyed by bare name (the engine's VFS is flat).
 * Handles only the tar subset the bundle uses, not general archives.
 */
export function untar(archive: Uint8Array): Map<string, Uint8Array> {
	const files = new Map<string, Uint8Array>();
	let offset = 0;
	// Set by a preceding GNU long-name entry, consumed by the entry after it.
	let pendingName: string | null = null;

	while (offset + BLOCK <= archive.length) {
		const header = archive.subarray(offset, offset + BLOCK);
		offset += BLOCK;

		if (isZeroBlock(header)) break;

		const magic = str(header, MAGIC.at, MAGIC.len);
		if (magic !== 'ustar' && magic !== '') {
			throw new Error(`not a tar archive (bad magic "${magic}" at byte ${offset - BLOCK})`);
		}

		const length = size(header);
		// File data is padded up to a block boundary.
		const dataEnd = offset + Math.ceil(length / BLOCK) * BLOCK;
		const type = String.fromCharCode(header[TYPEFLAG] || 0x30);

		if (type === 'L') {
			// GNU long name: this entry's *body* is the name of the next entry.
			pendingName = decoder.decode(archive.subarray(offset, offset + length)).replace(/\0+$/, '');
			offset = dataEnd;
			continue;
		}

		// A GNU long name is already complete; the ustar `prefix` field only
		// joins onto a name that came from the header itself.
		let name: string;
		if (pendingName !== null) {
			name = pendingName;
			pendingName = null;
		} else {
			name = str(header, NAME.at, NAME.len);
			const prefix = str(header, PREFIX.at, PREFIX.len);
			if (prefix !== '') name = `${prefix}/${name}`;
		}

		// '0' and NUL are regular files; other types carry nothing the engine needs.
		if (type === '0' || type === '\0') {
			const flat = name.replace(/^\.\//, '').split('/').pop() ?? name;
			if (flat !== '') {
				// slice(), not subarray(): the entries outlive the archive buffer,
				// which we want the GC to reclaim once extraction finishes.
				files.set(flat, archive.slice(offset, offset + length));
			}
		}

		offset = dataEnd;
	}

	return files;
}

/** A gzip member always starts with these two bytes. */
const GZIP_MAGIC = [0x1f, 0x8b] as const;

function isGzipped(bytes: Uint8Array): boolean {
	return bytes.length >= 2 && bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1];
}

/**
 * Gunzip via `DecompressionStream`, passing plain tar through unchanged.
 * Sniffs magic bytes: servers may serve `.tar.gz` as `Content-Encoding: gzip`.
 */
export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
	if (!isGzipped(bytes)) return bytes;

	if (typeof DecompressionStream === 'undefined') {
		throw new Error('This browser cannot decompress the TeX bundle (no DecompressionStream).');
	}

	try {
		const stream = new Blob([bytes as BlobPart])
			.stream()
			.pipeThrough(new DecompressionStream('gzip'));
		return new Uint8Array(await new Response(stream).arrayBuffer());
	} catch (cause) {
		// A stream error surfaces from `Response` as a bare "Failed to fetch",
		// which reads like a network problem and sends debugging the wrong way.
		throw new Error('The TeX bundle is corrupt and could not be decompressed.', { cause });
	}
}
