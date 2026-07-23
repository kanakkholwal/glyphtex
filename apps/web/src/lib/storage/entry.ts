// Choosing which file a multi-file project compiles.
//
// The old rule was "first path ending in .tex", which in a real thesis picks
// whatever the archive happened to list first — usually a chapter three folders
// deep. A compile root is a specific thing, so identify it as one.

export type EntryInput = { path: string; text?: string };

export type EntryChoice = {
	/** Best guess. Always set, so a compile can always proceed. */
	entry: string;
	/** Every plausible root, best first. One or zero means nothing to ask. */
	candidates: string[];
	/** True when the guess is the only plausible root and needs no confirmation. */
	confident: boolean;
};

const TEX_PATH = /\.(tex|ltx|rnw)$/i;

const depthOf = (path: string) => path.split('/').length - 1;
const baseOf = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(TEX_PATH, '');

// A root's own name, by convention. Ranked, so `main.tex` beats `paper.tex`
// when a project carries both.
const CONVENTIONAL = [
	'main',
	'thesis',
	'dissertation',
	'paper',
	'manuscript',
	'root',
	'master',
	'document',
	'report',
	'article',
	'index',
	'book'
];

/**
 * `\documentclass` is the marker: it appears once per compilable document and
 * never in an `\input`-ed chapter. `\begin{document}` is the same signal for a
 * file that inherits its class from elsewhere.
 *
 * Commented-out lines are stripped first, since a chapter often carries a
 * commented preamble so an editor can typeset it standalone.
 */
function isRoot(text: string | undefined): boolean {
	if (!text) return false;
	const live = text.replace(/(^|[^\\])%.*$/gm, '$1');
	return /\\documentclass\s*[[{]/.test(live) || /\\begin\s*\{document\}/.test(live);
}

// Subfiles and standalone let a chapter carry its own \documentclass, so those
// files look exactly like roots. The parent is the one naming a \documentclass
// the child then points back at.
const isSubfile = (text: string | undefined) =>
	!!text && /\\documentclass\s*\[[^\]]*\]\s*\{subfiles\}|\\documentclass\s*\{subfiles\}/.test(text);

function rank(file: EntryInput): number {
	const name = baseOf(file.path).toLowerCase();
	const i = CONVENTIONAL.indexOf(name);
	return i === -1 ? CONVENTIONAL.length : i;
}

function compare(a: EntryInput, b: EntryInput): number {
	return (
		depthOf(a.path) - depthOf(b.path) ||
		rank(a) - rank(b) ||
		a.path.localeCompare(b.path, 'en', { sensitivity: 'base' })
	);
}

/**
 * Pick the file to compile, and report whether the choice was obvious.
 *
 * Roots at the top level win outright: a nested file that declares a
 * `\documentclass` is far more often a standalone chapter than the thesis.
 * Only when the top level offers nothing does the search widen, shallowest
 * first, so a project wrapped in a stray folder still compiles.
 */
export function pickEntry(files: readonly EntryInput[]): EntryChoice {
	const tex = files.filter((f) => TEX_PATH.test(f.path));
	if (tex.length === 0) {
		return { entry: files[0]?.path ?? 'main.tex', candidates: [], confident: false };
	}

	const declared = tex.filter((f) => isRoot(f.text) && !isSubfile(f.text));
	// Nothing declares a class when the import is binary-only or the text was
	// never loaded; fall back to every .tex rather than reporting no candidates.
	const pool = declared.length > 0 ? declared : tex;

	const top = pool.filter((f) => depthOf(f.path) === 0);
	const scoped = top.length > 0 ? top : pool;
	const ordered = [...scoped].sort(compare);

	return {
		entry: ordered[0].path,
		candidates: ordered.map((f) => f.path),
		confident: ordered.length === 1
	};
}

/**
 * Re-pick after an edit, keeping the current entry if it still exists.
 *
 * A user who chose a root must not have it silently reassigned because they
 * added a file that outranks it.
 */
export function keepOrPickEntry(files: readonly EntryInput[], current: string): EntryChoice {
	if (files.some((f) => f.path === current)) {
		return { entry: current, candidates: [current], confident: true };
	}
	return pickEntry(files);
}
