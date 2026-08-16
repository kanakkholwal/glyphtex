import { buildRegex, expandReplacement } from '../code-editor/search';
import type { SearchMatch, SearchOptions } from './types';

/** One file's matches, in document order. */
export type FileMatches = { id: string; name: string; matches: SearchMatch[] };

/** A single match with the file it came from, for flat keyboard navigation. */
export type Hit = { fileId: string; fileName: string; index: number; match: SearchMatch };

export type ScanResult = {
	groups: FileMatches[];
	total: number;
	/** Matches in generated or sidecar files, kept aside rather than dropped: the
	 *  panel offers them instead of pretending they do not exist. */
	otherGroups: FileMatches[];
	otherTotal: number;
	/** Scanning stopped at the cap, so what is shown is partial. */
	truncated: boolean;
	/** Set when the pattern itself cannot compile. Distinct from "no matches". */
	error?: string;
};

export const EMPTY_SCAN: ScanResult = {
	groups: [],
	total: 0,
	otherGroups: [],
	otherTotal: 0,
	truncated: false
};

/** Above this the panel stops scanning: the list is long past useful anyway. */
export const MATCH_CAP = 2000;

export type SearchInput = {
	id: string;
	name: string;
	text: string;
	/** Part of the document, rather than generated from it or sitting beside it. */
	document: boolean;
};

/** What the scan refused to open. Reported rather than swallowed: a search that
 *  silently skips a folder is indistinguishable from one that found nothing. */
export type SearchSkips = {
	/** Vendored / VCS folder names that held text, in first-seen order. */
	vendorDirs: string[];
	vendorFiles: number;
	/** Files whose contents could not be read at all. */
	unreadable: number;
};

export const NO_SKIPS: SearchSkips = { vendorDirs: [], vendorFiles: 0, unreadable: 0 };

/** One line naming what a scan left out, or "" when it left out nothing. */
export function skipSummary(s: SearchSkips): string {
	const parts: string[] = [];
	if (s.vendorFiles) {
		const [a, b] = s.vendorDirs;
		const rest = s.vendorDirs.length - 2;
		const where = !b ? a : rest > 0 ? `${a}, ${b} and ${rest} more` : `${a} and ${b}`;
		parts.push(`${s.vendorFiles} file${s.vendorFiles === 1 ? '' : 's'} in ${where}`);
	}
	if (s.unreadable)
		parts.push(`${s.unreadable} file${s.unreadable === 1 ? '' : 's'} that could not be read`);
	return parts.length ? `Not searched: ${parts.join(', ')}.` : '';
}

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

/**
 * Scan every file, keeping input order. Files with no matches are dropped.
 * Document files are scanned first so the cap, when it bites, spends itself on
 * the results that matter rather than on a build log.
 */
export function scanFiles(inputs: SearchInput[], o: SearchOptions, cap = MATCH_CAP): ScanResult {
	if (!o.query) return EMPTY_SCAN;
	const re = buildRegex(o);
	if (!re) return { ...EMPTY_SCAN, error: 'Invalid regular expression' };

	const groups: FileMatches[] = [];
	const otherGroups: FileMatches[] = [];
	let total = 0;
	let otherTotal = 0;
	let truncated = false;

	for (const input of [...inputs].sort((a, b) => Number(b.document) - Number(a.document))) {
		const used = total + otherTotal;
		if (used >= cap) {
			truncated = true;
			break;
		}
		const matches = scanText(input.text, re, cap - used);
		if (!matches.length) continue;
		const group = { id: input.id, name: input.name, matches };
		if (input.document) {
			groups.push(group);
			total += matches.length;
		} else {
			otherGroups.push(group);
			otherTotal += matches.length;
		}
	}
	return {
		groups,
		total,
		otherGroups,
		otherTotal,
		truncated: truncated || total + otherTotal >= cap
	};
}

/** Flatten for keyboard navigation, keeping the rendered order. */
export function flattenHits(result: ScanResult, includeOther = false): Hit[] {
	const hits: Hit[] = [];
	const all = includeOther ? [...result.groups, ...result.otherGroups] : result.groups;
	for (const group of all)
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
