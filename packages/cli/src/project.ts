import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

/** Folders that are never part of a document, and would make a build slow or leak the host. */
const SKIP_DIRS = new Set([".git", "node_modules", ".glyphtex", ".svn", ".hg", ".idea", ".vscode"]);
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

export class UsageError extends Error {}

export interface Project {
	/** Absolute folder every path is relative to. */
	root: string;
	/** Forward-slashed entry path, relative to root. */
	entry: string;
}

const toPosix = (p: string) => p.split(sep).join("/");

/** Does this file look like a LaTeX root, i.e. it begins a document? */
export function looksLikeRoot(source: string): boolean {
	return /\\documentclass\b/.test(source) && /\\begin\{document\}/.test(source);
}

/**
 * The target is a file or a folder. A folder resolves to `main.tex`, else the only `.tex` file
 * that begins a document; several candidates is an error that names them, so nothing is guessed.
 */
export async function resolveProject(target = "."): Promise<Project> {
	const abs = resolve(target);
	let info: Awaited<ReturnType<typeof stat>>;
	try {
		info = await stat(abs);
	} catch {
		throw new UsageError(`"${target}" does not exist.`);
	}
	if (info.isFile()) {
		if (!/\.(tex|ltx)$/i.test(abs)) throw new UsageError(`"${target}" is not a .tex file.`);
		return { root: dirname(abs), entry: basename(abs) };
	}

	const names = (await readdir(abs)).filter((n) => /\.(tex|ltx)$/i.test(n));
	if (names.includes("main.tex")) return { root: abs, entry: "main.tex" };
	const roots: string[] = [];
	for (const name of names) {
		if (looksLikeRoot(await readFile(join(abs, name), "utf8"))) roots.push(name);
	}
	if (roots.length === 1) return { root: abs, entry: roots[0] as string };
	if (roots.length === 0) {
		throw new UsageError(`No LaTeX document found in "${target}". Pass the .tex file to build.`);
	}
	throw new UsageError(
		`Several documents in "${target}": ${roots.join(", ")}. Say which one to build.`
	);
}

/** Every file under the project, forward-slashed, skipping VCS and dependency folders. */
export async function* walk(root: string, dir = root): AsyncGenerator<string> {
	for (const item of await readdir(dir, { withFileTypes: true })) {
		if (item.isDirectory()) {
			if (!SKIP_DIRS.has(item.name)) yield* walk(root, join(dir, item.name));
		} else if (item.isFile()) {
			yield toPosix(relative(root, join(dir, item.name)));
		}
	}
}

export interface LoadedFile {
	path: string;
	data: Uint8Array;
}

/** Reads the project into memory with hard caps, so a stray huge folder fails fast and clearly. */
export async function readProject(root: string): Promise<LoadedFile[]> {
	const files: LoadedFile[] = [];
	let total = 0;
	for await (const path of walk(root)) {
		const abs = join(root, ...path.split("/"));
		const size = (await stat(abs)).size;
		if (size > MAX_FILE_BYTES) continue;
		total += size;
		if (total > MAX_TOTAL_BYTES) {
			throw new UsageError(
				"The project is over 200 MB. Build from the document's own folder, or remove large files."
			);
		}
		files.push({ path, data: await readFile(abs) });
	}
	return files;
}

/** Package names a project asks for, read from `\usepackage` and `\RequirePackage` lines. */
export function usedPackages(sources: readonly string[]): string[] {
	const found = new Set<string>();
	for (const text of sources) {
		const stripped = text.replace(/(^|[^\\])%.*$/gm, "$1");
		for (const m of stripped.matchAll(
			/\\(?:usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g
		)) {
			for (const name of (m[1] ?? "").split(",")) {
				const clean = name.trim();
				if (clean) found.add(clean);
			}
		}
	}
	return [...found].sort();
}
