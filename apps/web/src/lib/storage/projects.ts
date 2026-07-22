import { BY_PROJECT, FILES, PROJECTS, StorageError, del, get, getAll, put, tx } from './db';
import { PER_FILE_BYTES, PER_PROJECT_BYTES, formatBytes } from './quota';

/** A stored document. `entry` is the file compiled as the root. */
export type StoredProject = {
	id: string;
	name: string;
	entry: string;
	/** Every file path, so the list can show counts without reading contents. */
	paths: string[];
	/** Folders with no files in them; the tree is otherwise derived from paths. */
	folders: string[];
	createdAt: number;
	updatedAt: number;
	bytes: number;
	/** Pinned by the user. Absent on documents saved before starring existed. */
	starred?: boolean;
};

/** One file. Exactly one of `text` / `data` is set — `data` carries images. */
export type StoredFile = {
	key: string;
	projectId: string;
	path: string;
	text?: string;
	data?: Uint8Array;
	size: number;
	updatedAt: number;
};

export type NewFile = { path: string; text?: string; data?: Uint8Array };

const fileKey = (projectId: string, path: string) => `${projectId}:${path}`;
const sizeOf = (f: NewFile) => (f.data ? f.data.byteLength : new Blob([f.text ?? '']).size);

export const isBinaryPath = (path: string) =>
	/\.(png|jpe?g|gif|webp|bmp|tiff?|pdf|eps|ttf|otf|woff2?)$/i.test(path);

