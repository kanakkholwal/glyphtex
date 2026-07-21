import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseBib, describeEntry } from './.build/editor.mjs';

describe('parseBib', () => {
	test('reads key, type and display fields', () => {
		const [entry] = parseBib(`
			@article{knuth1984,
				title = {The {TeX}book},
				author = {Knuth, Donald E.},
				year = {1984},
				publisher = {Addison-Wesley}
			}
		`);
		assert.equal(entry.key, 'knuth1984');
		assert.equal(entry.type, 'article');
		assert.equal(entry.title, 'The TeXbook');
		assert.equal(entry.author, 'Knuth, Donald E.');
		assert.equal(entry.year, '1984');
	});

	test('handles nested braces in a value', () => {
		const [entry] = parseBib('@book{a, title = {A {Nested {Deeply}} Title}}');
		assert.equal(entry.title, 'A Nested Deeply Title');
	});

	test('handles quoted values', () => {
		const [entry] = parseBib('@book{a, title = "Quoted Title", year = 1999}');
		assert.equal(entry.title, 'Quoted Title');
		assert.equal(entry.year, '1999');
	});

	test('reads several entries', () => {
		const entries = parseBib(`
			@book{one, title={First}}
			@inproceedings{two, title={Second}}
			@misc{three, title={Third}}
		`);
		assert.deepEqual(entries.map((e) => e.key), ['one', 'two', 'three']);
		assert.deepEqual(entries.map((e) => e.type), ['book', 'inproceedings', 'misc']);
	});

	test('skips @comment, @preamble and @string', () => {
		const entries = parseBib(`
			@string{acm = "ACM Press"}
			@comment{this is ignored}
			@preamble{"\\\\newcommand{\\\\x}{y}"}
			@book{real, title={Real}}
		`);
		assert.deepEqual(entries.map((e) => e.key), ['real']);
	});

	test('takes the year out of a biblatex date field', () => {
		const [entry] = parseBib('@article{a, date = {2021-03-14}}');
		assert.equal(entry.year, '2021');
	});

	test('falls back to booktitle and editor', () => {
		const [entry] = parseBib('@inproceedings{a, booktitle={Proceedings}, editor={Smith, J.}}');
		assert.equal(entry.title, 'Proceedings');
		assert.equal(entry.author, 'Smith, J.');
	});

	test('survives a half-typed entry without throwing', () => {
		const entries = parseBib('@book{done, title={Done}}\n@article{halfway, title = {Unclosed');
		assert.equal(entries.length, 2);
		assert.equal(entries[0].key, 'done');
		assert.equal(entries[1].key, 'halfway');
	});

	test('ignores stray @ signs and junk', () => {
		const entries = parseBib('email me @ nowhere. @@ @notanentry no braces @book{ok, title={OK}}');
		assert.deepEqual(entries.map((e) => e.key), ['ok']);
	});

	test('returns nothing for empty or field-less input', () => {
		assert.deepEqual(parseBib(''), []);
		assert.deepEqual(parseBib('no entries here'), []);
	});

	test('records the source file', () => {
		const [entry] = parseBib('@book{a, title={T}}', 'refs.bib');
		assert.equal(entry.source, 'refs.bib');
	});
});

describe('describeEntry', () => {
	test('combines title, author and year', () => {
		assert.equal(
			describeEntry({ key: 'k', type: 'book', title: 'The TeXbook', author: 'Knuth, Donald E.', year: '1984' }),
			'The TeXbook — Knuth, 1984',
		);
	});

	test('abbreviates multiple authors', () => {
		assert.equal(
			describeEntry({ key: 'k', type: 'book', title: 'T', author: 'Knuth, D. and Lamport, L.' }),
			'T — Knuth et al.',
		);
	});

	test('degrades to whatever it has', () => {
		assert.equal(describeEntry({ key: 'k', type: 'misc' }), 'misc');
		assert.equal(describeEntry({ key: 'k', type: 'misc', title: 'Only Title' }), 'Only Title');
	});
});
