import type {
	GitChange,
	GitCommitEntry,
	GitHeadInfo,
	GitProvider,
	GitRemote
} from '@glyphtex/ui/application';

import { unifiedDiff } from './diff';
import {
	exists,
	gitFs,
	isMissing,
	mkdirp,
	projectIdFrom,
	readBytes,
	rootFor,
	unlinkIfPresent,
	type PromiseFs
} from './fs';
import { asText, fromWorkingTree, toWorkingTree } from './mirror';
import { getCorsProxy, getIdentity, hasIdentity, setCorsProxy, setIdentity } from './settings';
import { changesFrom, type StatusRow } from './status';

type Iso = typeof import('isomorphic-git');
type Http = typeof import('isomorphic-git/http/web').default;

let iso: Promise<{ git: Iso; http: Http }> | null = null;

/** isomorphic-git hashes through `sha.js`, which reaches for a global `Buffer`
 *  that no browser has and Vite does not shim. */
async function polyfillBuffer(): Promise<void> {
	const g = globalThis as { Buffer?: unknown };
	if (g.Buffer) return;
	g.Buffer = (await import('buffer')).Buffer;
}

/** isomorphic-git is browser-only here; keep it out of the SSR bundle. */
function load(): Promise<{ git: Iso; http: Http }> {
	iso ??= polyfillBuffer()
		.then(() => Promise.all([import('isomorphic-git'), import('isomorphic-git/http/web')]))
		.then(([g, h]) => ({ git: (g.default ?? g) as Iso, http: h.default }));
	return iso;
}

type Repo = { git: Iso; http: Http; fs: PromiseFs; dir: string; projectId: string };

async function repo(root: string): Promise<Repo> {
	const [{ git, http }, lfs] = await Promise.all([load(), gitFs()]);
	return {
		git,
		http,
		fs: lfs.promises,
		dir: rootFor(projectIdFrom(root)),
		projectId: projectIdFrom(root)
	};
}

// isomorphic-git wants an fs client object; lightning-fs' instance is one.
const fsClient = async () => await gitFs();

// --- Merge state ------------------------------------------------------------
// `statusMatrix` can't report unmerged index entries, so a conflicted merge records
// its filepaths here and `status` re-reports them until the commit clears the file.
const CONFLICTS = 'GLYPHTEX_MERGE_CONFLICTS';

async function readConflicts(fs: PromiseFs, dir: string): Promise<string[]> {
	const raw = await readBytes(fs, `${dir}/.git/${CONFLICTS}`);
	if (!raw) return [];
	return (asText(raw) ?? '').split('\n').filter(Boolean);
}

async function writeConflicts(fs: PromiseFs, dir: string, paths: string[]): Promise<void> {
	if (paths.length === 0) return void (await unlinkIfPresent(fs, `${dir}/.git/${CONFLICTS}`));
	await fs.writeFile(`${dir}/.git/${CONFLICTS}`, new TextEncoder().encode(paths.join('\n')));
}

// --- Auth -------------------------------------------------------------------
/** The panel injects the token as URL credentials; isomorphic-git wants them in
 *  `onAuth` instead, and a token in the URL would end up in the fetch logs. */
function splitAuth(url?: string): {
	url?: string;
	auth?: { username: string; password: string };
} {
	if (!url) return {};
	try {
		const u = new URL(url);
		if (!u.username && !u.password) return { url };
		const auth = {
			username: decodeURIComponent(u.username) || 'x-access-token',
			password: decodeURIComponent(u.password)
		};
		u.username = '';
		u.password = '';
		return { url: u.toString(), auth };
	} catch {
		return { url };
	}
}

function remoteOpts(url?: string) {
	const { url: clean, auth } = splitAuth(url);
	return {
		...(clean ? { url: clean } : {}),
		corsProxy: getCorsProxy(),
		onAuth: () =>
			auth ?? {
				// Without this the server's 401 loops; the message is what `describeError`
				// matches to show "Authentication failed".
				cancel: true as const
			}
	};
}

function author() {
	const { name, email } = getIdentity();
	return { name, email };
}

// --- Object reads -----------------------------------------------------------
async function headBytes(r: Repo, path: string): Promise<Uint8Array | null> {
	try {
		const oid = await r.git.resolveRef({ fs: await fsClient(), dir: r.dir, ref: 'HEAD' });
		const { blob } = await r.git.readBlob({
			fs: await fsClient(),
			dir: r.dir,
			oid,
			filepath: path
		});
		return blob;
	} catch {
		return null;
	}
}

