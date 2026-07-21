/**
 * Document structure for LaTeX: the outline tree and section folding.
 *
 * Monaco derives breadcrumbs, the outline view and "go to symbol" from a
 * document symbol provider, and LaTeX has an obvious one — the sectioning
 * hierarchy — that it cannot infer on its own. Folding is the same information
 * viewed differently: a section folds down to the next heading of equal or
 * higher rank.
 *
 * Both are computed by scanning, not parsing. A real parse would handle
 * `\section` inside a comment or a verbatim block correctly; this skips
 * comments, which covers the case that actually happens.
 */
import type * as Monaco from "monaco-editor";

import type { MonacoNamespace } from "./monaco";
import { LATEX_ID } from "./latex-monarch";

/** Sectioning commands, outermost first — the index is the nesting rank. */
const SECTION_RANK = [
	"part",
	"chapter",
	"section",
	"subsection",
	"subsubsection",
	"paragraph",
	"subparagraph",
] as const;

const SECTION_RE = new RegExp(`^\\s*\\\\(${SECTION_RANK.join("|")})\\*?\\s*(?:\\[[^\\]]*\\])?\\s*\\{`, "");
const ENVIRONMENT_RE = /^\s*\\(begin|end)\s*\{([^}]+)\}/;

type Heading = {
	rank: number;
	title: string;
	line: number;
};

/**
 * Read a brace-balanced argument starting at `open` (the index of `{`).
 * Returns the contents, or null if the braces never close on this line —
 * `\section{Some \textbf{bold} title}` has to survive the nested pair.
 */
function readBraced(text: string, open: number): string | null {
	let depth = 0;
	for (let i = open; i < text.length; i++) {
		const ch = text[i];
		if (ch === "\\") {
			i++; // skip the escaped character
			continue;
		}
		if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) return text.slice(open + 1, i);
		}
	}
	return null;
}

/** Strip a trailing `%` comment, respecting `\%`. */
function withoutComment(line: string): string {
	for (let i = 0; i < line.length; i++) {
		if (line[i] !== "%") continue;
		let backslashes = 0;
		for (let j = i - 1; j >= 0 && line[j] === "\\"; j--) backslashes++;
		if (backslashes % 2 === 0) return line.slice(0, i);
	}
	return line;
}

function findHeadings(model: Monaco.editor.ITextModel): Heading[] {
	const headings: Heading[] = [];
	for (let line = 1; line <= model.getLineCount(); line++) {
		const text = withoutComment(model.getLineContent(line));
		const match = SECTION_RE.exec(text);
		if (!match) continue;

		const open = text.indexOf("{", match.index);
		const title = readBraced(text, open);
		headings.push({
			rank: SECTION_RANK.indexOf(match[1] as (typeof SECTION_RANK)[number]),
			// An unbalanced title (continued on the next line) still deserves an
			// outline entry — fall back to the command name rather than dropping it.
			title: title?.trim() || match[1],
			line,
		});
	}
	return headings;
}

/** Where a heading's section ends: just before the next heading of equal or
 *  higher rank, or the end of the document. */
function sectionEnd(headings: Heading[], index: number, lastLine: number): number {
	const start = headings[index];
	for (let i = index + 1; i < headings.length; i++) {
		if (headings[i].rank <= start.rank) return headings[i].line - 1;
	}
	return lastLine;
}

export function registerLatexStructure(monaco: MonacoNamespace): Monaco.IDisposable[] {
	const symbols = monaco.languages.registerDocumentSymbolProvider(LATEX_ID, {
		displayName: "LaTeX sections",

		provideDocumentSymbols(model) {
			const headings = findHeadings(model);
			const lastLine = model.getLineCount();

			// Build the tree with an explicit stack: each heading is a child of the
			// nearest preceding heading of lower rank.
			const roots: Monaco.languages.DocumentSymbol[] = [];
			const stack: { rank: number; symbol: Monaco.languages.DocumentSymbol }[] = [];

			headings.forEach((heading, index) => {
				const endLine = sectionEnd(headings, index, lastLine);
				const range: Monaco.IRange = {
					startLineNumber: heading.line,
					startColumn: 1,
					endLineNumber: endLine,
					endColumn: model.getLineMaxColumn(endLine),
				};
				const symbol: Monaco.languages.DocumentSymbol = {
					name: heading.title,
					detail: SECTION_RANK[heading.rank],
					kind: monaco.languages.SymbolKind.String,
					tags: [],
					range,
					selectionRange: {
						startLineNumber: heading.line,
						startColumn: 1,
						endLineNumber: heading.line,
						endColumn: model.getLineMaxColumn(heading.line),
					},
					children: [],
				};

				while (stack.length > 0 && stack[stack.length - 1].rank >= heading.rank) {
					stack.pop();
				}
				if (stack.length === 0) roots.push(symbol);
				else stack[stack.length - 1].symbol.children?.push(symbol);
				stack.push({ rank: heading.rank, symbol });
			});

			return roots;
		},
	});

	const folding = monaco.languages.registerFoldingRangeProvider(LATEX_ID, {
		provideFoldingRanges(model) {
			const ranges: Monaco.languages.FoldingRange[] = [];
			const lastLine = model.getLineCount();

			const headings = findHeadings(model);
			headings.forEach((heading, index) => {
				const end = sectionEnd(headings, index, lastLine);
				// A one-line section has nothing to fold.
				if (end > heading.line) {
					ranges.push({
						start: heading.line,
						end,
						kind: monaco.languages.FoldingRangeKind.Region,
					});
				}
			});

			// Environments fold too, matched by name so a nested `\begin{center}`
			// inside `\begin{figure}` closes the right one.
			const open: { name: string; line: number }[] = [];
			for (let line = 1; line <= lastLine; line++) {
				const match = ENVIRONMENT_RE.exec(withoutComment(model.getLineContent(line)));
				if (!match) continue;

				if (match[1] === "begin") {
					open.push({ name: match[2], line });
					continue;
				}
				// Unwind to the matching \begin, discarding unbalanced ones rather
				// than letting a stray \end swallow the rest of the document.
				for (let i = open.length - 1; i >= 0; i--) {
					if (open[i].name !== match[2]) continue;
					if (line > open[i].line + 1) {
						ranges.push({ start: open[i].line, end: line - 1 });
					}
					open.length = i;
					break;
				}
			}

			return ranges;
		},
	});

	return [symbols, folding];
}
