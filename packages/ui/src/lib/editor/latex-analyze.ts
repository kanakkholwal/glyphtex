import { LATEX_COMMANDS } from "./latex-data";
import { loadedPackageData } from "./latex-packages";
import { workspaceBibEntries, workspaceLabels } from "./latex-workspace";

/**
 * Editor-agnostic LaTeX analysis: everything the completion, hover, semantic and
 * folding layers need, computed from a plain string so it stays directly testable.
 */

export type DocumentSymbols = {
	labels: { name: string; line: number }[];
	citations: { key: string; line: number }[];
	commands: { name: string; line: number }[];
	environments: string[];
	packages: string[];
};

/** Blanks `%` comments, padded to the original length so offsets still line up. */
export function withoutComments(text: string): string {
	return text.replace(
		/(^|[^\\])(%.*)$/gm,
		(_m, prefix: string, comment: string) => prefix + " ".repeat(comment.length)
	);
}

/** 1-based line numbers for a sorted-ascending list of offsets, in one pass. */
function lineIndex(text: string): (offset: number) => number {
	const starts: number[] = [0];
	for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
	return (offset) => {
		let lo = 0;
		let hi = starts.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (starts[mid] <= offset) lo = mid;
			else hi = mid - 1;
		}
		return lo + 1;
	};
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const k = key(item);
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
}

const cache = new Map<string, DocumentSymbols>();

/** Labels, citations, macros, environments and packages declared in `text`. */
export function scanDocument(text: string): DocumentSymbols {
	const hit = cache.get(text);
	if (hit) return hit;

	const lineOf = lineIndex(text);
	const symbols: DocumentSymbols = {
		labels: [],
		citations: [],
		commands: [],
		environments: [],
		packages: []
	};

	const collect = (re: RegExp, onMatch: (m: RegExpExecArray, line: number) => void) => {
		re.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text))) onMatch(m, lineOf(m.index));
	};

	collect(/\\label\s*\{([^}]+)\}/g, (m, line) => symbols.labels.push({ name: m[1], line }));
	// Both bibliography styles: thebibliography items, plus already-cited keys.
	// Useful completion without parsing a .bib we may not have.
	collect(/\\bibitem\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g, (m, line) =>
		symbols.citations.push({ key: m[1], line })
	);
	collect(/\\(?:no)?cite[a-z]*\s*(?:\[[^\]]*\])*\s*\{([^}]+)\}/g, (m, line) => {
		for (const key of m[1].split(",")) {
			const trimmed = key.trim();
			if (trimmed) symbols.citations.push({ key: trimmed, line });
		}
	});
	collect(
		/\\(?:newcommand|renewcommand|providecommand|DeclareMathOperator)\s*\*?\s*\{?\\([a-zA-Z@]+)\}?/g,
		(m, line) => symbols.commands.push({ name: m[1], line })
	);
	collect(/\\newenvironment\s*\{([^}]+)\}/g, (m) => symbols.environments.push(m[1]));
	collect(/\\(?:usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g, (m) => {
		for (const name of m[1].split(",")) {
			const trimmed = name.trim();
			if (trimmed) symbols.packages.push(trimmed);
		}
	});

	// Cited keys repeat constantly; keep the first sighting of each.
	symbols.citations = dedupeBy(symbols.citations, (c) => c.key);
	symbols.labels = dedupeBy(symbols.labels, (l) => l.name);
	symbols.commands = dedupeBy(symbols.commands, (c) => c.name);

	// One entry is enough: consecutive calls pass the same document, and holding
	// every revision of a long paper would be a slow leak.
	cache.clear();
	cache.set(text, symbols);
	return symbols;
}

// Heuristic, not exact: `\text{}` inside math and verbatim blocks both fool it,
// which is why the result only influences ranking and never filters.
export function inMathContext(textBefore: string): boolean {
	let dollars = 0;
	for (let i = 0; i < textBefore.length; i++) {
		if (textBefore[i] !== "$") continue;
		// A `$` is a delimiter unless it is escaped by an odd run of backslashes.
		let backslashes = 0;
		for (let j = i - 1; j >= 0 && textBefore[j] === "\\"; j--) backslashes++;
		if (backslashes % 2 === 0) dollars++;
	}
	if (dollars % 2 === 1) return true;

	const lastOpen = Math.max(textBefore.lastIndexOf("\\["), textBefore.lastIndexOf("\\("));
	const lastClose = Math.max(textBefore.lastIndexOf("\\]"), textBefore.lastIndexOf("\\)"));
	if (lastOpen > lastClose) return true;

	const mathEnv =
		/\\(begin|end)\s*\{(equation|align|gather|multline|displaymath|eqnarray|flalign|alignat)\*?\}/g;
	let depth = 0;
	let m: RegExpExecArray | null;
	while ((m = mathEnv.exec(textBefore))) depth += m[1] === "begin" ? 1 : -1;
	return depth > 0;
}

