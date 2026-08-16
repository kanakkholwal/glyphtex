import {
	snippet,
	type Completion,
	type CompletionContext,
	type CompletionResult
} from "@codemirror/autocomplete";

import { describeEntry } from "./bibtex";
import { inMathContext, scanDocument } from "./latex-analyze";
import {
	LATEX_CLASSES,
	LATEX_COMMANDS,
	LATEX_ENVIRONMENTS,
	LATEX_PACKAGES,
	type LatexCommand,
	type LatexEnvironment
} from "./latex-data";
import { ensurePackages, loadedPackageData } from "./latex-packages";
import { workspaceBibEntries, workspaceLabels } from "./latex-workspace";

const REF_COMMANDS =
	/\\(ref|eqref|autoref|pageref|nameref|cref|Cref|crefrange|labelcref|vref)\s*\{[^}]*$/;

const CITE_COMMANDS =
	/\\(cite|citep|citet|citeauthor|citeyear|parencite|textcite|autocite|footcite|nocite)\s*(\[[^\]]*\])*\s*\{[^}]*$/;

const BEGIN_END = /\\(begin|end)\s*\{[^}]*$/;
const USEPACKAGE = /\\(usepackage|RequirePackage)\s*(\[[^\]]*\])?\s*\{[^}]*$/;
const DOCUMENTCLASS = /\\documentclass\s*(\[[^\]]*\])?\s*\{[^}]*$/;
const PARTIAL_COMMAND = /\\([a-zA-Z@]*)$/;

/** One suggestion, in plain data so the ranking logic stays editor-agnostic. */
export type LatexCompletion = {
	label: string;
	detail?: string;
	info?: string;
	/** Text (or snippet template) inserted in place of the replaced range. */
	insert: string;
	isSnippet?: boolean;
	/** Higher sorts earlier. Context-matched entries get 1, mismatches -1. */
	boost?: number;
	type?: string;
};

export type LatexCompletions = { from: number; options: LatexCompletion[] };

// Sources are passed general-to-specific and later entries win, because packages
// legitimately redefine core names (beamer's `frame` is not the core `frame`).
function mergeByName<T extends { name: string }>(...sources: readonly T[][]): T[] {
	const merged = new Map<string, T>();
	for (const source of sources) {
		for (const item of source) merged.set(item.name, item);
	}
	return [...merged.values()];
}

function boostFor(item: { context?: string }, math: boolean): number {
	const ctx = item.context ?? "both";
	return ctx === "both" || (math ? ctx === "math" : ctx === "text") ? 1 : -1;
}

/**
 * TextMate `$1` / `$0` to CodeMirror `${1}`. CM6 has no notion of `$0` as "final
 * cursor", so it becomes the last numbered field instead of jumping to the front.
 */
export function toSnippetTemplate(template: string): string {
	let max = 0;
	const fields = /\$\{(\d+)[:}]|\$(\d+)/g;
	let m: RegExpExecArray | null;
	while ((m = fields.exec(template))) {
		const n = Number(m[1] ?? m[2]);
		if (n > max) max = n;
	}
	const last = max + 1;
	return template.replace(/\$(\d+)/g, (_s, digits: string) => {
		const n = Number(digits);
		return `\${${n === 0 ? last : n}}`;
	});
}

function environmentItems(text: string, lineBefore: string, from: number): LatexCompletion[] {
	const closing = BEGIN_END.exec(lineBefore)?.[1];
	const math = inMathContext(text.slice(0, from));

	const userDefined: LatexEnvironment[] = scanDocument(text).environments.map((name) => ({
		name,
		detail: "Defined in this document"
	}));

	return mergeByName<LatexEnvironment>(
		[...LATEX_ENVIRONMENTS],
		[...loadedPackageData().environments],
		userDefined
	).map((env) => {
		const body = env.body ?? "\n\t$0\n";
		// `\end{` only ever needs the name; `\begin{` gets the whole block, which is
		// what makes environments pleasant to type.
		const whole = closing !== "end";
		return {
			label: env.name,
			detail: env.detail,
			insert: whole ? `${env.name}}${body}\\end{${env.name}}` : env.name,
			isSnippet: whole,
			boost: boostFor(env, math),
			type: "class"
		};
	});
}

function labelItems(text: string): LatexCompletion[] {
	// The open file first: its labels are live, including ones typed but not yet
	// saved, so they must win over the indexed copy of the same file.
	const items = new Map<string, LatexCompletion>();

	for (const label of scanDocument(text).labels) {
		items.set(label.name, {
			label: label.name,
			detail: `\\label on line ${label.line}`,
			insert: label.name,
			boost: 1,
			type: "variable"
		});
	}

	for (const label of workspaceLabels()) {
		if (items.has(label.name)) continue;
		items.set(label.name, {
			label: label.name,
			detail: `${label.file}:${label.line}`,
			insert: label.name,
			// Labels from other files rank below the ones in view.
			boost: 0,
			type: "variable"
		});
	}

	return [...items.values()];
}

