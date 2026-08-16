import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CompileCache, signature } from './.build/compile-cache.mjs';

const f = (name, text) => ({ name, text });
const bin = (name, data) => ({ name, data });

test('identical files and entry produce the same signature', () => {
	const a = signature([f('main.tex', 'hello'), f('refs.bib', 'x')], 'main.tex');
	const b = signature([f('main.tex', 'hello'), f('refs.bib', 'x')], 'main.tex');
	assert.equal(a, b);
});

test('signature is independent of file order', () => {
	const a = signature([f('a.tex', '1'), f('b.tex', '2')], 'a.tex');
	const b = signature([f('b.tex', '2'), f('a.tex', '1')], 'a.tex');
	assert.equal(a, b);
});

test('a changed body changes the signature', () => {
	const a = signature([f('main.tex', 'hello')], 'main.tex');
	const b = signature([f('main.tex', 'hello!')], 'main.tex');
	assert.notEqual(a, b);
});

test('a changed entry changes the signature', () => {
	const files = [f('main.tex', 'x'), f('alt.tex', 'x')];
	assert.notEqual(signature(files, 'main.tex'), signature(files, 'alt.tex'));
});

test('renaming a file changes the signature even with identical content', () => {
	assert.notEqual(signature([f('a.tex', 'x')], 'a.tex'), signature([f('b.tex', 'x')], 'b.tex'));
});

test('a changed binary changes the signature', () => {
	const a = signature([f('main.tex', 'x'), bin('fig.png', new Uint8Array([1, 2, 3]))], 'main.tex');
	const b = signature([f('main.tex', 'x'), bin('fig.png', new Uint8Array([1, 2, 4]))], 'main.tex');
	assert.notEqual(a, b);
});

test('a swapped image of identical length is still detected', () => {
	// The length-only shortcut this deliberately avoids would collide here.
	const a = signature([bin('fig.png', new Uint8Array([9, 9, 9, 9]))], 'main.tex');
	const b = signature([bin('fig.png', new Uint8Array([9, 9, 9, 8]))], 'main.tex');
	assert.notEqual(a, b);
});

test('a text file and a binary file with matching bytes differ by name only', () => {
	// Same content under the same name must match; the point is the hash reads
	// bytes, not the text/data discriminant.
	const a = signature([f('x', 'AB')], 'x');
	const b = signature([bin('x', new Uint8Array([65, 66]))], 'x');
	assert.equal(a, b);
});

test('cache returns a stored value only for a matching signature', () => {
	const c = new CompileCache();
	c.set('doc1', 'sig-a', { pdf: 'PDF-A' });
	assert.deepEqual(c.get('doc1', 'sig-a'), { pdf: 'PDF-A' });
	assert.equal(c.get('doc1', 'sig-b'), undefined);
});

test('a new signature for the same doc replaces the old entry', () => {
	const c = new CompileCache();
	c.set('doc1', 'sig-a', { pdf: 'A' });
	c.set('doc1', 'sig-b', { pdf: 'B' });
	assert.equal(c.get('doc1', 'sig-a'), undefined);
	assert.deepEqual(c.get('doc1', 'sig-b'), { pdf: 'B' });
});

test('documents are cached independently', () => {
	const c = new CompileCache();
	c.set('doc1', 's', { pdf: '1' });
	c.set('doc2', 's', { pdf: '2' });
	assert.deepEqual(c.get('doc1', 's'), { pdf: '1' });
	assert.deepEqual(c.get('doc2', 's'), { pdf: '2' });
});

test('evicts the least-recently-set beyond the cap', () => {
	const c = new CompileCache(2);
	c.set('a', 's', 1);
	c.set('b', 's', 2);
	c.set('c', 's', 3); // evicts 'a'
	assert.equal(c.get('a', 's'), undefined);
	assert.equal(c.get('b', 's'), 2);
	assert.equal(c.get('c', 's'), 3);
});

test('re-setting a doc refreshes its recency', () => {
	const c = new CompileCache(2);
	c.set('a', 's', 1);
	c.set('b', 's', 2);
	c.set('a', 's2', 11); // 'a' is now most-recent
	c.set('c', 's', 3); // evicts 'b', not 'a'
	assert.equal(c.get('a', 's2'), 11);
	assert.equal(c.get('b', 's'), undefined);
	assert.equal(c.get('c', 's'), 3);
});

test('clear empties the cache', () => {
	const c = new CompileCache();
	c.set('a', 's', 1);
	c.clear();
	assert.equal(c.get('a', 's'), undefined);
});
