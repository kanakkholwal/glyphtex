// Detect documents whose bibliography the browser engine cannot produce.
//
// The engine runs BibTeX itself, so `\bibliography` + `\bibliographystyle` and
// biblatex under `backend=bibtex` both resolve fully offline. What it cannot do
// is run Biber: Biber is a Perl program, there is no wasm build, and biblatex
// defaults to it. That single case is what this reports.
//
// `\cite` on its own is NOT a signal, and neither is a hand-written
// `thebibliography` — both are ordinary LaTeX that has always worked here.

/** Does the document load biblatex, whatever the backend? */
function usesBiblatex(text: string): boolean {
	return /\\usepackage\s*(\[[^\]]*\])?\s*\{[^}]*\bbiblatex\b[^}]*\}/.test(text);
}

/**
 * biblatex only avoids Biber when told to. The option can arrive on the package
 * or be passed ahead of it, so both spellings count.
 */
function selectsBibtexBackend(text: string): boolean {
	return (
		/\\usepackage\s*\[[^\]]*backend\s*=\s*bibtex[^\]]*\]\s*\{[^}]*biblatex/.test(text) ||
		/\\PassOptionsToPackage\s*\{[^}]*backend\s*=\s*bibtex[^}]*\}\s*\{\s*biblatex\s*\}/.test(text) ||
		/\\ExecuteBibliographyOptions\s*\{[^}]*backend\s*=\s*bibtex/.test(text)
	);
}

/**
 * Strip TeX comments so a commented-out directive does not trigger the notice.
 * A `%` is only a comment when unescaped; `\%` is a literal percent.
 */
function stripComments(source: string): string {
	return source.replace(/(^|[^\\])%.*$/gm, '$1');
}

/**
 * Does this document need Biber, which cannot run in the browser?
 *
 * True only for biblatex left on its default backend. Everything else —
 * classic BibTeX, natbib, biblatex with `backend=bibtex` — compiles here.
 */
export function needsBiber(source: string): boolean {
	const text = stripComments(source);
	return usesBiblatex(text) && !selectsBibtexBackend(text);
}

/** The one-line edit that makes a Biber document compile in the browser. */
export const BIBTEX_BACKEND_FIX = '\\usepackage[backend=bibtex]{biblatex}';

export function needsBibliographyProcessor(source: string): boolean {
	return needsBiber(source);
}
