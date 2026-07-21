/**
 * LaTeX language intelligence for Monaco: completion and hover.
 *
 * There is no LaTeX language server in the browser, so this is a deliberately
 * pragmatic stand-in for one — everything is derived from a static dataset plus
 * a scan of the open document. That covers what a writer actually notices
 * (commands, environments, cross-references, citations) without a LaTeX
 * installation or a backend.
 *
 * Suggestions are context-*ranked*, not context-filtered. A wrong guess about
 * whether the caret is inside math should demote a suggestion, never hide it:
 * a missing completion is far more annoying than a badly ordered one, and the
 * math heuristic below is a heuristic.
 */
import type * as Monaco from "monaco-editor";

import type { MonacoNamespace } from "./monaco";
import { LATEX_ID } from "./latex-monarch";
import { ensurePackages, loadedPackageData } from "./latex-packages";
import { workspaceBibEntries, workspaceLabels } from "./latex-workspace";
import { describeEntry } from "./bibtex";
import {
	LATEX_CLASSES,
	LATEX_COMMANDS,
	LATEX_ENVIRONMENTS,
	LATEX_PACKAGES,
	type LatexCommand,
	type LatexEnvironment,
} from "./latex-data";

/** Commands whose braces hold a label defined elsewhere in the document. */
const REF_COMMANDS =
	/\\(ref|eqref|autoref|pageref|nameref|cref|Cref|crefrange|labelcref|vref)\s*\{[^}]*$/;

/** Commands whose braces hold a citation key. */
const CITE_COMMANDS =
	/\\(cite|citep|citet|citeauthor|citeyear|parencite|textcite|autocite|footcite|nocite)\s*(\[[^\]]*\])*\s*\{[^}]*$/;

const BEGIN_END = /\\(begin|end)\s*\{[^}]*$/;
const USEPACKAGE = /\\(usepackage|RequirePackage)\s*(\[[^\]]*\])?\s*\{[^}]*$/;
const DOCUMENTCLASS = /\\documentclass\s*(\[[^\]]*\])?\s*\{[^}]*$/;
/** A partially typed command: the backslash and any letters after it. */
const PARTIAL_COMMAND = /\\([a-zA-Z@]*)$/;

/** Symbols harvested from the document itself. */
type DocumentSymbols = {
	labels: { name: string; line: number }[];
	citations: { key: string; line: number }[];
	commands: { name: string; line: number }[];
	environments: string[];
	/** Packages the document loads, used to pull in their completion data. */
	packages: string[];
};

/**
 * Cache keyed by model, invalidated on version id — the document is rescanned
 * once per edit rather than once per keystroke-in-a-completion, which matters
 * because completion providers run on every character typed.
 */
const symbolCache = new WeakMap<
	Monaco.editor.ITextModel,
	{ version: number; symbols: DocumentSymbols }
>();

