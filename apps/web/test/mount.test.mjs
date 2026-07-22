import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { emptyMount, mountDocument, shadowsBundle } from './.build/tex/mount.mjs';

/** Records what a real engine would be asked to do to its flat filesystem. */
function fakeEngine(present = []) {
	const files = new Set(present);
	const calls = { removed: [], added: [], clearedOutputs: 0 };
	return {
		files,
		calls,
		addFile(name) {
			files.add(name);
			calls.added.push(name);
		},
		removeFile(name) {
			calls.removed.push(name);
			return files.delete(name);
		},
		clearOutputs() {
			calls.clearedOutputs++;
		}
	};
}

const doc = (...names) => names.map((name) => ({ name, text: '' }));

describe('mountDocument', () => {
	test('mounts a document into an empty engine', () => {
		const engine = fakeEngine();
		const state = mountDocument(engine, emptyMount(), 'a', doc('main.tex', 'refs.bib'));

		assert.deepEqual(engine.calls.added, ['main.tex', 'refs.bib']);
		assert.deepEqual(engine.calls.removed, []);
		assert.equal(state.doc, 'a');
	});

	// The reported bug: opening a second project showed the first one's warnings.
	test('switching documents unmounts the previous files', () => {
		const engine = fakeEngine();
		let state = mountDocument(engine, emptyMount(), 'a', doc('main.tex', 'chapters.tex', 'refs.bib'));

		state = mountDocument(engine, state, 'b', doc('main.tex'));

		assert.deepEqual(state.files, new Set(['main.tex']));
		assert.equal(engine.files.has('chapters.tex'), false);
		assert.equal(engine.files.has('refs.bib'), false);
	});

	// Both documents use main.tex, so a kept .aux is read as this document's own.
	test('switching documents clears the previous outputs', () => {
		const engine = fakeEngine();
		let state = mountDocument(engine, emptyMount(), 'a', doc('main.tex'));
		assert.equal(engine.calls.clearedOutputs, 1, 'first mount starts cold');

		mountDocument(engine, state, 'b', doc('main.tex'));
		assert.equal(engine.calls.clearedOutputs, 2, 'a different document starts cold too');
	});

	// Outputs are what let a recompile converge before maxPasses.
	test('recompiling the same document keeps its outputs', () => {
		const engine = fakeEngine();
		let state = mountDocument(engine, emptyMount(), 'a', doc('main.tex'));
		const cleared = engine.calls.clearedOutputs;

		mountDocument(engine, state, 'a', doc('main.tex'));

		assert.equal(engine.calls.clearedOutputs, cleared);
		assert.deepEqual(engine.calls.removed, []);
	});

	test('a file deleted from the same document is unmounted', () => {
		const engine = fakeEngine();
		const state = mountDocument(engine, emptyMount(), 'a', doc('main.tex', 'old.tex'));

		mountDocument(engine, state, 'a', doc('main.tex'));

		assert.deepEqual(engine.calls.removed, ['old.tex']);
		assert.equal(engine.files.has('old.tex'), false);
	});
});

describe('shadowsBundle', () => {
	const bundle = new Set(['article.cls', 'amsmath.sty']);

	test('is false while the document has not changed', () => {
		const state = { doc: 'a', files: new Set(['article.cls']) };
		assert.equal(shadowsBundle(state, bundle, 'a'), false);
	});

	test('is false when the outgoing document shadowed nothing', () => {
		const state = { doc: 'a', files: new Set(['main.tex']) };
		assert.equal(shadowsBundle(state, bundle, 'b'), false);
	});

	// Removing this name would delete the bundle's copy, not restore it.
	test('is true when the outgoing document shadowed a bundle file', () => {
		const state = { doc: 'a', files: new Set(['main.tex', 'article.cls']) };
		assert.equal(shadowsBundle(state, bundle, 'b'), true);
	});
});
