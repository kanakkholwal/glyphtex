import { parseBib, type BibEntry } from "./bibtex";

export type WorkspaceFile = {
	/** Path or id — used to attribute a suggestion to its file. */
	path: string;
	content: string;
};

// A plain module store rather than a rune: the consumers are Monaco provider
// callbacks, which pull on demand and have no reactive context to subscribe from.
let files: WorkspaceFile[] = [];

/** Bumped on every push, so derived views know their cache is stale. */
let revision = 0;

type Cache<T> = { revision: number; value: T } | null;
let bibCache: Cache<BibEntry[]> = null;
let labelCache: Cache<WorkspaceLabel[]> = null;

export type WorkspaceLabel = {
	name: string;
	/** Basename of the file it was defined in. */
	file: string;
	line: number;
};

/** Replaces the project's files. Cheap to call often: it only invalidates caches,
 * and the parsing behind them is lazy. */
export function setWorkspaceFiles(next: readonly WorkspaceFile[]): void {
	files = [...next];
	revision++;
	bibCache = null;
	labelCache = null;
}

/** Clear the index — on closing a project, so its labels stop being offered. */
export function clearWorkspace(): void {
	setWorkspaceFiles([]);
}

function basename(path: string): string {
	return path.split(/[/\\]/).pop() || path;
}

/** Every citation key in the project's `.bib` files. */
export function workspaceBibEntries(): BibEntry[] {
	if (bibCache?.revision === revision) return bibCache.value;

	const entries: BibEntry[] = [];
	for (const file of files) {
		if (!file.path.toLowerCase().endsWith(".bib")) continue;
		entries.push(...parseBib(file.content, basename(file.path)));
	}

	bibCache = { revision, value: entries };
	return entries;
}

/** Every `\label` in the project's `.tex` files. The open file is contributed by the
 * caller from its live model instead, so unsaved labels still appear. */
export function workspaceLabels(): WorkspaceLabel[] {
	if (labelCache?.revision === revision) return labelCache.value;

	const labels: WorkspaceLabel[] = [];
	for (const file of files) {
		if (!/\.(tex|ltx|sty|cls)$/i.test(file.path)) continue;

		const name = basename(file.path);
		// Newlines are counted by hand: these files have no Monaco model to ask.
		const re = /\\label\s*\{([^}]+)\}/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(file.content))) {
			let line = 1;
			for (let i = 0; i < m.index; i++) if (file.content[i] === "\n") line++;
			labels.push({ name: m[1], file: name, line });
		}
	}

	labelCache = { revision, value: labels };
	return labels;
}

/** Package names the project loads, for on-demand completion data. */
export function workspacePackages(): string[] {
	const names = new Set<string>();
	for (const file of files) {
		if (!/\.(tex|ltx|sty|cls)$/i.test(file.path)) continue;
		const re = /\\(?:usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(file.content))) {
			for (const name of m[1].split(",")) {
				const trimmed = name.trim();
				if (trimmed) names.add(trimmed);
			}
		}
	}
	return [...names];
}
