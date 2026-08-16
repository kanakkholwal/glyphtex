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

const SECTION_RE =
	/\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*\{/g;

/** Drop a trailing line comment (first unescaped `%`). */
function stripComment(line: string): string {
	for (let i = 0; i < line.length; i++) {
		if (line[i] === "%" && line[i - 1] !== "\\") return line.slice(0, i);
	}
	return line;
}

/** Read a brace-balanced argument starting just after the opening `{`. */
function readBraced(line: string, start: number): string {
	let depth = 1;
	let out = "";
	for (let i = start; i < line.length; i++) {
		const c = line[i];
		if (c === "{") depth++;
		else if (c === "}") {
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
		.replace(/\\(label|index|footnote)\s*\{[^}]*\}/g, "") // drop noise args
		.replace(/\\[a-zA-Z]+\*?/g, "") // drop remaining commands
		.replace(/[{}]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return text || "Untitled";
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
	const lines = src.split("\n");
	const limit = Math.min(lines.length, maxLines);
	const items: OutlineItem[] = [];

	for (let ln = 0; ln < limit; ln++) {
		const line = stripComment(lines[ln]);
		if (line.indexOf("\\") === -1) continue;
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

/** One visible row of the outline tree. Built from the flat list rather than a
 *  nested structure, so the view stays a single `{#each}`. */
export type OutlineRow = {
	/** Index into the flat outline, so a click still resolves the real item. */
	index: number;
	item: OutlineItem;
	/** Levels below the document's top section. Drives indent and type scale. */
	depth: number;
	hasChildren: boolean;
	collapsed: boolean;
	key: string;
};

/** Identity that survives edits elsewhere in the document, unlike an index. */
export function outlineKey(item: OutlineItem): string {
	return `${item.level}:${item.title}`;
}

/** The rows a collapsed-state map leaves visible, in document order. */
export function buildOutlineRows(
	items: OutlineItem[],
	base: number,
	closed: Record<string, boolean>
): OutlineRow[] {
	const rows: OutlineRow[] = [];
	// Everything deeper than a collapsed heading is hidden until the next heading
	// at or above its level closes the subtree.
	let hideBelow = Infinity;
	for (let i = 0; i < items.length; i++) {
		const depth = items[i].level - base;
		if (depth > hideBelow) continue;
		hideBelow = Infinity;
		const key = outlineKey(items[i]);
		const hasChildren = (items[i + 1]?.level ?? -Infinity) > items[i].level;
		const collapsed = hasChildren && closed[key] === true;
		if (collapsed) hideBelow = depth;
		rows.push({ index: i, item: items[i], depth, hasChildren, collapsed, key });
	}
	return rows;
}

/** Row to light up for the section at `active`: itself, or the nearest visible
 *  ancestor when it is folded away. -1 when there is nothing to mark. */
export function activeOutlineRow(rows: OutlineRow[], active: number): number {
	if (active < 0) return -1;
	let found = -1;
	for (let r = 0; r < rows.length; r++) {
		if (rows[r].index > active) break;
		found = r;
	}
	return found;
}

/** Index of the section `line` falls inside, or -1 above the first heading. */
export function sectionAt(items: OutlineItem[], line: number): number {
	let found = -1;
	for (let i = 0; i < items.length; i++) {
		if (items[i].line > line) break;
		found = i;
	}
	return found;
}

/** 1-based line holding `offset`. */
export function lineAt(src: string, offset: number): number {
	const end = Math.min(offset, src.length);
	let line = 1;
	for (let i = 0; i < end; i++) if (src[i] === "\n") line++;
	return line;
}

/** Offset of a 1-based line's first column; clamps to the end of `src`. */
export function offsetOfLine(src: string, line: number): number {
	let at = 0;
	for (let n = 1; n < line; n++) {
		const next = src.indexOf("\n", at);
		if (next === -1) return src.length;
		at = next + 1;
	}
	return at;
}
