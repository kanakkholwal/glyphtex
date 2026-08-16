import { buildRegex, expandReplacement } from '../code-editor/search';
import type { SearchMatch, SearchOptions } from './types';

/** One file's matches, in document order. */
export type FileMatches = { id: string; name: string; matches: SearchMatch[] };

/** A single match with the file it came from, for flat keyboard navigation. */
export type Hit = { fileId: string; fileName: string; index: number; match: SearchMatch };

export type ScanResult = {
	groups: FileMatches[];
	total: number;
	/** Scanning stopped at the cap, so what is shown is partial. */
	truncated: boolean;
	/** Set when the pattern itself cannot compile. Distinct from "no matches". */
	error?: string;
};

export const EMPTY_SCAN: ScanResult = { groups: [], total: 0, truncated: false };

/** Above this the panel stops scanning: the list is long past useful anyway. */
export const MATCH_CAP = 2000;

export type SearchInput = { id: string; name: string; text: string };

/** Why a pattern will not compile, so the panel can say so instead of "No results". */
export function patternError(o: SearchOptions): string | undefined {
	if (!o.query) return undefined;
	return buildRegex(o) ? undefined : 'Invalid regular expression';
}

/** Offsets each line starts at, so a match resolves to line/column in O(log n). */
function lineStarts(text: string): number[] {
	const starts = [0];
	for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
	return starts;
}

function lineIndexAt(starts: number[], offset: number): number {
	let lo = 0;
	let hi = starts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (starts[mid] <= offset) lo = mid;
		else hi = mid - 1;
	}
	return lo;
}

/** Matches in one document. `re` must be a fresh global regex. */
export function scanText(text: string, re: RegExp, limit: number): SearchMatch[] {
	const out: SearchMatch[] = [];
	if (limit <= 0) return out;
	const starts = lineStarts(text);
	re.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text))) {
		if (m[0] === '') {
			re.lastIndex++; // zero-width matches would loop forever
			continue;
		}
		const from = m.index;
		const li = lineIndexAt(starts, from);
		const lineStart = starts[li];
		const lineEnd = li + 1 < starts.length ? starts[li + 1] - 1 : text.length;
		out.push({
			from,
			to: from + m[0].length,
			line: li + 1,
			column: from - lineStart + 1,
			text: text.slice(lineStart, lineEnd)
		});
		if (out.length >= limit) break;
	}
	return out;
}

/** Scan every file, keeping input order. Files with no matches are dropped. */
export function scanFiles(inputs: SearchInput[], o: SearchOptions, cap = MATCH_CAP): ScanResult {
	if (!o.query) return EMPTY_SCAN;
	const re = buildRegex(o);
	if (!re) return { groups: [], total: 0, truncated: false, error: 'Invalid regular expression' };

	const groups: FileMatches[] = [];
	let total = 0;
	let truncated = false;
	for (const input of inputs) {
		if (total >= cap) {
			truncated = true;
			break;
		}
		const matches = scanText(input.text, re, cap - total);
		if (!matches.length) continue;
		groups.push({ id: input.id, name: input.name, matches });
		total += matches.length;
	}
	return { groups, total, truncated: truncated || total >= cap };
}

/** Flatten for keyboard navigation, keeping the rendered order. */
export function flattenHits(result: ScanResult): Hit[] {
	const hits: Hit[] = [];
	for (const group of result.groups)
		for (const match of group.matches)
			hits.push({ fileId: group.id, fileName: group.name, index: hits.length, match });
	return hits;
}

/**
 * The text one match should be replaced with. Plain searches insert `replace`
 * verbatim; a regex search expands `$&` / `$1` against that specific match.
 */
export function replacementFor(matched: string, replace: string, o: SearchOptions): string {
	if (!o.regexp) return replace;
	const re = buildRegex({ ...o, regexp: true });
	if (!re) return replace;
	re.lastIndex = 0;
	const m = re.exec(matched);
	return m ? expandReplacement(replace, m[0], m.slice(1)) : replace;
}

/** Apply matches to one document back-to-front, so earlier offsets stay valid. */
export function applyMatches(
	text: string,
	matches: SearchMatch[],
	replace: string,
	o: SearchOptions
): string {
	let out = text;
	for (let i = matches.length - 1; i >= 0; i--) {
		const m = matches[i];
		const matched = text.slice(m.from, m.to);
		out = out.slice(0, m.from) + replacementFor(matched, replace, o) + out.slice(m.to);
	}
	return out;
}
