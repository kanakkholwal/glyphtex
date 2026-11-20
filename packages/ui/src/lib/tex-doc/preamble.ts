/**
 * The preamble as editable settings: which packages the document loads and whether each is on.
 * Regex over lines, no parser, so the Document setup panel stays light and never bundles
 * unified-latex. Turning a package off comments its line out, so nothing is lost.
 */

export type PackageEntry = {
	/** `amsmath`, or `a, b` when one line loads several. */
	name: string;
	options: string | null;
	enabled: boolean;
	/** The whole line, without its newline. */
	from: number;
	to: number;
};

export type DocumentClass = { name: string; options: string | null };

const LINE =
	/^([ \t]*)(%[ \t]*)?\\(usepackage|RequirePackage)[ \t]*(?:\[([^\]]*)\])?[ \t]*\{([^}]+)\}.*$/gm;
const CLASS = /\\documentclass[ \t]*(?:\[([^\]]*)\])?[ \t]*\{([^}]+)\}/;

function preambleOf(source: string): string {
	const end = source.search(/\\begin\s*\{document\}/);
	return end < 0 ? "" : source.slice(0, end);
}

export function readDocumentClass(source: string): DocumentClass | null {
	const m = CLASS.exec(preambleOf(source));
	return m ? { name: m[2].trim(), options: m[1]?.trim() || null } : null;
}

export function readPackages(source: string): PackageEntry[] {
	const head = preambleOf(source);
	const out: PackageEntry[] = [];
	for (const m of head.matchAll(LINE)) {
		const index = m.index ?? 0;
		out.push({
			name: m[5]
				.split(",")
				.map((n) => n.trim())
				.filter(Boolean)
				.join(", "),
			options: m[4]?.trim() || null,
			enabled: !m[2],
			from: index,
			to: index + m[0].length
		});
	}
	return out;
}

function splice(source: string, from: number, to: number, insert: string): string {
	return source.slice(0, from) + insert + source.slice(to);
}

/** Comment the line out, or put it back. A no-op when it is already in that state. */
export function setPackageEnabled(source: string, entry: PackageEntry, enabled: boolean): string {
	if (entry.enabled === enabled) return source;
	const line = source.slice(entry.from, entry.to);
	const next = enabled ? line.replace(/^([ \t]*)%[ \t]*/, "$1") : line.replace(/^([ \t]*)/, "$1% ");
	return splice(source, entry.from, entry.to, next);
}

/** Delete the line, and the newline after it so no blank line is left behind. */
export function removePackage(source: string, entry: PackageEntry): string {
	const to =
		source[entry.to] === "\r" && source[entry.to + 1] === "\n" ? entry.to + 2 : entry.to + 1;
	return splice(source, entry.from, Math.min(to, source.length), "");
}

/** Add a `\usepackage` after the last one, or after `\documentclass`. */
export function addPackage(source: string, name: string): string {
	const existing = readPackages(source).find((p) => p.name.split(", ").includes(name));
	if (existing) return setPackageEnabled(source, existing, true);
	const head = preambleOf(source);
	const last = readPackages(source).at(-1);
	const cls = CLASS.exec(head);
	const at = last ? last.to : cls ? (cls.index ?? 0) + cls[0].length : -1;
	if (at < 0) return source;
	return splice(source, at, at, `\n\\usepackage{${name}}`);
}
