import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

import { parsePackIndex, resolveMissing, defaultPacks, PACK_INDEX_VERSION } from '../dist/index.js';

const PACK = {
	id: 'writing',
	label: 'Writing & page layout',
	description: 'Headers and footers.',
	packages: ['fancyhdr'],
	requires: [],
	optional: false,
	bytes: 1234,
	hash: 'abc123'
};

const INDEX = {
	version: PACK_INDEX_VERSION,
	packs: [PACK],
	provides: { 'fancyhdr.sty': 'writing', 'titlesec.sty': 'writing' }
};

/** A pack depending on another, as the builder emits for shared files. */
const DEP_INDEX = {
	version: PACK_INDEX_VERSION,
	packs: [
		{ ...PACK, id: 'science', label: 'Science', packages: ['physics'], requires: [] },
		{ ...PACK, id: 'tables', label: 'Tables', packages: ['nicematrix'], requires: ['science'] }
	],
	provides: { 'xparse.sty': 'science', 'nicematrix.sty': 'tables' }
};

describe('parsePackIndex', () => {
	test('accepts a well-formed index', () => {
		assert.equal(parsePackIndex(structuredClone(INDEX)).packs.length, 1);
	});

	test('rejects a version it does not understand', () => {
		// A future index could describe packs in a shape this build would silently
		// misread, so refuse rather than half-load it.
		assert.throws(() => parsePackIndex({ ...INDEX, version: 99 }), /Unsupported package index/);
	});

	test('rejects a malformed pack', () => {
		const bad = { ...INDEX, packs: [{ ...PACK, bytes: 'big' }] };
		assert.throws(() => parsePackIndex(bad), /malformed pack/);
	});

	test('rejects a file mapped to a pack that does not exist', () => {
		// Otherwise the UI offers an install for a pack it can never fetch.
		const bad = { ...INDEX, provides: { 'ghost.sty': 'nope' } };
		assert.throws(() => parsePackIndex(bad), /unknown pack/);
	});

	test('rejects non-objects', () => {
		assert.throws(() => parsePackIndex(null), /malformed/);
		assert.throws(() => parsePackIndex('index'), /malformed/);
	});
});