function newId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
	return `p-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Normalises to a forward-slash relative path and rejects escapes. */
export function normalisePath(path: string): string {
	const clean = path
		.replace(/\\/g, '/')
		.replace(/^\/+/, '')
		.split('/')
		.filter((s) => s && s !== '.')
		.join('/');
	if (!clean || clean.split('/').includes('..')) {
		throw new StorageError(`"${path}" is not a valid file name.`);
	}
	return clean;
}

export async function listProjects(): Promise<StoredProject[]> {
	const all = await tx(PROJECTS, 'readonly', (t) => getAll<StoredProject>(t.objectStore(PROJECTS)));
	return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<StoredProject | undefined> {
	return tx(PROJECTS, 'readonly', (t) => get<StoredProject>(t.objectStore(PROJECTS), id));
}

export async function createProject(name: string, files: NewFile[]): Promise<StoredProject> {
	const now = Date.now();
	const prepared = files.map((f) => ({ ...f, path: normalisePath(f.path) }));
	const bytes = prepared.reduce((n, f) => n + sizeOf(f), 0);
	if (bytes > PER_PROJECT_BYTES) {
		throw new StorageError(`That document is over the ${formatBytes(PER_PROJECT_BYTES)} limit.`);
	}

	const project: StoredProject = {
		id: newId(),
		name: name.trim() || 'Untitled',
		entry: prepared.find((f) => f.path.endsWith('.tex'))?.path ?? prepared[0]?.path ?? 'main.tex',
		paths: prepared.map((f) => f.path),
		folders: [],
		createdAt: now,
		updatedAt: now,
		bytes
	};

	await tx([PROJECTS, FILES], 'readwrite', async (t) => {
		await put(t.objectStore(PROJECTS), project);
		const store = t.objectStore(FILES);
		for (const f of prepared) {
			await put(store, {
				key: fileKey(project.id, f.path),
				projectId: project.id,
				path: f.path,
				text: f.text,
				data: f.data,
				size: sizeOf(f),
				updatedAt: now
			} satisfies StoredFile);
		}
	});
	return project;
}

export async function readFiles(projectId: string): Promise<StoredFile[]> {
	const files = await tx(FILES, 'readonly', (t) =>
		getAll<StoredFile>(t.objectStore(FILES).index(BY_PROJECT), IDBKeyRange.only(projectId))
	);
	return files.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Replaces the project's files wholesale, in one transaction, enforcing the
 * per-document cap. Files absent from `files` are deleted.
 */
export async function writeFiles(projectId: string, files: NewFile[]): Promise<number> {
	const now = Date.now();
	const prepared = files.map((f) => ({ ...f, path: normalisePath(f.path) }));

	for (const f of prepared) {
		const size = sizeOf(f);
		if (size > PER_FILE_BYTES) {
			throw new StorageError(
				`"${f.path}" is ${formatBytes(size)} — over the ${formatBytes(PER_FILE_BYTES)} limit for one file.`
			);
		}
	}
	const bytes = prepared.reduce((n, f) => n + sizeOf(f), 0);
	if (bytes > PER_PROJECT_BYTES) {
		throw new StorageError(
			`This document is ${formatBytes(bytes)}, over the ${formatBytes(PER_PROJECT_BYTES)} limit. Remove a file or an image.`
		);
	}

	await tx([PROJECTS, FILES], 'readwrite', async (t) => {
		const projects = t.objectStore(PROJECTS);
		const project = await get<StoredProject>(projects, projectId);
		if (!project) throw new StorageError('That document no longer exists.');

		const store = t.objectStore(FILES);
		const existing = await getAll<StoredFile>(store.index(BY_PROJECT), IDBKeyRange.only(projectId));
		const keep = new Set(prepared.map((f) => f.path));
		for (const old of existing) {
			if (!keep.has(old.path)) await del(store, old.key);
		}
		for (const f of prepared) {
			await put(store, {
				key: fileKey(projectId, f.path),
				projectId,
				path: f.path,
				text: f.text,
				data: f.data,
				size: sizeOf(f),
				updatedAt: now
			} satisfies StoredFile);
		}

		const entry = keep.has(project.entry)
			? project.entry
			: (prepared.find((f) => f.path.endsWith('.tex'))?.path ?? project.entry);
		await put(projects, {
			...project,
			entry,
			paths: prepared.map((f) => f.path),
			bytes,
			updatedAt: now
		});
	});
	return bytes;
}

async function patch(id: string, change: Partial<StoredProject>): Promise<StoredProject> {
	return tx(PROJECTS, 'readwrite', async (t) => {
		const store = t.objectStore(PROJECTS);
		const project = await get<StoredProject>(store, id);
		if (!project) throw new StorageError('That document no longer exists.');
		const next = { ...project, ...change, updatedAt: Date.now() };
		await put(store, next);
		return next;
	});
}

/**
 * Deliberately not `patch`: starring is not an edit, so it must not bump
 * `updatedAt` — that would reshuffle "Newest first" and fake activity in Recent.
 */
export function setStarred(id: string, starred: boolean): Promise<StoredProject> {
	return tx(PROJECTS, 'readwrite', async (t) => {
		const store = t.objectStore(PROJECTS);
		const project = await get<StoredProject>(store, id);
		if (!project) throw new StorageError('That document no longer exists.');
		const next = { ...project, starred };
		await put(store, next);
		return next;
	});
}

export const renameProject = (id: string, name: string) =>
	patch(id, { name: name.trim() || 'Untitled' });
export const setEntry = (id: string, entry: string) => patch(id, { entry: normalisePath(entry) });
export const setFolders = (id: string, folders: string[]) => patch(id, { folders });

export async function deleteProject(id: string): Promise<void> {
	await tx([PROJECTS, FILES], 'readwrite', async (t) => {
		await del(t.objectStore(PROJECTS), id);
		const store = t.objectStore(FILES);
		const files = await getAll<StoredFile>(store.index(BY_PROJECT), IDBKeyRange.only(id));
		for (const f of files) await del(store, f.key);
	});
}

export async function duplicateProject(id: string): Promise<StoredProject> {
	const source = await getProject(id);
	if (!source) throw new StorageError('That document no longer exists.');
	const files = await readFiles(id);
	const copy = await createProject(
		`${source.name} copy`,
		files.map((f) => ({ path: f.path, text: f.text, data: f.data }))
	);
	return copy.entry === source.entry ? copy : await setEntry(copy.id, source.entry);
}

/** Total bytes across all documents — what the settings panel reports as ours. */
export async function totalBytes(): Promise<number> {
	const projects = await listProjects();
	return projects.reduce((n, p) => n + p.bytes, 0);
}
