import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerLatexSemanticTokens } from './.build/editor.mjs';
import { setWorkspaceFiles, clearWorkspace } from './.build/editor.mjs';

const TOKEN_TYPES = ['macro', 'unknownMacro', 'danglingRef', 'resolvedRef'];

let provider = null;
const monaco = {
	languages: {
		registerDocumentSemanticTokensProvider: (_id, p) => {
			provider = p;
			return { dispose() {} };
		},
	},
};
registerLatexSemanticTokens(monaco);

function makeModel(text) {
	const lines = text.split('\n');
	return {
		getValue: () => text,
		getPositionAt: (offset) => {
			let remaining = offset;
			for (let i = 0; i < lines.length; i++) {
				if (remaining <= lines[i].length) return { lineNumber: i + 1, column: remaining + 1 };
				remaining -= lines[i].length + 1;
			}
			return { lineNumber: lines.length, column: lines[lines.length - 1].length + 1 };
		},
	};
}

// Decode Monaco's delta encoding (5 ints/token, each relative to the previous)
// to absolute positions: an off-by-one looks fine raw but paints wrong characters.
function tokensOf(text) {
	const model = makeModel(text);
	const { data } = provider.provideDocumentSemanticTokens(model);
	const lines = text.split('\n');

	const out = [];
	let line = 0;
	let column = 0;
	for (let i = 0; i < data.length; i += 5) {
		const deltaLine = data[i];
		const deltaColumn = data[i + 1];
		line += deltaLine;
		column = deltaLine === 0 ? column + deltaColumn : deltaColumn;
		out.push({
			line: line + 1,
			column: column + 1,
			length: data[i + 2],
			type: TOKEN_TYPES[data[i + 3]],
			text: lines[line].slice(column, column + data[i + 2]),
		});
	}
	return out;
}

beforeEach(() => clearWorkspace());

describe('semantic tokens', () => {
	test('flags a command nothing defines', () => {
		const tokens = tokensOf('\\reff{x} and \\frac{1}{2}');
		const unknown = tokens.filter((t) => t.type === 'unknownMacro');
		assert.deepEqual(unknown.map((t) => t.text), ['\\reff']);
	});

	test('marks a user-defined macro, and stops calling it unknown', () => {
		const tokens = tokensOf('\\newcommand{\\myvec}[1]{\\mathbf{#1}}\nUse \\myvec{x}.');
		const macros = tokens.filter((t) => t.type === 'macro');
		assert.ok(macros.length >= 1, 'the macro should be marked');
		assert.deepEqual([...new Set(macros.map((t) => t.text))], ['\\myvec']);
		assert.equal(tokens.filter((t) => t.text === '\\myvec' && t.type === 'unknownMacro').length, 0);
	});

	test('token text lines up with the source after a comment', () => {
		// Comments are blanked, not removed; removing them slides later offsets left.
		const tokens = tokensOf('% a long comment that would shift things\n\\reff{a}');
		const unknown = tokens.find((t) => t.type === 'unknownMacro');
		assert.equal(unknown.text, '\\reff', 'decoded text must match the real source');
		assert.equal(unknown.line, 2);
		assert.equal(unknown.column, 1);
	});

	test('offsets stay aligned across several comments', () => {
		const text = [
			'% first comment',
			'\\alpha',
			'% second, rather longer, comment',
			'\\badcmd',
			'% third',
			'\\alsobad',
		].join('\n');
		for (const token of tokensOf(text)) {
			// Starting with a backslash in the real source is the cheapest alignment proof.
			assert.ok(token.text.startsWith('\\'), `misaligned token: ${JSON.stringify(token)}`);
		}
	});

	test('ignores a command that only appears in a comment', () => {
		const tokens = tokensOf('% \\reff is mentioned here only\n\\frac{1}{2}');
		assert.equal(tokens.filter((t) => t.type === 'unknownMacro').length, 0);
	});

	test('resolves a ref against a label in the document', () => {
		const tokens = tokensOf('\\label{sec:a}\nSee \\ref{sec:a} and \\ref{sec:missing}.');
		const resolved = tokens.filter((t) => t.type === 'resolvedRef');
		const dangling = tokens.filter((t) => t.type === 'danglingRef');
		assert.deepEqual(resolved.map((t) => t.text), ['sec:a']);
		assert.deepEqual(dangling.map((t) => t.text), ['sec:missing']);
	});

	test('resolves a ref against a label in another project file', () => {
		setWorkspaceFiles([{ path: 'chapter2.tex', content: '\\label{sec:elsewhere}' }]);
		const tokens = tokensOf('See \\ref{sec:elsewhere}.');
		assert.deepEqual(
			tokens.filter((t) => t.type === 'resolvedRef').map((t) => t.text),
			['sec:elsewhere'],
		);
	});

	test('says nothing about refs when no labels are known at all', () => {
		// Otherwise a fresh single file lights up every \ref in warning colour.
		const tokens = tokensOf('See \\ref{nothing:indexed}.');
		assert.equal(tokens.filter((t) => t.type === 'danglingRef').length, 0);
	});

	test('judges each key in a multi-key cite separately', () => {
		setWorkspaceFiles([{ path: 'refs.bib', content: '@book{good, title={G}}' }]);
		const tokens = tokensOf('\\cite{good,bad}');
		assert.deepEqual(
			tokens.filter((t) => t.type === 'resolvedRef').map((t) => t.text),
			['good'],
		);
		assert.deepEqual(
			tokens.filter((t) => t.type === 'danglingRef').map((t) => t.text),
			['bad'],
		);
	});

	test('emits strictly increasing positions', () => {
		// Monaco's decoder assumes sorted input; unsorted data silently paints
		// garbage rather than throwing.
		const tokens = tokensOf('\\badone\n\\label{a}\n\\ref{a} \\badtwo \\ref{missing}');
		for (let i = 1; i < tokens.length; i++) {
			const before = tokens[i - 1];
			const now = tokens[i];
			assert.ok(
				now.line > before.line || (now.line === before.line && now.column >= before.column),
				`out of order at ${i}: ${JSON.stringify([before, now])}`,
			);
		}
	});
});
