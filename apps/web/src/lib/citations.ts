// Detect documents that need a bibliography processor the web engine cannot run.
//
// BibTeX and Biber are separate programs. The browser engine is XeTeX +
// xdvipdfmx only — there is no bibtex binary in the bundle and no wasm build of
// biber exists (it is Perl) — so a document that depends on either silently
// loses its bibliography and every \cite renders as [?].
//
// `\cite` on its own is NOT the signal. A manual `thebibliography` environment
// with `\bibitem` is pure LaTeX and compiles correctly here, and warning about
// it would be wrong for anyone who writes their references by hand. What cannot
// work is the *external processor* step, so that is what this looks for.
//
// Desktop is unaffected: it drives a real TeX installation and runs bibtex.

/** Commands that require BibTeX or Biber to run between LaTeX passes. */
const PROCESSOR_COMMANDS = [
	'bibliography', // \bibliography{refs}     — BibTeX
	'bibliographystyle', // \bibliographystyle{plain} — BibTeX
	'addbibresource', // \addbibresource{refs.bib} — biblatex
	'printbibliography' // \printbibliography       — biblatex
];

/**
 * Strip TeX comments so a commented-out `\bibliography` does not trigger the
 * warning. A `%` is only a comment when unescaped; `\%` is a literal percent.
 */
function stripComments(source: string): string {
	return source.replace(/(^|[^\\])%.*$/gm, '$1');
}

/**
 * Does this document depend on BibTeX or Biber?
 *
 * Returns the commands found, so the notice can name them rather than making
 * the user guess which line is the problem.
 */
export function citationCommands(source: string): string[] {
	const text = stripComments(source);
	// Match the control sequence itself, not an argument: `\printbibliography`
	// usually appears bare, so requiring a following `{` misses the single most
	// common biblatex usage. The lookahead ends the name, which also stops
	// `\bibliography` matching the leading part of `\bibliographystyle`.
	return PROCESSOR_COMMANDS.filter((name) =>
		new RegExp(String.raw`\\${name}(?![a-zA-Z])`).test(text)
	).map((name) => `\\${name}`);
}

export function needsBibliographyProcessor(source: string): boolean {
	return citationCommands(source).length > 0;
}