describe('resolveMissing', () => {
	test('names the pack that provides a missing file', () => {
		const { packs, unsupported } = resolveMissing(INDEX, ['fancyhdr.sty']);
		assert.deepEqual(
			packs.map((p) => p.id),
			['writing']
		);
		assert.deepEqual(unsupported, []);
	});

	test('deduplicates when several files come from one pack', () => {
		const { packs } = resolveMissing(INDEX, ['fancyhdr.sty', 'titlesec.sty']);
		assert.equal(packs.length, 1);
	});

	test('reports files no pack provides', () => {
		const { packs, unsupported } = resolveMissing(INDEX, ['nowhere.sty']);
		assert.deepEqual(packs, []);
		assert.deepEqual(unsupported, ['nowhere.sty']);
	});

	test('ignores the probe names TeX invents after a failed open', () => {
		// A real compile reports fancyhdr.sty alongside fancyhdr.sty.aux/.bbl/.clo.
		// Listing the probes tells the user packages they never asked for are
		// unavailable.
		const { packs, unsupported } = resolveMissing(INDEX, [
			'fancyhdr.sty',
			'fancyhdr.sty.aux',
			'fancyhdr.sty.bbl',
			'fancyhdr.sty.clo'
		]);
		assert.deepEqual(
			packs.map((p) => p.id),
			['writing']
		);
		assert.deepEqual(unsupported, []);
	});

	test('ignores the bounding-box probes graphicx makes beside an image', () => {
		// Observed from a real multi-file compile of \includegraphics{figures/fig.png}:
		// graphics probes figures/fig.bb with every package extension appended.
		const { packs, unsupported } = resolveMissing(INDEX, [
			'figures/fig.bb',
			'figures/fig.bb.sty',
			'figures/fig.bb.cls',
			'figures/fig.bb.tex',
			'sections/notes'
		]);
		assert.deepEqual(packs, []);
		assert.deepEqual(unsupported, []);
	});

	test('ignores engine-internal probes from a healthy compile', () => {
		// A document that compiles perfectly still reports these. Surfacing them
		// would put an "unavailable packages" warning on a successful build.
		const { packs, unsupported } = resolveMissing(INDEX, [
			'lmroman10-regular',
			'tex-text.tec',
			'main.aux'
		]);
		assert.deepEqual(packs, []);
		assert.deepEqual(unsupported, []);
	});

	test('still reports a genuinely unavailable package', () => {
		const { unsupported } = resolveMissing(INDEX, ['exotic.sty', 'weird.cls']);
		assert.deepEqual(unsupported, ['exotic.sty', 'weird.cls']);
	});

	test('does not offer a pack that is already installed', () => {
		// Re-offering an installed pack sends the user round a loop that cannot
		// fix anything; the file must be genuinely elsewhere.
		const { packs } = resolveMissing(INDEX, ['fancyhdr.sty'], [{ id: 'writing', hash: 'abc123' }]);
		assert.deepEqual(packs, []);
	});

	test('separates installable from unsupported in one pass', () => {
		const { packs, unsupported } = resolveMissing(INDEX, ['fancyhdr.sty', 'nowhere.sty']);
		assert.deepEqual(
			packs.map((p) => p.id),
			['writing']
		);
		assert.deepEqual(unsupported, ['nowhere.sty']);
	});

	test('no missing files means nothing to install', () => {
		const { packs, unsupported } = resolveMissing(INDEX, []);
		assert.deepEqual(packs, []);
		assert.deepEqual(unsupported, []);
	});

	test('pulls in a required pack', () => {
		// `tables` does not carry xparse.sty — it depends on `science` for it — so
		// installing `tables` alone would download successfully and still fail.
		const { packs } = resolveMissing(DEP_INDEX, ['nicematrix.sty']);
		assert.deepEqual(
			packs.map((p) => p.id),
			['science', 'tables']
		);
	});

	test('dependencies come before the packs that need them', () => {
		const { packs } = resolveMissing(DEP_INDEX, ['nicematrix.sty']);
		assert.ok(
			packs.findIndex((p) => p.id === 'science') < packs.findIndex((p) => p.id === 'tables')
		);
	});

	test('an installed dependency is not offered again', () => {
		const { packs } = resolveMissing(DEP_INDEX, ['nicematrix.sty'], [
			{ id: 'science', hash: 'abc123' }
		]);
		assert.deepEqual(
			packs.map((p) => p.id),
			['tables']
		);
	});

	test('defaults include every non-optional pack', () => {
		assert.deepEqual(
			defaultPacks(DEP_INDEX).map((p) => p.id),
			['science', 'tables']
		);
	});

	test('an optional pack is left out of the defaults', () => {
		const index = {
			...DEP_INDEX,
			packs: [DEP_INDEX.packs[0], { ...DEP_INDEX.packs[1], optional: true, requires: [] }]
		};
		assert.deepEqual(
			defaultPacks(index).map((p) => p.id),
			['science']
		);
	});

	test('a default pack drags in its optional dependency', () => {
		// Otherwise the install completes and the document still fails.
		const index = {
			...DEP_INDEX,
			packs: [{ ...DEP_INDEX.packs[0], optional: true }, DEP_INDEX.packs[1]]
		};
		assert.deepEqual(
			defaultPacks(index).map((p) => p.id),
			['science', 'tables']
		);
	});

	test('rejects a dependency on a pack that does not exist', () => {
		const bad = {
			...DEP_INDEX,
			packs: [{ ...PACK, requires: ['ghost'] }],
			provides: { 'fancyhdr.sty': 'writing' }
		};
		assert.throws(() => parsePackIndex(bad), /requires unknown pack/);
	});
});
