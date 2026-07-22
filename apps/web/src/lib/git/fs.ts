import type LightningFS from '@isomorphic-git/lightning-fs';

export type GitFs = LightningFS;
export type PromiseFs = LightningFS['promises'];

/** Every working tree lives under here, one directory per project id. */
const MOUNT = '/glyphtex';

export const rootFor = (projectId: string) => `${MOUNT}/${projectId}`;
export const projectIdFrom = (root: string) => root.split('/').filter(Boolean).pop() ?? '';

let instance: Promise<GitFs> | null = null;

/** lightning-fs needs IndexedDB, so it must never be pulled into the SSR bundle. */
export function gitFs(): Promise<GitFs> {
	instance ??= import('@isomorphic-git/lightning-fs').then((m) => new m.default('glyphtex-git'));
	return instance;
}

const errCode = (e: unknown) => (e as { code?: string } | null)?.code;

export const isMissing = (e: unknown) => errCode(e) === 'ENOENT';

export async function exists(fs: PromiseFs, path: string): Promise<boolean> {
	try {
		await fs.stat(path);
		return true;
	} catch (e) {
		if (isMissing(e)) return false;
		throw e;
	}
}

export async function mkdirp(fs: PromiseFs, dir: string): Promise<void> {
	let cur = '';
	for (const part of dir.split('/').filter(Boolean)) {
		cur += `/${part}`;
		try {
			await fs.mkdir(cur);
		} catch (e) {
			if (errCode(e) !== 'EEXIST') throw e;
		}
	}
}

export const dirName = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';

/** Every file under `dir` as a forward-slash relative path. `.git` is never walked. */
export async function listTree(fs: PromiseFs, dir: string, prefix = ''): Promise<string[]> {
	let names: string[];
	try {
		names = await fs.readdir(dir);
	} catch (e) {
		if (isMissing(e)) return [];
		throw e;
	}

	const out: string[] = [];
	for (const name of names) {
		if (name === '.git') continue;
		const rel = prefix ? `${prefix}/${name}` : name;
		const stat = await fs.lstat(`${dir}/${name}`);
		if (stat.isDirectory()) out.push(...(await listTree(fs, `${dir}/${name}`, rel)));
		else out.push(rel);
	}
	return out;
}

export async function readBytes(fs: PromiseFs, path: string): Promise<Uint8Array | null> {
	try {
		return (await fs.readFile(path)) as Uint8Array;
	} catch (e) {
		if (isMissing(e)) return null;
		throw e;
	}
}

export async function writeBytes(fs: PromiseFs, path: string, data: Uint8Array): Promise<void> {
	await mkdirp(fs, dirName(path));
	await fs.writeFile(path, data);
}

export async function unlinkIfPresent(fs: PromiseFs, path: string): Promise<void> {
	try {
		await fs.unlink(path);
	} catch (e) {
		if (!isMissing(e)) throw e;
	}
}

/** Drop directories left empty by a delete, deepest first, stopping at `dir`. */
export async function pruneEmptyDirs(fs: PromiseFs, dir: string, from: string): Promise<void> {
	let cur = from;
	while (cur.startsWith(dir) && cur !== dir) {
		let names: string[];
		try {
			names = await fs.readdir(cur);
		} catch {
			return;
		}
		if (names.length > 0) return;
		try {
			await fs.rmdir(cur);
		} catch {
			return;
		}
		cur = dirName(cur);
	}
}

export function sameBytes(a: Uint8Array | null, b: Uint8Array): boolean {
	if (!a || a.byteLength !== b.byteLength) return false;
	for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
	return true;
}
