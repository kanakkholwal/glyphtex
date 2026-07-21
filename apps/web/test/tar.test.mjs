// The TeX bundle reader.
//
// The gunzip cases here are a regression guard for a bug that shipped: servers
// commonly map `.tar.gz` to `Content-Encoding: gzip`, so the browser decompresses
// the body before we ever see it, and gunzipping again fails. The failure
// surfaced from `Response` as a bare "Failed to fetch", which reads like a
// network problem and cost a long time to trace.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { gunzip, untar } from './.build/tex/tar.mjs';

/** Build a minimal, valid tar archive in memory. */
function makeTar(entries) {
	const blocks = [];
	for (const [name, content] of entries) {
		const data = Buffer.from(content, 'utf8');
		const header = Buffer.alloc(512);
		header.write(name, 0, 100, 'ascii');
		header.write('000644 \0', 100, 8, 'ascii'); // mode
		header.write('000000 \0', 108, 8, 'ascii'); // uid
		header.write('000000 \0', 116, 8, 'ascii'); // gid
		header.write(data.length.toString(8).padStart(11, '0') + ' ', 124, 12, 'ascii');
		header.write('00000000000 ', 136, 12, 'ascii'); // mtime
		header.write('        ', 148, 8, 'ascii'); // checksum placeholder
		header.write('0', 156, 1, 'ascii'); // regular file
		header.write('ustar\0', 257, 6, 'ascii');
		header.write('00', 263, 2, 'ascii');

		// Checksum is the sum of all header bytes with the field read as spaces.
		let sum = 0;
		for (const byte of header) sum += byte;
		header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');

		blocks.push(header);
		const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512);
		data.copy(padded);
		blocks.push(padded);
	}
	blocks.push(Buffer.alloc(1024)); // end-of-archive
	return new Uint8Array(Buffer.concat(blocks));
}

describe('gunzip', () => {
	test('decompresses genuinely gzipped bytes', async () => {
		const original = makeTar([['a.sty', 'hello']]);
		const gzipped = new Uint8Array(gzipSync(Buffer.from(original)));
		// Sanity: the fixture really is gzip.
		assert.equal(gzipped[0], 0x1f);
		assert.equal(gzipped[1], 0x8b);

		const out = await gunzip(gzipped);
		assert.deepEqual(Array.from(out), Array.from(original));
	});

	test('passes through bytes the transport already decompressed', async () => {
		// This is what a server sending `Content-Encoding: gzip` produces: by the
		// time it reaches us it is plain tar, and is indistinguishable from a
		// response that was never compressed.
		const plain = makeTar([['b.cls', 'world']]);
		const out = await gunzip(plain);
		assert.deepEqual(Array.from(out), Array.from(plain));
	});

	test('passes through empty input rather than throwing', async () => {
		assert.equal((await gunzip(new Uint8Array(0))).byteLength, 0);
	});
});

describe('untar', () => {
	test('extracts files by bare name', async () => {
		const files = untar(
			makeTar([
				['amsmath.sty', 'AMS'],
				['article.cls', 'ART']
			])
		);
		assert.deepEqual([...files.keys()].sort(), ['amsmath.sty', 'article.cls']);
		assert.equal(new TextDecoder().decode(files.get('amsmath.sty')), 'AMS');
	});

	test('strips the leading ./ the bundle stores', async () => {
		// The real bundle records every entry as `./name`, but the engine's
		// virtual filesystem is flat and looks files up bare.
		const files = untar(makeTar([['./nested.sty', 'X']]));
		assert.ok(files.has('nested.sty'), `got ${[...files.keys()]}`);
	});

	test('round-trips through gzip', async () => {
		const archive = makeTar([
			['one.sty', 'first'],
			['two.sty', 'second']
		]);
		const files = untar(await gunzip(new Uint8Array(gzipSync(Buffer.from(archive)))));
		assert.equal(files.size, 2);
		assert.equal(new TextDecoder().decode(files.get('two.sty')), 'second');
	});

	test('returns nothing for an empty archive', () => {
		assert.equal(untar(new Uint8Array(1024)).size, 0);
	});
});