function scanDocument(model: Monaco.editor.ITextModel): DocumentSymbols {
	const cached = symbolCache.get(model);
	const version = model.getVersionId();
	if (cached && cached.version === version) return cached.symbols;

	const text = model.getValue();
	const symbols: DocumentSymbols = {
		labels: [],
		citations: [],
		commands: [],
		environments: [],
		packages: [],
	};

	const collect = (re: RegExp, onMatch: (m: RegExpExecArray, line: number) => void) => {
		let m: RegExpExecArray | null;
		re.lastIndex = 0;
		while ((m = re.exec(text))) {
			onMatch(m, model.getPositionAt(m.index).lineNumber);
		}
	};

	collect(/\\label\s*\{([^}]+)\}/g, (m, line) => symbols.labels.push({ name: m[1], line }));
	// Both bibliography styles: a plain thebibliography list and .bib keys that
	// happen to be cited already (the latter is how you get useful completion
	// without parsing a .bib file we may not have).
	collect(/\\bibitem\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g, (m, line) =>
		symbols.citations.push({ key: m[1], line }),
	);
	collect(
		/\\(?:no)?cite[a-z]*\s*(?:\[[^\]]*\])*\s*\{([^}]+)\}/g,
		(m, line) => {
			for (const key of m[1].split(",")) {
				const trimmed = key.trim();
				if (trimmed) symbols.citations.push({ key: trimmed, line });
			}
		},
	);
	collect(
		/\\(?:newcommand|renewcommand|providecommand|DeclareMathOperator)\s*\*?\s*\{?\\([a-zA-Z@]+)\}?/g,
		(m, line) => symbols.commands.push({ name: m[1], line }),
	);
	collect(/\\newenvironment\s*\{([^}]+)\}/g, (m) => symbols.environments.push(m[1]));
	collect(
		/\\(?:usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g,
		(m) => {
			for (const name of m[1].split(",")) {
				const trimmed = name.trim();
				if (trimmed) symbols.packages.push(trimmed);
			}
		},
	);

	// Cited keys repeat constantly; keep the first sighting of each.
	symbols.citations = dedupeBy(symbols.citations, (c) => c.key);
	symbols.labels = dedupeBy(symbols.labels, (l) => l.name);
	symbols.commands = dedupeBy(symbols.commands, (c) => c.name);

	symbolCache.set(model, { version, symbols });
	return symbols;
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

/**
 * Whether the caret is most likely inside math.
 *
 * Counts unescaped `$` and tracks the display-math delimiters and environments
 * before the caret. It cannot be exact without a full parse — `\text{}` inside
 * math and verbatim blocks both fool it — which is why the result only
 * influences ranking.
 */
function inMathContext(textBefore: string): boolean {
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

	const mathEnv = /\\(begin|end)\s*\{(equation|align|gather|multline|displaymath|eqnarray|flalign|alignat)\*?\}/g;
	let depth = 0;
	let m: RegExpExecArray | null;
	while ((m = mathEnv.exec(textBefore))) depth += m[1] === "begin" ? 1 : -1;
	return depth > 0;
}

/** Sort key: matching context first, then alphabetical within each band. */
function rank(item: { context?: string; name: string }, math: boolean): string {
	const ctx = item.context ?? "both";
	const matches = ctx === "both" || (math ? ctx === "math" : ctx === "text");
	return `${matches ? "0" : "1"}${item.name}`;
}

export function registerLatexCompletions(monaco: MonacoNamespace): Monaco.IDisposable[] {
	const Kind = monaco.languages.CompletionItemKind;
	const Snippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

	const completion = monaco.languages.registerCompletionItemProvider(LATEX_ID, {
		// `\` opens command completion, `{` opens argument completion, and `,`
		// re-opens it inside a multi-key \cite or multi-package \usepackage.
		triggerCharacters: ["\\", "{", ",", "["],

		provideCompletionItems(model, position) {
			// Pull in data for whatever the document loads. Deliberately not
			// awaited: the current keystroke answers from what is already loaded,
			// and the next one — milliseconds later — sees the rest. Blocking here
			// would stall the widget on a network chunk.
			void ensurePackages(scanDocument(model).packages);

			const lineBefore = model.getValueInRange({
				startLineNumber: position.lineNumber,
				startColumn: 1,
				endLineNumber: position.lineNumber,
				endColumn: position.column,
			});

			// The word inside the current braces, so typing narrows the list.
			const braceWord = /([^{,\s]*)$/.exec(lineBefore)?.[1] ?? "";
			const braceRange: Monaco.IRange = {
				startLineNumber: position.lineNumber,
				startColumn: position.column - braceWord.length,
				endLineNumber: position.lineNumber,
				endColumn: position.column,
			};

			if (BEGIN_END.test(lineBefore)) {
				return { suggestions: environmentItems(model, lineBefore, braceRange) };
			}
			if (REF_COMMANDS.test(lineBefore)) {
				return { suggestions: labelItems(model, braceRange) };
			}
			if (CITE_COMMANDS.test(lineBefore)) {
				return { suggestions: citationItems(model, braceRange) };
			}
			if (USEPACKAGE.test(lineBefore)) {
				return { suggestions: simpleItems(LATEX_PACKAGES, Kind.Module, braceRange) };
			}
			if (DOCUMENTCLASS.test(lineBefore)) {
				return { suggestions: simpleItems(LATEX_CLASSES, Kind.Class, braceRange) };
			}

			const partial = PARTIAL_COMMAND.exec(lineBefore);
			if (partial) {
				return { suggestions: commandItems(model, lineBefore, partial, position) };
			}

			return { suggestions: [] };
		},
	});

	function environmentItems(
		model: Monaco.editor.ITextModel,
		lineBefore: string,
		range: Monaco.IRange,
	): Monaco.languages.CompletionItem[] {
		const closing = BEGIN_END.exec(lineBefore)?.[1];
		const math = inMathContext(model.getValue().slice(0, model.getOffsetAt({
			lineNumber: range.startLineNumber,
			column: range.startColumn,
		})));

		// `\end{` only ever needs the name; `\begin{` gets the whole block, which
		// is the behaviour that makes environments pleasant to type.
		const userDefined: LatexEnvironment[] = scanDocument(model).environments.map((name) => ({
			name,
			detail: "Defined in this document",
		}));

		return [
			...LATEX_ENVIRONMENTS,
			...loadedPackageData().environments,
			...userDefined,
		].map((env) => {
			const body = env.body ?? "\n\t$0\n";
			return {
				label: env.name,
				kind: Kind.Struct,
				detail: env.detail,
				insertText:
					closing === "end"
						? env.name
						: `${env.name}}${body}\\end{${env.name}}`,
				insertTextRules: closing === "end" ? undefined : Snippet,
				range,
				sortText: rank(env, math),
			};
		});
	}

	function labelItems(
		model: Monaco.editor.ITextModel,
		range: Monaco.IRange,
	): Monaco.languages.CompletionItem[] {
		// The open file first — its labels are live, including ones typed but not
		// yet saved, so they must win over the indexed copy of the same file.
		const items = new Map<string, Monaco.languages.CompletionItem>();

		for (const label of scanDocument(model).labels) {
			items.set(label.name, {
				label: label.name,
				kind: Kind.Reference,
				detail: `\\label on line ${label.line}`,
				insertText: label.name,
				range,
				sortText: `0${label.name}`,
			});
		}

		for (const label of workspaceLabels()) {
			if (items.has(label.name)) continue;
			items.set(label.name, {
				label: label.name,
				kind: Kind.Reference,
				detail: `${label.file}:${label.line}`,
				insertText: label.name,
				range,
				// Labels from other files rank below the ones in view.
				sortText: `1${label.name}`,
			});
		}

		return [...items.values()];
	}

	function citationItems(
		model: Monaco.editor.ITextModel,
		range: Monaco.IRange,
	): Monaco.languages.CompletionItem[] {
		const items = new Map<string, Monaco.languages.CompletionItem>();

		// Real bibliography entries first: they carry a title and author, which is
		// what makes picking the right key possible without leaving the editor.
		for (const entry of workspaceBibEntries()) {
			items.set(entry.key, {
				label: entry.key,
				kind: Kind.Value,
				detail: describeEntry(entry),
				documentation: entry.source ? { value: `From \`${entry.source}\`` } : undefined,
				insertText: entry.key,
				range,
				sortText: `0${entry.key}`,
			});
		}

		// Then keys seen in the document that no .bib accounts for — usually a
		// \bibitem list, sometimes a typo, either way worth offering.
		for (const citation of scanDocument(model).citations) {
			if (items.has(citation.key)) continue;
			items.set(citation.key, {
				label: citation.key,
				kind: Kind.Value,
				detail: `Cited on line ${citation.line}`,
				insertText: citation.key,
				range,
				sortText: `1${citation.key}`,
			});
		}

		return [...items.values()];
	}

	function simpleItems(
		entries: readonly { name: string; detail: string }[],
		kind: Monaco.languages.CompletionItemKind,
		range: Monaco.IRange,
	): Monaco.languages.CompletionItem[] {
		return entries.map((entry) => ({
			label: entry.name,
			kind,
			detail: entry.detail,
			insertText: entry.name,
			range,
		}));
	}

	function commandItems(
		model: Monaco.editor.ITextModel,
		lineBefore: string,
		partial: RegExpExecArray,
		position: Monaco.IPosition,
	): Monaco.languages.CompletionItem[] {
		// Replace from the backslash, so accepting `frac` after typing `\fr`
		// yields `\frac{}{}` rather than `\fr\frac{}{}`.
		const range: Monaco.IRange = {
			startLineNumber: position.lineNumber,
			startColumn: position.column - partial[0].length,
			endLineNumber: position.lineNumber,
			endColumn: position.column,
		};
		const math = inMathContext(lineBefore);

		const userDefined: LatexCommand[] = scanDocument(model).commands.map((command) => ({
			name: command.name,
			detail: `Defined on line ${command.line}`,
		}));

		return [
			...LATEX_COMMANDS,
			...loadedPackageData().commands,
			...userDefined,
		].map((command) => ({
			label: `\\${command.name}`,
			kind: command.snippet ? Kind.Function : Kind.Constant,
			detail: command.detail,
			documentation: command.doc
				? { value: command.doc }
				: command.package
					? { value: `Provided by \`${command.package}\`` }
					: undefined,
			insertText: `\\${command.snippet ?? command.name}`,
			insertTextRules: command.snippet ? Snippet : undefined,
			range,
			sortText: rank(command, math),
			// Monaco filters against the label, which includes the backslash the
			// user has already typed — so the filter text has to include it too.
			filterText: `\\${command.name}`,
		}));
	}

	const hover = monaco.languages.registerHoverProvider(LATEX_ID, {
		provideHover(model, position) {
			const line = model.getLineContent(position.lineNumber);
			// Find a command spanning the hovered column.
			const re = /\\([a-zA-Z@]+)/g;
			let m: RegExpExecArray | null;
			while ((m = re.exec(line))) {
				const start = m.index + 1;
				const end = start + m[0].length;
				if (position.column < start || position.column > end) continue;

				const command = LATEX_COMMANDS.find((c) => c.name === m![1]);
				if (!command) return null;

				const contents: Monaco.IMarkdownString[] = [
					{ value: `\`\\${command.name}\` — ${command.detail}` },
				];
				if (command.doc) contents.push({ value: command.doc });
				if (command.package) contents.push({ value: `Provided by \`${command.package}\`` });

				return {
					contents,
					range: {
						startLineNumber: position.lineNumber,
						startColumn: start,
						endLineNumber: position.lineNumber,
						endColumn: end,
					},
				};
			}
			return null;
		},
	});

	return [completion, hover];
}
