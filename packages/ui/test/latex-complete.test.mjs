import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { registerLatexCompletions } from './.build/editor.mjs';

// Stub monaco namespace: only what the provider actually touches.
let completionProvider = null;
let hoverProvider = null;

const monaco = {
	languages: {
		CompletionItemKind: { Function: 1, Constant: 2, Struct: 3, Reference: 4, Value: 5, Module: 6, Class: 7 },
		CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
		registerCompletionItemProvider: (_id, p) => { completionProvider = p; return { dispose() {} }; },
		registerHoverProvider: (_id, p) => { hoverProvider = p; return { dispose() {} }; },
	},
};

function makeModel(text) {
	const lines = text.split('\n');
	const offsetOf = (lineNumber, column) => {
		let o = 0;
		for (let i = 0; i < lineNumber - 1; i++) o += lines[i].length + 1;
		return o + column - 1;
	};
	return {
		getValue: () => text,
		getVersionId: () => 1,
		getLineCount: () => lines.length,
		getLineContent: (n) => lines[n - 1],
		getLineMaxColumn: (n) => lines[n - 1].length + 1,
		getOffsetAt: ({ lineNumber, column }) => offsetOf(lineNumber, column),
		getPositionAt: (offset) => {
			let remaining = offset;
			for (let i = 0; i < lines.length; i++) {
				if (remaining <= lines[i].length) return { lineNumber: i + 1, column: remaining + 1 };
				remaining -= lines[i].length + 1;
			}
			return { lineNumber: lines.length, column: lines[lines.length - 1].length + 1 };
		},
		getValueInRange: ({ startLineNumber, startColumn, endLineNumber, endColumn }) =>
			text.slice(offsetOf(startLineNumber, startColumn), offsetOf(endLineNumber, endColumn)),
	};
}

registerLatexCompletions(monaco);

const DOC = `\\documentclass{article}
\\usepackage{amsmath}
\\newcommand{\\myvec}[1]{\\mathbf{#1}}
\\begin{document}
\\section{Introduction}
\\label{sec:intro}
Prior work \\cite{knuth1984} is relevant.
\\begin{equation}
\\label{eq:main}
E = mc^2
\\end{equation}
`;

function completeAfter(fragment) {
	const text = DOC + fragment;
	const model = makeModel(text);
	const lines = text.split('\n');
	const position = { lineNumber: lines.length, column: lines[lines.length - 1].length + 1 };
	const result = completionProvider.provideCompletionItems(model, position);
	return result.suggestions;
}

const labelsOf = (items) => items.map((i) => i.label);

describe('LaTeX completion', () => {
	test('\\ref{ offers labels defined in the document', () => {
		const labels = labelsOf(completeAfter('See \\ref{'));
		assert.ok(labels.includes('sec:intro'), `expected sec:intro, got ${labels}`);
		assert.ok(labels.includes('eq:main'), `expected eq:main, got ${labels}`);
		assert.equal(labels.length, 2, 'should offer only labels');
	});

	test('\\cite{ offers keys already cited', () => {
		const labels = labelsOf(completeAfter('Also \\cite{'));
		assert.deepEqual(labels, ['knuth1984']);
	});

	test('\\begin{ offers environments and closes them', () => {
		const items = completeAfter('\\begin{');
		const itemize = items.find((i) => i.label === 'itemize');
		assert.ok(itemize, 'itemize should be offered');
		assert.match(itemize.insertText, /^itemize\}/, 'should close the opening brace');
		assert.match(itemize.insertText, /\\end\{itemize\}$/, 'should insert the matching \\end');
		assert.equal(itemize.insertTextRules, 4, 'should insert as a snippet');
	});

	test('\\end{ offers only the bare name', () => {
		const items = completeAfter('\\end{');
		const itemize = items.find((i) => i.label === 'itemize');
		assert.equal(itemize.insertText, 'itemize');
		assert.equal(itemize.insertTextRules, undefined);
	});

	test('a partial command offers commands, replacing from the backslash', () => {
		const items = completeAfter('\\fra');
		const frac = items.find((i) => i.label === '\\frac');
		assert.ok(frac, 'frac should be offered');
		assert.equal(frac.insertText, '\\frac{$1}{$2}$0');
		// Range must cover "\fra" (4 chars) or the insert reads "\fra\frac".
		assert.equal(frac.range.endColumn - frac.range.startColumn, 4);
		assert.equal(frac.filterText, '\\frac');
	});

	test('user-defined \\newcommand is offered', () => {
		const labels = labelsOf(completeAfter('\\myv'));
		assert.ok(labels.includes('\\myvec'), 'should pick up \\newcommand{\\myvec}');
	});

	test('\\usepackage{ offers packages, \\documentclass{ offers classes', () => {
		assert.ok(labelsOf(completeAfter('\\usepackage{')).includes('graphicx'));
		assert.ok(labelsOf(completeAfter('\\documentclass{')).includes('beamer'));
		assert.ok(!labelsOf(completeAfter('\\documentclass{')).includes('graphicx'));
	});

	test('math context ranks math commands above text ones', () => {
		const inMath = completeAfter('$x = \\al');
		const alpha = inMath.find((i) => i.label === '\\alpha');
		assert.ok(alpha, 'alpha should be offered');
		assert.match(alpha.sortText, /^0/, 'math command should rank first inside math');

		const inText = completeAfter('Plain text \\al');
		const alphaText = inText.find((i) => i.label === '\\alpha');
		assert.match(alphaText.sortText, /^1/, 'math command should rank lower outside math');
	});

	test('escaped dollar does not fool the math heuristic', () => {
		const items = completeAfter('Costs \\$5 and \\al');
		const alpha = items.find((i) => i.label === '\\alpha');
		assert.match(alpha.sortText, /^1/, '\\$ is not a math delimiter');
	});

	test('plain prose offers nothing', () => {
		assert.equal(completeAfter('just some words ').length, 0);
	});
});

describe('LaTeX hover', () => {
	test('describes the command under the cursor', () => {
		const model = makeModel('We use \\frac{1}{2} here.');
		const hover = hoverProvider.provideHover(model, { lineNumber: 1, column: 11 });
		assert.ok(hover, 'should return a hover');
		assert.match(hover.contents[0].value, /\\frac/);
	});

	test('returns nothing over plain words', () => {
		const model = makeModel('We use \\frac{1}{2} here.');
		assert.equal(hoverProvider.provideHover(model, { lineNumber: 1, column: 2 }), null);
	});
});
