/**
 * Semantic token overlay for LaTeX.
 *
 * Monaco lets exactly one tokenizer own a language — Monarch *or* TextMate,
 * never both — but semantic tokens layer on top of either. That makes this the
 * only place to express things a grammar structurally cannot, because they
 * depend on the rest of the document rather than on the characters at hand:
 *
 *   - a command the document never defines and no loaded package provides,
 *     which is usually a typo (`\reff`, `\bagin`)
 *   - a macro the author defined themselves, worth distinguishing from kernel
 *     commands
 *   - a `\ref`/`\cite` whose target does not exist anywhere in the project
 *
 * A grammar sees `\foo` and can only say "control sequence". This pass knows
 * whether `\foo` means anything.
 */
import type * as Monaco from "monaco-editor";

import type { MonacoNamespace } from "./monaco";
import { LATEX_ID } from "./latex-monarch";
import { LATEX_COMMANDS } from "./latex-data";
import { loadedPackageData } from "./latex-packages";
import { workspaceBibEntries, workspaceLabels } from "./latex-workspace";

/**
 * Token types we emit, in the order Monaco will refer to them by index.
 *
 * `unknown` maps to a theme colour meaning "this is probably wrong"; the others
 * are informational. Keep this in sync with the legend below — the protocol is
 * positional, so a reordering silently recolours everything.
 */
const TOKEN_TYPES = ["macro", "unknownMacro", "danglingRef", "resolvedRef"] as const;

const enum TokenType {
	Macro = 0,
	UnknownMacro = 1,
	DanglingRef = 2,
	ResolvedRef = 3,
}

/** Commands that are always fine regardless of the dataset: TeX primitives and
 *  anything the grammar already treats as structural. */
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
	"right",
]);

const REF_CALL = /\\(ref|eqref|autoref|pageref|nameref|cref|Cref|vref|labelcref)\s*\{([^}]*)\}/g;
const CITE_CALL = /\\(?:no)?cite[a-zA-Z]*\s*(?:\[[^\]]*\])*\s*\{([^}]*)\}/g;
const COMMAND = /\\([a-zA-Z@]+)/g;
const DEFINITION =
	/\\(?:newcommand|renewcommand|providecommand|DeclareMathOperator)\s*\*?\s*\{?\\([a-zA-Z@]+)\}?/g;

/** Strip `%` comments so a commented-out `\reff` is not flagged. */
function withoutComments(text: string): string {
	return text.replace(/(^|[^\\])%.*$/gm, (_m, prefix: string) => prefix);
}

export function registerLatexSemanticTokens(monaco: MonacoNamespace): Monaco.IDisposable {
	return monaco.languages.registerDocumentSemanticTokensProvider(LATEX_ID, {
		getLegend: () => ({ tokenTypes: [...TOKEN_TYPES], tokenModifiers: [] }),

		provideDocumentSemanticTokens(model) {
			const raw = model.getValue();
			const text = withoutComments(raw);

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
			LABEL.lastIndex = 0;
			while ((m = LABEL.exec(text))) labels.add(m[1]);
			for (const label of workspaceLabels()) labels.add(label.name);

			const citations = new Set<string>();
			for (const entry of workspaceBibEntries()) citations.add(entry.key);
			const BIBITEM = /\\bibitem\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
			BIBITEM.lastIndex = 0;
			while ((m = BIBITEM.exec(text))) citations.add(m[1]);

			// Collected absolute, then sorted and delta-encoded — Monaco's format is
			// relative to the previous token, so order is not optional.
			const found: { offset: number; length: number; type: TokenType }[] = [];

			COMMAND.lastIndex = 0;
			while ((m = COMMAND.exec(text))) {
				const name = m[1];
				if (userDefined.has(name)) {
					found.push({ offset: m.index, length: m[0].length, type: TokenType.Macro });
				} else if (!known.has(name)) {
					found.push({ offset: m.index, length: m[0].length, type: TokenType.UnknownMacro });
				}
			}

			// Only flag a target as dangling when we have something to check
			// against. With no labels indexed at all — a fresh single file — every
			// \ref would light up red, which is noise, not information.
			if (labels.size > 0) {
				REF_CALL.lastIndex = 0;
				while ((m = REF_CALL.exec(text))) {
					const inner = m[2];
					if (!inner.trim()) continue;
					const start = m.index + m[0].length - inner.length - 1;
					found.push({
						offset: start,
						length: inner.length,
						type: labels.has(inner.trim()) ? TokenType.ResolvedRef : TokenType.DanglingRef,
					});
				}
			}

			if (citations.size > 0) {
				CITE_CALL.lastIndex = 0;
				while ((m = CITE_CALL.exec(text))) {
					const inner = m[1];
					if (!inner.trim()) continue;
					const listStart = m.index + m[0].length - inner.length - 1;
					// A \cite can hold several comma-separated keys; each is judged
					// on its own, at its own offset within the braces.
					let cursor = 0;
					for (const part of inner.split(",")) {
						const trimmed = part.trim();
						if (trimmed) {
							found.push({
								offset: listStart + cursor + part.indexOf(trimmed),
								length: trimmed.length,
								type: citations.has(trimmed) ? TokenType.ResolvedRef : TokenType.DanglingRef,
							});
						}
						cursor += part.length + 1; // + the comma
					}
				}
			}

			found.sort((a, b) => a.offset - b.offset);

			const data: number[] = [];
			let lastLine = 0;
			let lastColumn = 0;
			for (const token of found) {
				const position = model.getPositionAt(token.offset);
				const line = position.lineNumber - 1;
				const column = position.column - 1;

				data.push(
					line - lastLine,
					line === lastLine ? column - lastColumn : column,
					token.length,
					token.type,
					0,
				);
				lastLine = line;
				lastColumn = column;
			}

			return { data: new Uint32Array(data) };
		},

		// Monaco calls this when it discards our result; there is no incremental
		// state to clean up because every pass recomputes from the whole document.
		releaseDocumentSemanticTokens() {},
	});
}
