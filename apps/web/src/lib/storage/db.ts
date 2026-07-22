const DB_NAME = 'glyphtex';
const DB_VERSION = 1;

export const PROJECTS = 'projects';
export const FILES = 'files';
export const BY_PROJECT = 'byProject';

let open: Promise<IDBDatabase> | null = null;

/** Thrown for every storage failure the UI is expected to surface. */
export class StorageError extends Error {
	constructor(
		message: string,
		readonly cause?: unknown
	) {
		super(message);
		this.name = 'StorageError';
	}
}

function request<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export function openDb(): Promise<IDBDatabase> {
	if (typeof indexedDB === 'undefined') {
		return Promise.reject(
			new StorageError('This browser has no IndexedDB, so documents cannot be saved.')
		);
	}

	open ??= new Promise<IDBDatabase>((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(PROJECTS)) {
				db.createObjectStore(PROJECTS, { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains(FILES)) {
				const files = db.createObjectStore(FILES, { keyPath: 'key' });
				files.createIndex(BY_PROJECT, 'projectId', { unique: false });
			}
		};

		req.onsuccess = () => {
			const db = req.result;
			// Another tab opened a newer version; this connection must yield or it
			// blocks that upgrade forever.
			db.onversionchange = () => {
				db.close();
				open = null;
			};
			resolve(db);
		};
		req.onerror = () => reject(new StorageError('Could not open local storage.', req.error));
		req.onblocked = () =>
			reject(new StorageError('Another GlyphTeX tab is holding storage open. Close it and retry.'));
	}).catch((error) => {
		open = null;
		throw error;
	});

	return open;
}

/** Runs `body` in one transaction and resolves only once it commits. */
export async function tx<T>(
	stores: string | string[],
	mode: IDBTransactionMode,
	body: (t: IDBTransaction) => Promise<T> | T
): Promise<T> {
	const db = await openDb();
	const t = db.transaction(stores, mode);

	const done = new Promise<void>((resolve, reject) => {
		t.oncomplete = () => resolve();
		t.onabort = () => reject(t.error ?? new Error('aborted'));
		t.onerror = () => reject(t.error);
	});

	let result: T;
	try {
		result = await body(t);
	} catch (error) {
		try {
			t.abort();
		} catch {
			/* already settled */
		}
		throw error;
	}

	// Resolving before commit would let a caller read back a write that later
	// aborts on quota.
	try {
		await done;
	} catch (error) {
		const quota = error instanceof DOMException && error.name === 'QuotaExceededError';
		throw new StorageError(
			quota
				? 'Out of browser storage. Delete a document or some images and try again.'
				: 'Could not save to local storage.',
			error
		);
	}
	return result;
}

export const get = <T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> =>
	request(store.get(key) as IDBRequest<T | undefined>);
export const getAll = <T>(source: IDBObjectStore | IDBIndex, query?: IDBKeyRange): Promise<T[]> =>
	request(source.getAll(query) as IDBRequest<T[]>);
export const put = (store: IDBObjectStore, value: unknown): Promise<IDBValidKey> =>
	request(store.put(value));
export const del = (store: IDBObjectStore, key: IDBValidKey | IDBKeyRange): Promise<undefined> =>
	request(store.delete(key));
