import {
	isBinaryPath,
	readFiles,
	writeFiles,
	type NewFile,
	type StoredFile
} from '$lib/storage/projects';
import {
	dirName,
	gitFs,
	listTree,
	mkdirp,
	pruneEmptyDirs,
	readBytes,
	rootFor,
	sameBytes,
	unlinkIfPresent,
	writeBytes,
	type PromiseFs
} from './fs';

const encoder = new TextEncoder();

function bytesOf(f: StoredFile): Uint8Array {
	return f.data ?? encoder.encode(f.text ?? '');
}

/** Bytes back to a string, or null when they aren't valid UTF-8 (a real binary). */
function asText(data: Uint8Array): string | null {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(data);
	} catch {
		return null;
	}
}

/** Project files (IndexedDB) → the git working tree, before every read of it, so
 *  `status` compares against what the editor actually saved. */
export async function toWorkingTree(projectId: string): Promise<void> {
	const fs = (await gitFs()).promises;
	const dir = rootFor(projectId);
	await mkdirp(fs, dir);

	const stored = await readFiles(projectId);
	const want = new Map(stored.map((f) => [f.path, bytesOf(f)]));

	for (const rel of await listTree(fs, dir)) {
		if (want.has(rel)) continue;
		await unlinkIfPresent(fs, `${dir}/${rel}`);
		await pruneEmptyDirs(fs, dir, dirName(`${dir}/${rel}`));
	}

	for (const [rel, data] of want) {
		const abs = `${dir}/${rel}`;
		// Rewriting unchanged files would thrash IndexedDB on every status refresh,
		// and would churn the mtimes isomorphic-git caches against.
		if (sameBytes(await readBytes(fs, abs), data)) continue;
		await writeBytes(fs, abs, data);
	}
}

/** The git working tree → project files (IndexedDB), after a checkout / discard /
 *  pull / clone. Enforces the storage quota, so an oversized repo fails here. */
export async function fromWorkingTree(projectId: string): Promise<NewFile[]> {
	const fs = (await gitFs()).promises;
	const dir = rootFor(projectId);

	const files: NewFile[] = [];
	for (const rel of await listTree(fs, dir)) {
		const data = await readBytes(fs, `${dir}/${rel}`);
		if (!data) continue;
		const text = isBinaryPath(rel) ? null : asText(data);
		files.push(text === null ? { path: rel, data } : { path: rel, text });
	}

	await writeFiles(projectId, files);
	return files;
}

export async function workingTreeBytes(
	fs: PromiseFs,
	dir: string,
	path: string
): Promise<Uint8Array | null> {
	return readBytes(fs, `${dir}/${path}`);
}

export { asText };
