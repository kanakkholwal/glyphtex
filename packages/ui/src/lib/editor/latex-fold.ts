import { foldService } from "@codemirror/language";
import type { Extension } from "@codemirror/state";

/** Sectioning commands, outermost first: the index is the nesting rank. */
const SECTION_RANK = [
	"part",
	"chapter",
	"section",
	"subsection",
	"subsubsection",
	"paragraph",
	"subparagraph"
] as const;

const SECTION_RE = new RegExp(
	`^\\s*\\\\(${SECTION_RANK.join("|")})\\*?\\s*(?:\\[[^\\]]*\\])?\\s*\\{`
);
const ENVIRONMENT_RE = /^\s*\\(begin|end)\s*\{([^}]+)\}/;

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

/** One `\section`-family heading, for folding and the sticky header. */
export type Heading = {
	/** 0 = part … 6 = subparagraph. */
	rank: number;
	title: string;
	/** 1-based line number. */
	line: number;
	/** Offset of the line's first character. */
	from: number;
};

type Line = { text: string; from: number; to: number };

function splitLines(text: string): Line[] {
	const lines: Line[] = [];
	let from = 0;
	for (;;) {
		const nl = text.indexOf("\n", from);
		const to = nl === -1 ? text.length : nl;
		lines.push({ text: withoutComment(text.slice(from, to)), from, to });
		if (nl === -1) break;
		from = nl + 1;
	}
	return lines;
}

/** Read a brace-balanced argument starting just after the opening `{`. */
function readBraced(text: string, open: number): string {
	let depth = 0;
	for (let i = open; i < text.length; i++) {
		if (text[i] === "\\") {
			i++;
			continue;
		}
		if (text[i] === "{") depth++;
		else if (text[i] === "}" && --depth === 0) return text.slice(open + 1, i);
	}
	return text.slice(open + 1);
}

/** Strip inline markup so a heading reads as plain text. */
function cleanTitle(raw: string): string {
	return (
		raw
			.replace(/\\(label|index|footnote)\s*\{[^}]*\}/g, "")
			.replace(/\\[a-zA-Z]+\*?/g, "")
			.replace(/[{}]/g, "")
			.replace(/\s+/g, " ")
			.trim() || "Untitled"
	);
}

function findHeadings(lines: Line[]): (Heading & { index: number })[] {
	const headings: (Heading & { index: number })[] = [];
	for (let i = 0; i < lines.length; i++) {
		const match = SECTION_RE.exec(lines[i].text);
		if (!match) continue;
		const open = lines[i].text.indexOf("{", match.index);
		headings.push({
			rank: SECTION_RANK.indexOf(match[1] as (typeof SECTION_RANK)[number]),
			title: open === -1 ? match[1] : cleanTitle(readBraced(lines[i].text, open)),
			line: i + 1,
			from: lines[i].from,
			index: i
		});
	}
	return headings;
}

/** Every sectioning heading in `text`, in document order. */
export function sectionHeadings(text: string): Heading[] {
	return findHeadings(splitLines(text));
}

/** Line-start offset → offset the fold ends at. */
function computeFolds(text: string): Map<number, number> {
	const lines = splitLines(text);
	const folds = new Map<number, number>();

	// A section ends just before the next heading of equal or higher rank.
	const headings = findHeadings(lines);
	headings.forEach((heading, n) => {
		let end = lines.length - 1;
		for (let k = n + 1; k < headings.length; k++) {
			if (headings[k].rank <= heading.rank) {
				end = headings[k].index - 1;
				break;
			}
		}
		if (end > heading.index) folds.set(lines[heading.index].from, lines[end].to);
	});

	// Matched by name so a nested \begin{center} inside \begin{figure} closes the
	// right one; unbalanced \begins are discarded rather than swallowing the rest.
	const open: { name: string; index: number }[] = [];
	for (let i = 0; i < lines.length; i++) {
		const match = ENVIRONMENT_RE.exec(lines[i].text);
		if (!match) continue;
		if (match[1] === "begin") {
			open.push({ name: match[2], index: i });
			continue;
		}
		for (let k = open.length - 1; k >= 0; k--) {
			if (open[k].name !== match[2]) continue;
			if (i > open[k].index + 1) folds.set(lines[open[k].index].from, lines[i - 1].to);
			open.length = k;
			break;
		}
	}

	return folds;
}

// foldService runs per visible line, so a scan per call would be quadratic on a
// long chapter. One entry is enough: successive calls share the same document.
let cached: { text: string; folds: Map<number, number> } | null = null;

function foldsFor(text: string): Map<number, number> {
	if (cached?.text !== text) cached = { text, folds: computeFolds(text) };
	return cached.folds;
}

/** Folds on sections and environments. LaTeX bodies are conventionally
 *  unindented, so indentation-based folding gets the document wrong. */
export function latexFolding(): Extension {
	return foldService.of((state, lineStart, lineEnd) => {
		const end = foldsFor(state.doc.toString()).get(lineStart);
		return end === undefined || end <= lineEnd ? null : { from: lineEnd, to: end };
	});
}