async function stageBytes(r: Repo, path: string): Promise<Uint8Array | null> {
	const fs = await fsClient();
	const found: string[] = await r.git.walk({
		fs,
		dir: r.dir,
		trees: [r.git.STAGE()],
		map: async (filepath, entries) => {
			if (filepath === '.') return undefined;
			const entry = entries[0];
			if (filepath === path) return entry ? await entry.oid() : undefined;
			// Keep descending through the target's ancestors; prune every other subtree.
			return path.startsWith(`${filepath}/`) ? undefined : null;
		}
	});
	const oid = found[0];
	if (!oid) return null;
	const { blob } = await r.git.readBlob({ fs, dir: r.dir, oid });
	return blob;
}

const text = (bytes: Uint8Array | null): string => (bytes ? (asText(bytes) ?? '') : '');
const looksBinary = (bytes: Uint8Array | null): boolean => Boolean(bytes && asText(bytes) === null);

// --- Provider ---------------------------------------------------------------
export const gitProvider: GitProvider = {
	// Nothing is shelled out to on the web, so the remote half is always usable.
	available: async () => true,

	async isRepo(root) {
		const r = await repo(root);
		return exists(r.fs, `${r.dir}/.git/HEAD`);
	},

	async init(root) {
		const r = await repo(root);
		await mkdirp(r.fs, r.dir);
		await r.git.init({ fs: await fsClient(), dir: r.dir, defaultBranch: 'main' });
		await toWorkingTree(r.projectId);
	},

	async head(root) {
		const r = await repo(root);
		const fs = await fsClient();
		const branch = (await r.git.currentBranch({ fs, dir: r.dir, fullname: false })) ?? null;

		let unborn = false;
		try {
			await r.git.resolveRef({ fs, dir: r.dir, ref: 'HEAD' });
		} catch {
			unborn = true;
		}

		const info: GitHeadInfo = {
			branch,
			unborn,
			merging: (await readConflicts(r.fs, r.dir)).length > 0
		};
		if (!branch || unborn) return info;

		const remote =
			(await r.git.getConfig({ fs, dir: r.dir, path: `branch.${branch}.remote` })) || 'origin';
		const trackingRef = `refs/remotes/${remote}/${branch}`;
		let trackingOid: string | undefined;
		try {
			trackingOid = await r.git.resolveRef({ fs, dir: r.dir, ref: trackingRef });
		} catch {
			return info;
		}

		info.upstream = `${remote}/${branch}`;
		const [local, tracked] = await Promise.all([
			r.git.log({ fs, dir: r.dir, ref: branch, depth: AHEAD_BEHIND_DEPTH }),
			r.git.log({ fs, dir: r.dir, ref: trackingOid, depth: AHEAD_BEHIND_DEPTH })
		]);
		const localOids = new Set(local.map((c) => c.oid));
		const trackedOids = new Set(tracked.map((c) => c.oid));
		info.ahead = local.filter((c) => !trackedOids.has(c.oid)).length;
		info.behind = tracked.filter((c) => !localOids.has(c.oid)).length;
		return info;
	},

	async status(root) {
		const r = await repo(root);
		await toWorkingTree(r.projectId);
		const matrix = (await r.git.statusMatrix({ fs: await fsClient(), dir: r.dir })) as StatusRow[];

		const conflicts = new Set(await readConflicts(r.fs, r.dir));
		const out: GitChange[] = [];
		for (const row of matrix) {
			if (conflicts.has(row[0])) {
				out.push({ path: row[0], status: 'conflicted', staged: false });
				continue;
			}
			out.push(...changesFrom(row));
		}
		return out;
	},

	async stage(root, paths) {
		const r = await repo(root);
		const fs = await fsClient();
		await toWorkingTree(r.projectId);
		for (const filepath of paths) {
			if (await exists(r.fs, `${r.dir}/${filepath}`)) {
				await r.git.add({ fs, dir: r.dir, filepath });
			} else {
				await r.git.remove({ fs, dir: r.dir, filepath });
			}
		}
		// Staging a conflicted file is how it gets marked resolved, same as `git add`.
		const left = (await readConflicts(r.fs, r.dir)).filter((p) => !paths.includes(p));
		await writeConflicts(r.fs, r.dir, left);
	},

	async unstage(root, paths) {
		const r = await repo(root);
		const fs = await fsClient();
		for (const filepath of paths) {
			await r.git.resetIndex({ fs, dir: r.dir, filepath });
		}
	},

	async discard(root, paths) {
		const r = await repo(root);
		const fs = await fsClient();
		await toWorkingTree(r.projectId);

		const tracked = new Set(
			((await r.git.statusMatrix({ fs, dir: r.dir })) as StatusRow[])
				.filter(([, head]) => head === 1)
				.map(([path]) => path)
		);

		const restore = paths.filter((p) => tracked.has(p));
		for (const p of paths) if (!tracked.has(p)) await unlinkIfPresent(r.fs, `${r.dir}/${p}`);
		if (restore.length > 0) {
			await r.git.checkout({
				fs,
				dir: r.dir,
				filepaths: restore,
				force: true,
				noUpdateHead: true
			});
		}

		const left = (await readConflicts(r.fs, r.dir)).filter((p) => !paths.includes(p));
		await writeConflicts(r.fs, r.dir, left);
		await fromWorkingTree(r.projectId);
		notifyTreeChanged(r.projectId);
	},

	async diff(root, path, staged) {
		const r = await repo(root);
		await toWorkingTree(r.projectId);
		const { original, modified, binary } = await versions(r, path, staged);
		return unifiedDiff(path, original, modified, {
			binary,
			added: original === '' && !binary,
			deleted: modified === '' && !binary
		});
	},

	async fileVersions(root, path, staged) {
		const r = await repo(root);
		await toWorkingTree(r.projectId);
		return versions(r, path, staged);
	},

	async commit(root, message) {
		const r = await repo(root);
		const oid = await r.git.commit({
			fs: await fsClient(),
			dir: r.dir,
			message,
			author: author()
		});
		await writeConflicts(r.fs, r.dir, []);
		return oid.slice(0, 7);
	},

	async log(root, limit = 30) {
		const r = await repo(root);
		try {
			const commits = await r.git.log({ fs: await fsClient(), dir: r.dir, depth: limit });
			return commits.map(
				(c): GitCommitEntry => ({
					hash: c.oid.slice(0, 7),
					summary: c.commit.message.split('\n')[0],
					author: c.commit.author.name,
					time: c.commit.author.timestamp
				})
			);
		} catch {
			// An unborn HEAD has no log; the panel shows the empty state instead.
			return [];
		}
	},

	async clone(url, dest) {
		const r = await repo(dest);
		await mkdirp(r.fs, r.dir);
		await r.git.clone({
			fs: await fsClient(),
			http: r.http,
			dir: r.dir,
			singleBranch: true,
			...remoteOpts(url),
			url: splitAuth(url).url ?? url
		});
		await fromWorkingTree(r.projectId);
		notifyTreeChanged(r.projectId);
		return r.dir;
	},

	async remotes(root) {
		const r = await repo(root);
		const list = await r.git.listRemotes({ fs: await fsClient(), dir: r.dir });
		return list.map((x): GitRemote => ({ name: x.remote, url: x.url }));
	},

	async remoteAdd(root, name, url) {
		const r = await repo(root);
		await r.git.addRemote({ fs: await fsClient(), dir: r.dir, remote: name, url, force: true });
	},

	async remoteSetUrl(root, name, url) {
		const r = await repo(root);
		await r.git.addRemote({ fs: await fsClient(), dir: r.dir, remote: name, url, force: true });
	},

	async remoteRename(root, from, to) {
		const r = await repo(root);
		const fs = await fsClient();
		const list = await r.git.listRemotes({ fs, dir: r.dir });
		const found = list.find((x) => x.remote === from);
		if (!found) throw new Error(`No such remote: ${from}`);
		await r.git.addRemote({ fs, dir: r.dir, remote: to, url: found.url, force: true });
		await r.git.deleteRemote({ fs, dir: r.dir, remote: from });
	},

	async remoteRemove(root, name) {
		const r = await repo(root);
		await r.git.deleteRemote({ fs: await fsClient(), dir: r.dir, remote: name });
	},

	async fetch(root, url) {
		const r = await repo(root);
		await r.git.fetch({
			fs: await fsClient(),
			http: r.http,
			dir: r.dir,
			singleBranch: true,
			tags: false,
			...remoteOpts(url)
		});
	},

	async pull(root, url) {
		const r = await repo(root);
		const result = await pullInto(r, url);
		if (result.conflicts) throw new Error(result.message);
		return result.message;
	},

	async push(root, url, branch, remote) {
		const r = await repo(root);
		const result = await r.git.push({
			fs: await fsClient(),
			http: r.http,
			dir: r.dir,
			...(branch ? { ref: branch } : {}),
			...(remote ? { remote } : {}),
			...remoteOpts(url)
		});
		// Push reports per-ref failures in the result rather than throwing, and the
		// panel's error dialog only sees thrown errors.
		if (!result.ok) throw new Error(result.error || 'The remote rejected this push.');
		const rejected = Object.entries(result.refs ?? {}).find(([, s]) => !s.ok);
		if (rejected) throw new Error(rejected[1].error || `The remote rejected ${rejected[0]}.`);
		return 'Pushed.';
	},

	settings: {
		async get() {
			const { name, email } = getIdentity();
			return { name, email, chosen: hasIdentity(), corsProxy: getCorsProxy() ?? '' };
		},
		async save(next) {
			setIdentity({ name: next.name, email: next.email });
			if (next.corsProxy !== undefined && next.corsProxy !== null) {
				// Blank means "no relay", which must survive as a choice rather than
				// falling back to the default proxy on the next read.
				setCorsProxy(next.corsProxy || 'none');
			}
		}
	},

	async sync(root, url, branch, remote) {
		const r = await repo(root);
		const pulled = await pullInto(r, url);
		if (pulled.conflicts) return pulled;
		await this.push!(root, url, branch, remote);
		return { conflicts: false, message: `${pulled.message} Pushed.` };
	}
};

