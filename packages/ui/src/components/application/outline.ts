// Flat-with-depth rather than a nested tree: renders in one `{#each}`, with no
// recursive component and no risk of a reactive loop.
export type OutlineItem = {
	/** 0 = part … 6 = subparagraph. Used for indentation, not absolute. */
	level: number;
	title: string;
	/** 1-based line number, for `goToLine`. */
	line: number;
};

// Sectioning command → nesting level (article + report/book commands).
const SECTION_LEVEL: Record<string, number> = {
	part: 0,
	chapter: 1,
	section: 2,
	subsection: 3,
	subsubsection: 4,
	paragraph: 5,
	subparagraph: 6
};

const SECTION_RE = /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*\{/g;

/** Drop a trailing line comment (first unescaped `%`). */
function stripComment(line: string): string {
	for (let i = 0; i < line.length; i++) {
		if (line[i] === '%' && line[i - 1] !== '\\') return line.slice(0, i);
	}
	return line;
}

/** Read a brace-balanced argument starting just after the opening `{`. */
function readBraced(line: string, start: number): string {
	let depth = 1;
	let out = '';
	for (let i = start; i < line.length; i++) {
		const c = line[i];
		if (c === '{') depth++;
		else if (c === '}') {
			depth--;
			if (depth === 0) break;
		}
		out += c;
	}
	return out;
}

/** Strip inline LaTeX markup so the title reads as plain text. */
function cleanTitle(raw: string): string {
	const text = raw
		.replace(/\\(label|index|footnote)\s*\{[^}]*\}/g, '') // drop noise args
		.replace(/\\[a-zA-Z]+\*?/g, '') // drop remaining commands
		.replace(/[{}]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	return text || 'Untitled';
}

/**
 * Parse sectioning commands out of LaTeX source.
 *
 * `maxLines` bounds the scan so a pathologically large buffer can never stall
 * the UI thread; titles are assumed to sit on a single line (the overwhelming
 * common case) which also keeps each line's work strictly bounded.
 */
export function parseOutline(src: string, maxLines = 20_000): OutlineItem[] {
	if (!src) return [];
	const lines = src.split('\n');
	const limit = Math.min(lines.length, maxLines);
	const items: OutlineItem[] = [];

	for (let ln = 0; ln < limit; ln++) {
		const line = stripComment(lines[ln]);
		if (line.indexOf('\\') === -1) continue;
		SECTION_RE.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = SECTION_RE.exec(line))) {
			const title = cleanTitle(readBraced(line, SECTION_RE.lastIndex));
			items.push({ level: SECTION_LEVEL[m[1]], title, line: ln + 1 });
		}
	}
	return items;
}

/** Smallest level present, so the outline indents from zero regardless of the
 * document's top section (an article starting at `\section` shouldn't indent). */
export function baseLevel(items: OutlineItem[]): number {
	let min = Infinity;
	for (const it of items) if (it.level < min) min = it.level;
	return Number.isFinite(min) ? min : 0;
}
