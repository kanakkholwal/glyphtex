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

function collect(raw: { path: string; bytes: Uint8Array }[], fallbackName: string): ImportResult {
	const usable = raw.filter((f) => f.path && !JUNK.test(f.path));
	const strip = stripCommonRoot(usable.map((f) => f.path));
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

/** Folder pick via `<input webkitdirectory>`; paths come from webkitRelativePath. */
export async function importFolder(list: FileList): Promise<ImportResult> {
	const picked = Array.from(list);
	if (picked.length === 0) throw new Error('That folder is empty.');

	const raw = await Promise.all(
		picked.map(async (file) => ({
			path: (file.webkitRelativePath || file.name).replace(/\\/g, '/'),
			bytes: new Uint8Array(await file.arrayBuffer())
		}))
	);
	const root = raw[0]?.path.split('/')[0] ?? 'Imported';
	return collect(raw, root);
}

/** Loose files dropped into an open document (images, .tex, .bib). */
export async function importLooseFiles(
	list: FileList | File[],
	intoDir = ''
): Promise<ImportResult> {
	const picked = Array.from(list);
	const raw = await Promise.all(
		picked.map(async (file) => ({
			path: intoDir ? `${intoDir}/${file.name}` : file.name,
			bytes: new Uint8Array(await file.arrayBuffer())
		}))
	);
	// No common root to strip for loose files — they land where the user aimed.
	const result = collect(raw, 'Imported');
	return { ...result, name: 'Imported' };
}
