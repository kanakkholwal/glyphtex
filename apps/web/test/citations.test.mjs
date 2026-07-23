import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

import { needsBiber, needsBibliographyProcessor } from './.build/citations.mjs';

// The engine runs BibTeX itself, so the only unsupported case left is biblatex
// on its default backend — Biber is Perl and has no wasm build.
describe('needsBiber', () => {
	test('a manual thebibliography document needs nothing', () => {
		const source = String.raw`\documentclass{article}
\begin{document}
See \cite{knuth}.
\begin{thebibliography}{9}
  \bibitem{knuth} Knuth, \emph{The TeXbook}.
\end{thebibliography}
\end{document}`;
		assert.equal(needsBiber(source), false);
	});

	test('plain \\cite alone needs nothing', () => {
		assert.equal(needsBiber(String.raw`\cite{a} \citep{b} \citet{c}`), false);
	});

	test('classic BibTeX is supported, so no notice', () => {
		const source = String.raw`\bibliographystyle{plain}
\bibliography{refs}`;
		assert.equal(needsBiber(source), false);
	});

	test('natbib is supported, so no notice', () => {
		assert.equal(needsBiber(String.raw`\usepackage{natbib}\bibliography{refs}`), false);
	});

	test('biblatex on its default backend needs Biber', () => {
		const source = String.raw`\usepackage{biblatex}
\addbibresource{refs.bib}
\printbibliography`;
		assert.equal(needsBiber(source), true);
	});

	test('biblatex with unrelated options still needs Biber', () => {
		assert.equal(needsBiber(String.raw`\usepackage[style=authoryear]{biblatex}`), true);
	});

	test('backend=bibtex is supported, so no notice', () => {
		assert.equal(needsBiber(String.raw`\usepackage[backend=bibtex]{biblatex}`), false);
	});

	test('backend=bibtex among other options is recognised', () => {
		assert.equal(
			needsBiber(String.raw`\usepackage[style=numeric,backend=bibtex]{biblatex}`),
			false
		);
	});

	test('the backend may be passed ahead of the package', () => {
		const source = String.raw`\PassOptionsToPackage{backend=bibtex}{biblatex}
\usepackage{biblatex}`;
		assert.equal(needsBiber(source), false);
	});

	// \addbibresource and \printbibliography are biblatex's own commands, but on
	// their own they say nothing about the backend — the \usepackage line does.
	test('biblatex commands without the package load are not a Biber signal', () => {
		assert.equal(needsBiber(String.raw`\addbibresource{refs.bib}\printbibliography`), false);
	});

	test('commented-out package loads are ignored', () => {
		assert.equal(needsBiber('% \\usepackage{biblatex}'), false);
		assert.equal(needsBiber('  %\\usepackage{biblatex}'), false);
	});

	test('an escaped percent does not start a comment', () => {
		assert.equal(needsBiber(String.raw`100\% \usepackage{biblatex}`), true);
	});

	test('needsBibliographyProcessor tracks needsBiber', () => {
		assert.equal(needsBibliographyProcessor(String.raw`\usepackage{biblatex}`), true);
		assert.equal(needsBibliographyProcessor(String.raw`\bibliography{refs}`), false);
	});
});
