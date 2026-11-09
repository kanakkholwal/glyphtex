import { errors } from "./errors.ts";

const MAX_PATH_LENGTH = 512;
const FORBIDDEN = /[\u0000-\u001f\u007f\\:*?"<>|]/;

/** Normalises a project-relative file path, rejecting traversal, absolute paths and odd characters. */
export function normalizePath(input: string): string {
	const path = input.normalize("NFC");
	if (!path || path.length > MAX_PATH_LENGTH) throw errors.badRequest("Invalid file path.");
	if (path.startsWith("/") || FORBIDDEN.test(path)) throw errors.badRequest("Invalid file path.");
	const segments = path.split("/");
	if (segments.some((s) => s === "" || s === "." || s === ".." || s.trim() !== s)) {
		throw errors.badRequest("Invalid file path.");
	}
	return segments.join("/");
}

const TEXT_EXTENSIONS = new Set([
	"tex",
	"bib",
	"cls",
	"sty",
	"bst",
	"bbx",
	"cbx",
	"lbx",
	"dtx",
	"ins",
	"def",
	"cfg",
	"clo",
	"ltx",
	"txt",
	"md",
	"csv",
	"tsv",
	"json",
	"yaml",
	"yml",
	"xml",
	"svg",
	"gitignore",
	"latexmkrc",
	"tikz",
	"pgf",
	"dat",
	"lua",
	"py",
	"r",
	"m",
	"sh"
]);

/** Text files are stored inline in Postgres; everything else goes to blob storage. */
export function isTextPath(path: string) {
	const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
	const dot = name.lastIndexOf(".");
	return TEXT_EXTENSIONS.has(dot === -1 ? name : name.slice(dot + 1));
}
