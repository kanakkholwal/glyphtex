export type PullAction = "same" | "write" | "conflict" | "skip";

/**
 * What to do with one remote text file. `baseSha` is what both sides agreed on at the last sync:
 * if the local copy still equals it, only the remote changed and overwriting is safe; if the local
 * copy changed too (or there is no agreed base) and the remote differs, it is a conflict.
 */
export function planPull(input: {
	remoteSha: string;
	local?: { sha: string; isText: boolean };
	baseSha?: string;
}): PullAction {
	const { remoteSha, local, baseSha } = input;
	if (!local) return "write";
	if (!local.isText) return "skip";
	if (local.sha === remoteSha) return "same";
	if (baseSha !== undefined && baseSha === remoteSha) return "skip";
	if (local.sha === baseSha) return "write";
	return "conflict";
}

/** Paths to commit: new or edited local files, plus files that were synced and then deleted locally. */
export function planPush(input: {
	local: { path: string; sha: string }[];
	base: Record<string, string>;
	remotePaths: ReadonlySet<string>;
}): { upserts: string[]; deletes: string[] } {
	const here = new Set(input.local.map((f) => f.path));
	return {
		upserts: input.local.filter((f) => input.base[f.path] !== f.sha).map((f) => f.path),
		deletes: Object.keys(input.base).filter((p) => !here.has(p) && input.remotePaths.has(p))
	};
}
