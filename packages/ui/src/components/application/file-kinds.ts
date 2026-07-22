export type FileKind = "latex" | "markdown" | "text" | "image" | "pdf" | "binary";

/**
 * The LaTeX family — sources, bibliography, and the LaTeX-command auxiliary
 * files a project carries (reference.bib, the .toc, .aux, …). All of these open
 * in the LaTeX editor with highlighting *and* the format toolbar, since they're
 * all LaTeX-project text the user edits alongside the document. Plain logs
 * (.log / .blg / .fls / .fdb_latexmk) stay plain text via the default branch.
 */
const LATEX_EXT = new Set([
	// sources
	"tex", "latex", "ltx", "sty", "cls", "clo", "def", "dtx", "ins", "ltb",
	// bibliography
	"bib", "bibtex", "bbl", "bst",
	// auxiliary / generated LaTeX-command files
	"aux", "toc", "lof", "lot", "out", "nav", "snm", "vrb", "lol", "brf",
	"idx", "ind", "glo", "gls", "ent", "ldf",
]);
const MARKDOWN_EXT = new Set(["md", "markdown", "mdx", "mkd", "mdown"]);
const IMAGE_EXT = new Set([
	"png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif", "apng", "tif", "tiff",
]);
// Things we knowingly can't render in the webview without a dedicated library.
const BINARY_EXT = new Set([
	"zip", "gz", "tar", "rar", "7z", "bz2", "xz",
	"doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
	"mp4", "mov", "avi", "mkv", "webm", "mp3", "wav", "flac", "ogg", "m4a",
	"ttf", "otf", "woff", "woff2", "eot",
	"exe", "dll", "so", "dylib", "bin", "dmg", "iso", "app",
	"psd", "ai", "sketch", "fig", "xd",
	"db", "sqlite", "sqlite3",
]);

/** Leaf-or-path → lowercase extension (without the dot), or "" if none. */
function extOf(name: string): string {
	const leaf = name.slice(Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\")) + 1);
	const dot = leaf.lastIndexOf(".");
	// `dot <= 0` covers "no extension" and dotfiles like ".gitignore" (treated as text).
	return dot <= 0 ? "" : leaf.slice(dot + 1).toLowerCase();
}

/** Classifies by name so the workbench knows how to render a file. `binary` means
 *  "no preview without a heavy viewer" — the UI offers reveal-in-folder instead. */
export function classifyFile(name: string): FileKind {
	const ext = extOf(name);
	if (!ext) return "text"; // no extension (Makefile, LICENSE, .gitignore) → editable text
	if (ext === "pdf") return "pdf";
	if (IMAGE_EXT.has(ext)) return "image";
	if (BINARY_EXT.has(ext)) return "binary";
	if (LATEX_EXT.has(ext)) return "latex";
	if (MARKDOWN_EXT.has(ext)) return "markdown";
	return "text";
}

/** Kinds that live in the code editor (and therefore have a text buffer). */
export function isEditable(kind: FileKind): boolean {
	return kind === "latex" || kind === "markdown" || kind === "text";
}

/** The CodeMirror language mode for an editable kind. */
export function editorLanguage(kind: FileKind): "latex" | "markdown" | "plain" {
	if (kind === "latex") return "latex";
	if (kind === "markdown") return "markdown";
	return "plain";
}