const AHEAD_BEHIND_DEPTH = 500;

async function versions(
	r: Repo,
	path: string,
	staged: boolean
): Promise<{ original: string; modified: string; binary: boolean }> {
	const left = staged ? await headBytes(r, path) : await stageBytes(r, path);
	const right = staged ? await stageBytes(r, path) : await readBytes(r.fs, `${r.dir}/${path}`);
	// An untracked file has no index entry; HEAD is then the only sensible "before".
	const before = !staged && left === null ? await headBytes(r, path) : left;
	return {
		original: text(before),
		modified: text(right),
		binary: looksBinary(before) || looksBinary(right)
	};
}

/** Fetch + merge, leaving conflict markers in the tree rather than aborting, so
 *  conflicts can be resolved in the editor and staged like any other change. */
async function pullInto(r: Repo, url?: string): Promise<{ conflicts: boolean; message: string }> {
	const fs = await fsClient();
	const branch = await r.git.currentBranch({ fs, dir: r.dir, fullname: false });
	if (!branch) throw new Error('No branch is checked out, so there is nothing to pull into.');

	await r.git.fetch({
		fs,
		http: r.http,
		dir: r.dir,
		singleBranch: true,
		tags: false,
		...remoteOpts(url)
	});

	const remote =
		(await r.git.getConfig({ fs, dir: r.dir, path: `branch.${branch}.remote` })) || 'origin';
	const theirs = `refs/remotes/${remote}/${branch}`;

	try {
		const merged = await r.git.merge({
			fs,
			dir: r.dir,
			ours: branch,
			theirs,
			abortOnConflict: false,
			author: author(),
			message: `Merge branch '${branch}' of ${remote}`
		});
		if (merged.alreadyMerged) return { conflicts: false, message: 'Already up to date.' };

		await r.git.checkout({ fs, dir: r.dir, ref: branch, force: true, noUpdateHead: true });
		await writeConflicts(r.fs, r.dir, []);
		await fromWorkingTree(r.projectId);
		notifyTreeChanged(r.projectId);
		return {
			conflicts: false,
			message: merged.fastForward ? 'Fast-forwarded to the remote.' : 'Merged the remote changes.'
		};
	} catch (e) {
		const conflicted = conflictPaths(e);
		if (!conflicted) throw e;
		await writeConflicts(r.fs, r.dir, conflicted);
		await fromWorkingTree(r.projectId);
		notifyTreeChanged(r.projectId);
		return {
			conflicts: true,
			message: `${conflicted.length} file${conflicted.length === 1 ? '' : 's'} conflict with the remote. Fix the marked sections, then stage and commit them: ${conflicted.join(', ')}`
		};
	}
}

function conflictPaths(e: unknown): string[] | null {
	const err = e as { code?: string; data?: { filepaths?: string[] } } | null;
	if (err?.code !== 'MergeConflictError') return null;
	return err.data?.filepaths ?? [];
}

// --- Working-tree change notifications --------------------------------------
// Pull / clone / discard rewrite files behind the editor's back; the route
// subscribes so the open session reloads instead of silently overwriting them.
type TreeListener = (projectId: string) => void;
const listeners = new Set<TreeListener>();

export function onWorkingTreeChanged(fn: TreeListener): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

function notifyTreeChanged(projectId: string): void {
	for (const fn of listeners) fn(projectId);
}

export { rootFor as gitRootFor, projectIdFrom, isMissing };