// --- Semantic analysis -------------------------------------------------------

export type SemanticKind = "macro" | "unknownMacro" | "danglingRef" | "resolvedRef";
export type SemanticToken = { offset: number; length: number; kind: SemanticKind };

// Never flagged regardless of the dataset: TeX primitives and anything the
// grammar already treats as structural.
const ALWAYS_KNOWN = new Set([
	"begin",
	"end",
	"documentclass",
	"usepackage",
	"RequirePackage",
	"newcommand",
	"renewcommand",
	"providecommand",
	"newenvironment",
	"renewenvironment",
	"DeclareMathOperator",
	"newtheorem",
	"def",
	"let",
	"input",
	"include",
	"item",
	"label",
	"left",
	"right"
]);

const REF_CALL = /\\(ref|eqref|autoref|pageref|nameref|cref|Cref|vref|labelcref)\s*\{([^}]*)\}/g;
const CITE_CALL = /\\(?:no)?cite[a-zA-Z]*\s*(?:\[[^\]]*\])*\s*\{([^}]*)\}/g;
const COMMAND = /\\([a-zA-Z@]+)/g;
const DEFINITION =
	/\\(?:newcommand|renewcommand|providecommand|DeclareMathOperator)\s*\*?\s*\{?\\([a-zA-Z@]+)\}?/g;

/** User macros, unknown macros and resolved/dangling refs, sorted by offset. */
export function analyzeSemantics(source: string): SemanticToken[] {
	const text = withoutComments(source);

	// Everything this document can legitimately name.
	const known = new Set<string>(ALWAYS_KNOWN);
	for (const command of LATEX_COMMANDS) known.add(command.name);
	for (const command of loadedPackageData().commands) known.add(command.name);

	const userDefined = new Set<string>();
	let m: RegExpExecArray | null;
	DEFINITION.lastIndex = 0;
	while ((m = DEFINITION.exec(text))) {
		userDefined.add(m[1]);
		known.add(m[1]);
	}

	// Everything referenceable, from this file and the rest of the project.
	const labels = new Set<string>();
	const LABEL = /\\label\s*\{([^}]+)\}/g;
	while ((m = LABEL.exec(text))) labels.add(m[1]);
	for (const label of workspaceLabels()) labels.add(label.name);

	const citations = new Set<string>();
	for (const entry of workspaceBibEntries()) citations.add(entry.key);
	const BIBITEM = /\\bibitem\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
	while ((m = BIBITEM.exec(text))) citations.add(m[1]);

	const found: SemanticToken[] = [];

	COMMAND.lastIndex = 0;
	while ((m = COMMAND.exec(text))) {
		const name = m[1];
		if (userDefined.has(name)) {
			found.push({ offset: m.index, length: m[0].length, kind: "macro" });
		} else if (!known.has(name)) {
			found.push({ offset: m.index, length: m[0].length, kind: "unknownMacro" });
		}
	}

	// Only flag dangling when something is indexed: with no labels at all
	// (a fresh single file) every \ref would light up red.
	if (labels.size > 0) {
		REF_CALL.lastIndex = 0;
		while ((m = REF_CALL.exec(text))) {
			const inner = m[2];
			if (!inner.trim()) continue;
			found.push({
				offset: m.index + m[0].length - inner.length - 1,
				length: inner.length,
				kind: labels.has(inner.trim()) ? "resolvedRef" : "danglingRef"
			});
		}
	}

	if (citations.size > 0) {
		CITE_CALL.lastIndex = 0;
		while ((m = CITE_CALL.exec(text))) {
			const inner = m[1];
			if (!inner.trim()) continue;
			const listStart = m.index + m[0].length - inner.length - 1;
			// A \cite can hold several comma-separated keys; each is judged on its
			// own, at its own offset within the braces.
			let cursor = 0;
			for (const part of inner.split(",")) {
				const trimmed = part.trim();
				if (trimmed) {
					found.push({
						offset: listStart + cursor + part.indexOf(trimmed),
						length: trimmed.length,
						kind: citations.has(trimmed) ? "resolvedRef" : "danglingRef"
					});
				}
				cursor += part.length + 1; // + the comma
			}
		}
	}

	// Decorations must be added in document order or CM6 throws on the RangeSet.
	found.sort((a, b) => a.offset - b.offset);
	return found;
}
