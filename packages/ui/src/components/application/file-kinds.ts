export type FileKind = 'latex' | 'markdown' | 'text' | 'image' | 'pdf' | 'binary';

/**
 * The LaTeX family: sources, bibliography, and the LaTeX-command auxiliary
 * files a project carries (reference.bib, the .toc, .aux, …). All of these open
 * in the LaTeX editor with highlighting *and* the format toolbar, since they're
 * all LaTeX-project text the user edits alongside the document. Plain logs
 * (.log / .blg / .fls / .fdb_latexmk) stay plain text via the default branch.
 */
const LATEX_EXT = new Set([
	// sources
	'tex',
	'latex',
	'ltx',
	'sty',
	'cls',
	'clo',
	'def',
	'dtx',
	'ins',
	'ltb',
	// bibliography
	'bib',
	'bibtex',
	'bbl',
	'bst',
	// auxiliary / generated LaTeX-command files
	'aux',
	'toc',
	'lof',
	'lot',
	'out',
	'nav',
	'snm',
	'vrb',
	'lol',
	'brf',
	'idx',
	'ind',
	'glo',
	'gls',
	'ent',
	'ldf'
]);
const MARKDOWN_EXT = new Set(['md', 'markdown', 'mdx', 'mkd', 'mdown']);
const IMAGE_EXT = new Set([
	'png',
	'jpg',
	'jpeg',
	'gif',
	'webp',
	'svg',
	'bmp',
	'ico',
	'avif',
	'apng',
	'tif',
	'tiff'
]);
// Things we knowingly can't render in the webview without a dedicated library.
const BINARY_EXT = new Set([
	'zip',
	'gz',
	'tar',
	'rar',
	'7z',
	'bz2',
	'xz',
	'doc',
	'docx',
	'xls',
	'xlsx',
	'ppt',
	'pptx',
	'odt',
	'ods',
	'odp',
	'mp4',
	'mov',
	'avi',
	'mkv',
	'webm',
	'mp3',
	'wav',
	'flac',
	'ogg',
	'm4a',
	'ttf',
	'otf',
	'woff',
	'woff2',
	'eot',
	'exe',
	'dll',
	'so',
	'dylib',
	'bin',
	'dmg',
	'iso',
	'app',
	'psd',
	'ai',
	'sketch',
	'fig',
	'xd',
	'db',
	'sqlite',
	'sqlite3'
]);

/** Leaf-or-path → lowercase extension (without the dot), or "" if none. */
function extOf(name: string): string {
	const leaf = name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
	const dot = leaf.lastIndexOf('.');
	// `dot <= 0` covers "no extension" and dotfiles like ".gitignore" (treated as text).
	return dot <= 0 ? '' : leaf.slice(dot + 1).toLowerCase();
}

/** Classifies by name so the workbench knows how to render a file. `binary` means
 *  "no preview without a heavy viewer": the UI offers reveal-in-folder instead. */
export function classifyFile(name: string): FileKind {
	const ext = extOf(name);
	if (!ext) return 'text'; // no extension (Makefile, LICENSE, .gitignore) → editable text
	if (ext === 'pdf') return 'pdf';
	if (IMAGE_EXT.has(ext)) return 'image';
	if (BINARY_EXT.has(ext)) return 'binary';
	if (LATEX_EXT.has(ext)) return 'latex';
	if (MARKDOWN_EXT.has(ext)) return 'markdown';
	return 'text';
}

/** Kinds that live in the code editor (and therefore have a text buffer). */
export function isEditable(kind: FileKind): boolean {
	return kind === 'latex' || kind === 'markdown' || kind === 'text';
}

/**
 * Rewritten by every compile. Their words are the source's words, so searching
 * them reports each hit two or three times over.
 */
const GENERATED_EXT = new Set([
	'aux',
	'toc',
	'lof',
	'lot',
	'out',
	'nav',
	'snm',
	'vrb',
	'lol',
	'brf',
	'idx',
	'ind',
	'ilg',
	'glo',
	'gls',
	'glg',
	'bbl',
	'blg',
	'log',
	'fls',
	'fdb_latexmk',
	'synctex',
	'dvi',
	'xdv',
	'run'
]);

/** Text that sits beside a paper without being part of it: build scripts, data,
 *  config. Searchable on request, never by default. */
const SIDECAR_EXT = new Set([
	'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'rb', 'sh', 'bash', 'zsh', 'ps1',
	'bat', 'cmd', 'r', 'jl', 'lua', 'pl', 'php', 'go', 'rs', 'c', 'h', 'cpp', 'hpp',
	'java', 'kt', 'swift', 'sql', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf',
	'json', 'csv', 'tsv', 'xml', 'html', 'htm', 'css', 'scss', 'lock', 'map'
]);

/** Never part of a document, at any scope: dependency trees, VCS internals and
 *  build output that would swamp a scan and can run to thousands of files. */
const IGNORED_DIRS = new Set([
	'node_modules',
	'.git',
	'.svn',
	'.hg',
	'.cache',
	'.venv',
	'venv',
	'__pycache__',
	'.pytest_cache',
	'.tox',
	'dist',
	'build',
	'out',
	'target',
	'.next',
	'.svelte-kit',
	'.DS_Store'
]);

/** Whether any segment of a forward-slashed path is an ignored directory. */
function inIgnoredDir(name: string): boolean {
	const parts = name.split('/');
	for (let i = 0; i < parts.length - 1; i++)
		if (IGNORED_DIRS.has(parts[i]) || parts[i].startsWith('_minted-')) return true;
	return false;
}

/** How wide a project search casts. */
export type SearchScope = 'documents' | 'all';

/** Whether project search may open this file at all. Binary and dependency trees
 *  are out at every scope: there is nothing readable in them. */
export function isSearchable(name: string): boolean {
	return isEditable(classifyFile(name)) && !inIgnoredDir(name);
}

/** Whether the file is part of the document itself, as opposed to something
 *  generated from it or sitting next to it. Drives the default search scope. */
export function isDocumentFile(name: string): boolean {
	const ext = extOf(name);
	return !GENERATED_EXT.has(ext) && !SIDECAR_EXT.has(ext);
}

// Narrower than the `latex` kind: a .bib or .aux is LaTeX-family text, but it has
// no document body, so the block model has nothing to show for it.
const VISUAL_EXT = new Set(['tex', 'latex', 'ltx']);

/** Whether a file can open in the Visual editor. */
export function isVisualEditable(name: string): boolean {
	return VISUAL_EXT.has(extOf(name));
}

/** The CodeMirror language mode for an editable kind. */
export function editorLanguage(kind: FileKind): 'latex' | 'markdown' | 'plain' {
	if (kind === 'latex') return 'latex';
	if (kind === 'markdown') return 'markdown';
	return 'plain';
}