function citationItems(text: string): LatexCompletion[] {
	const items = new Map<string, LatexCompletion>();

	// Real bibliography entries first: they carry a title and author, which is what
	// makes picking the right key possible without leaving the editor.
	for (const entry of workspaceBibEntries()) {
		items.set(entry.key, {
			label: entry.key,
			detail: describeEntry(entry),
			info: entry.source ? `From ${entry.source}` : undefined,
			insert: entry.key,
			boost: 1,
			type: "constant"
		});
	}

	// Then keys seen in the document that no .bib accounts for: usually a \bibitem
	// list, sometimes a typo, either way worth offering.
	for (const citation of scanDocument(text).citations) {
		if (items.has(citation.key)) continue;
		items.set(citation.key, {
			label: citation.key,
			detail: `Cited on line ${citation.line}`,
			insert: citation.key,
			boost: 0,
			type: "constant"
		});
	}

	return [...items.values()];
}

function simpleItems(
	entries: readonly { name: string; detail: string }[],
	type: string
): LatexCompletion[] {
	return entries.map((entry) => ({
		label: entry.name,
		detail: entry.detail,
		insert: entry.name,
		type
	}));
}

function commandItems(text: string, lineBefore: string): LatexCompletion[] {
	const math = inMathContext(lineBefore);

	const userDefined: LatexCommand[] = scanDocument(text).commands.map((command) => ({
		name: command.name,
		detail: `Defined on line ${command.line}`
	}));

	return mergeByName<LatexCommand>(
		[...LATEX_COMMANDS],
		[...loadedPackageData().commands],
		userDefined
	).map((command) => ({
		// The label carries the backslash the user has already typed, so CM6's
		// filter matches against the same text the replaced range covers.
		label: `\\${command.name}`,
		detail: command.detail,
		info: command.doc ?? (command.package ? `Provided by ${command.package}` : undefined),
		insert: `\\${command.snippet ?? command.name}`,
		isSnippet: Boolean(command.snippet),
		boost: boostFor(command, math),
		type: command.snippet ? "function" : "keyword"
	}));
}

/**
 * Suggestions for `text` at `pos`, or null in plain prose. Pure: the CodeMirror
 * source below is a thin wrapper, so this is what the tests drive.
 */
export function latexCompletions(text: string, pos: number): LatexCompletions | null {
	// Deliberately not awaited: awaiting would stall the widget on a network
	// chunk; the next keystroke sees the newly loaded data.
	void ensurePackages(scanDocument(text).packages);

	const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
	const lineBefore = text.slice(lineStart, pos);

	// The word inside the current braces, so typing narrows the list.
	const braceWord = /([^{,\s]*)$/.exec(lineBefore)?.[1] ?? "";
	const braceFrom = pos - braceWord.length;

	if (BEGIN_END.test(lineBefore)) {
		return { from: braceFrom, options: environmentItems(text, lineBefore, braceFrom) };
	}
	if (REF_COMMANDS.test(lineBefore)) {
		return { from: braceFrom, options: labelItems(text) };
	}
	if (CITE_COMMANDS.test(lineBefore)) {
		return { from: braceFrom, options: citationItems(text) };
	}
	if (USEPACKAGE.test(lineBefore)) {
		return { from: braceFrom, options: simpleItems(LATEX_PACKAGES, "namespace") };
	}
	if (DOCUMENTCLASS.test(lineBefore)) {
		return { from: braceFrom, options: simpleItems(LATEX_CLASSES, "namespace") };
	}

	const partial = PARTIAL_COMMAND.exec(lineBefore);
	if (partial) {
		// Replace from the backslash, so accepting `frac` after typing `\fr` yields
		// `\frac{}{}` rather than `\fr\frac{}{}`.
		return { from: pos - partial[0].length, options: commandItems(text, lineBefore) };
	}

	return null;
}

function toCompletion(item: LatexCompletion): Completion {
	return {
		label: item.label,
		detail: item.detail,
		info: item.info,
		type: item.type,
		boost: item.boost,
		apply: item.isSnippet ? snippet(toSnippetTemplate(item.insert)) : item.insert
	};
}

/** Registered through the language's `autocomplete` data facet. */
export function latexCompletionSource(context: CompletionContext): CompletionResult | null {
	const text = context.state.doc.toString();
	const result = latexCompletions(text, context.pos);
	if (!result || result.options.length === 0) return null;
	return {
		from: result.from,
		options: result.options.map(toCompletion),
		// Keeps the popup alive while the user narrows, instead of re-querying the
		// whole command table on every keystroke.
		validFor: /^[\\a-zA-Z@:_-]*$/
	};
}
