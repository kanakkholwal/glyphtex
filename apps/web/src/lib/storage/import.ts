import { PER_FILE_BYTES, PER_PROJECT_BYTES, formatBytes } from './quota';
import { normalisePath, type NewFile } from './projects';
import { readZip } from './zip';

/** Everything else is stored as bytes, so an unknown type can't be corrupted. */
const TEXT_EXTENSIONS = new Set([
	'tex',
	'ltx',
	'bib',
	'cls',
	'sty',
	'bst',
	'clo',
	'def',
	'cfg',
	'txt',
	'md',
	'csv',
	'tsv',
	'json',
	'yml',
	'yaml',
	'xml',
	'svg',
	'rnw',
	'gitignore'
]);

const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|\.git|\.svn|node_modules|\.svelte-kit)(\/|$)/;

export const isTextPath = (path: string) =>
	TEXT_EXTENSIONS.has(path.split('.').pop()?.toLowerCase() ?? '');

export type ImportResult = {
	files: NewFile[];
	/** Name suggested for the document, from the archive or folder. */
	name: string;
	/** Files left out, with why — reported rather than silently dropped. */
	skipped: string[];
};

/** Drops a single shared top-level folder, which most archives wrap everything in. */
function stripCommonRoot(paths: string[]): (path: string) => string {
	const roots = new Set(paths.map((p) => p.split('/')[0]));
	if (roots.size !== 1 || paths.every((p) => !p.includes('/'))) return (p) => p;
	const root = `${[...roots][0]}/`;
	return (p) => (p.startsWith(root) ? p.slice(root.length) : p);
}

function collect(
	raw: { path: string; bytes: Uint8Array }[],
	fallbackName: string,
	stripRoot = true
): ImportResult {
	const usable = raw.filter((f) => f.path && !JUNK.test(f.path));
	const strip = stripRoot ? stripCommonRoot(usable.map((f) => f.path)) : (p: string) => p;
	const suggested = raw.length ? raw[0].path.split('/')[0] : fallbackName;

	const files: NewFile[] = [];
	const skipped: string[] = [];
	const decoder = new TextDecoder('utf-8', { fatal: false });
	let total = 0;

	for (const entry of usable) {
		let path: string;
		try {
			path = normalisePath(strip(entry.path));
		} catch {
			skipped.push(`${entry.path} (unusable name)`);
			continue;
		}
		if (entry.bytes.byteLength > PER_FILE_BYTES) {
			skipped.push(`${path} (over ${formatBytes(PER_FILE_BYTES)})`);
			continue;
		}
		if (total + entry.bytes.byteLength > PER_PROJECT_BYTES) {
			skipped.push(`${path} (document limit reached)`);
			continue;
		}
		total += entry.bytes.byteLength;
		files.push(
			isTextPath(path) ? { path, text: decoder.decode(entry.bytes) } : { path, data: entry.bytes }
		);
	}

	const name = (
		usable.length && strip(usable[0].path) !== usable[0].path ? suggested : fallbackName
	)
		.replace(/\.zip$/i, '')
		.trim();

	return { files, name: name || 'Imported', skipped };
}

export async function importZipFile(file: File): Promise<ImportResult> {
	const entries = await readZip(new Uint8Array(await file.arrayBuffer()));
	if (entries.length === 0) throw new Error('That .zip is empty.');
	return collect(
		entries.map((e) => ({ path: e.path.replace(/\\/g, '/'), bytes: e.data })),
		file.name.replace(/\.zip$/i, '')
	);
}

/** A dropped folder's files (from `filesFromDataTransfer`), imported as a project. */
export async function importFolder(files: File[]): Promise<ImportResult> {
	if (files.length === 0) throw new Error('That folder is empty.');

	const raw = await Promise.all(
		files.map(async (file) => ({
			path: droppedPath(file).replace(/\\/g, '/'),
			bytes: new Uint8Array(await file.arrayBuffer())
		}))
	);
	const root = raw[0]?.path.split('/')[0] ?? 'Imported';
	return collect(raw, root);
}

type FsEntry = {
	isFile: boolean;
	isDirectory: boolean;
	fullPath: string;
	file?: (cb: (f: File) => void, err: (e: unknown) => void) => void;
	createReader?: () => {
		readEntries: (cb: (e: FsEntry[]) => void, err: (e: unknown) => void) => void;
	};
};

const readFile = (entry: FsEntry) =>
	new Promise<File>((resolve, reject) => entry.file!(resolve, reject));

const readDir = (reader: ReturnType<NonNullable<FsEntry['createReader']>>) =>
	new Promise<FsEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));

/** Recurse a dropped directory entry, keeping each file's path within it. */
async function walkEntry(entry: FsEntry, out: File[]): Promise<void> {
	if (entry.isFile && entry.file) {
		const file = await readFile(entry);
		// fullPath starts with '/'; the relative path drives the stored tree.
		Object.defineProperty(file, '_glyphxPath', { value: entry.fullPath.replace(/^\//, '') });
		out.push(file);
		return;
	}
	if (entry.isDirectory && entry.createReader) {
		const reader = entry.createReader();
		// readEntries returns at most ~100 per call, so drain until empty.
		for (;;) {
			const batch = await readDir(reader);
			if (batch.length === 0) break;
			for (const child of batch) await walkEntry(child, out);
		}
	}
}

/**
 * Files from a drop, descending into any dropped folders via webkitGetAsEntry
 * (supported in Firefox, Chrome, Safari, Edge). Falls back to the flat list.
 */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
	const items = Array.from(dt.items).filter((i) => i.kind === 'file');
	const getEntry = (item: DataTransferItem): FsEntry | null =>
		(item as unknown as { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry?.() ?? null;

	if (items.length === 0 || !getEntry(items[0])) return Array.from(dt.files);

	const out: File[] = [];
	for (const item of items) {
		const entry = getEntry(item);
		if (entry) await walkEntry(entry, out);
		else {
			const file = item.getAsFile();
			if (file) out.push(file);
		}
	}
	return out;
}

/** The relative path a dropped folder walk stashed on each file, if any. */
const droppedPath = (file: File): string =>
	(file as unknown as { _glyphxPath?: string })._glyphxPath ?? file.name;

/** Loose files dropped or picked into an open document (images, .tex, folders). */
export async function importLooseFiles(
	list: FileList | File[],
	intoDir = ''
): Promise<ImportResult> {
	const picked = Array.from(list);
	const raw = await Promise.all(
		picked.map(async (file) => {
			const rel = droppedPath(file);
			return {
				path: intoDir ? `${intoDir}/${rel}` : rel,
				bytes: new Uint8Array(await file.arrayBuffer())
			};
		})
	);
	// Keep folder structure as dropped — a `figures/` folder stays `figures/*`
	// inside the document rather than being flattened to the root.
	const result = collect(raw, 'Imported', false);
	return { ...result, name: 'Imported' };
}
