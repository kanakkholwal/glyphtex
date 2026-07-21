import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

import { citationCommands, needsBibliographyProcessor } from './.build/citations.mjs';

describe('needsBibliographyProcessor', () => {
	test('a manual thebibliography document does NOT warn', () => {
		// This compiles correctly today — no external processor is involved, and
		// warning about it would be wrong for anyone writing references by hand.
		const source = String.raw`\documentclass{article}
\begin{document}
See \cite{knuth}.
\begin{thebibliography}{9}
  \bibitem{knuth} Knuth, \emph{The TeXbook}.
\end{thebibliography}
\end{document}`;
		assert.equal(needsBibliographyProcessor(source), false);
	});

	test('plain \\cite alone does not warn', () => {
		assert.equal(needsBibliographyProcessor(String.raw`\cite{a} \citep{b} \citet{c}`), false);
	});

	test('BibTeX commands warn', () => {
		const source = String.raw`\bibliographystyle{plain}
\bibliography{refs}`;
		assert.deepEqual(citationCommands(source).sort(), ['\\bibliography', '\\bibliographystyle']);
	});

	test('biblatex commands warn', () => {
		const source = String.raw`\addbibresource{refs.bib}
\printbibliography`;
		assert.deepEqual(citationCommands(source).sort(), ['\\addbibresource', '\\printbibliography']);
	});

	test('bare \\printbibliography is detected', () => {
		// It takes no argument, so a detector keyed on a following `{` misses the
		// most common biblatex usage entirely.
		assert.equal(needsBibliographyProcessor(String.raw`\printbibliography`), true);
	});

	test('\\bibliographystyle is not mistaken for \\bibliography', () => {
		assert.deepEqual(citationCommands(String.raw`\bibliographystyle{plain}`), [
			'\\bibliographystyle'
		]);
	});

	test('commented-out commands are ignored', () => {
		assert.equal(needsBibliographyProcessor('% \\bibliography{refs}'), false);
		assert.equal(needsBibliographyProcessor('  %\\addbibresource{refs.bib}'), false);
	});

	test('an escaped percent does not start a comment', () => {
		// `\%` is a literal percent, so what follows is still live code.
		assert.equal(needsBibliographyProcessor(String.raw`100\% \bibliography{refs}`), true);
	});

	test('a clean document warns about nothing', () => {
		const source = String.raw`\documentclass{article}
\begin{document}Hello\end{document}`;
		assert.deepEqual(citationCommands(source), []);
	});
});
