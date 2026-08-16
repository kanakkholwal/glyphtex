import { parseMinimal } from "@unified-latex/unified-latex-util-parse";

import { printBlock } from "./print";
import {
	SECTION_COMMANDS,
	type Block,
	type Inline,
	type MarkKind,
	type Span,
	type TexDoc
} from "./types";

/**
 * LaTeX source → editable blocks.
 *
 * `parseMinimal`, not `parse`: the full parser's argument-attachment pass
 * synthesises `argument` nodes with no position, which makes spans unanchorable.
 * Minimal keeps every node positioned, and we associate arguments ourselves.
 */

// unified-latex's node shape, narrowed to what this module reads. Its own types
// model the post-argument-attachment AST, which is not what parseMinimal returns.
type Node = {
	type: string;
	content?: Node[] | string;
	env?: unknown;
	/** On a comment: whether it followed text rather than opening its own line. */
	sameline?: boolean;
	position?: { start?: { offset?: number }; end?: { offset?: number } };
};

const SECTION_LEVEL: Record<string, number> = Object.fromEntries(
	SECTION_COMMANDS.map((name, level) => [name, level])
);

const LIST_ENVS = new Set(["itemize", "enumerate", "description"]);
const MATH_ENVS = new Set([
	"equation",
	"equation*",
	"align",
	"align*",
	"gather",
	"gather*",
	"multline",
	"multline*",
	"displaymath",
	"eqnarray",
	"eqnarray*",
	"flalign",
	"flalign*"
]);
const CODE_ENVS = new Set(["verbatim", "verbatim*", "lstlisting", "minted", "Verbatim", "alltt"]);
const FLOAT_ENVS = new Set(["figure", "figure*", "table", "table*", "wrapfigure"]);
const QUOTE_ENVS = new Set(["quote", "quotation", "verse"]);

const INLINE_MARKS: Record<string, MarkKind> = {
	textbf: "bold",
	bfseries: "bold",
	textit: "italic",
	emph: "emph",
	texttt: "code",
	textsc: "smallcaps",
	underline: "underline",
	uline: "underline",
	sout: "strike",
	st: "strike",
	textsf: "sans",
	textsuperscript: "superscript",
	textsubscript: "subscript"
};

const CITE = /^(no)?cite[a-zA-Z]*$/;
const REF = /^(eq|auto|page|name|c|C|v)?ref$/;

function offsetOf(node: Node | undefined, end = false): number | null {
	const pos = end ? node?.position?.end : node?.position?.start;
	return pos?.offset ?? null;
}

function spanOf(from: Node, to: Node = from): Span | null {
	const a = offsetOf(from);
	const b = offsetOf(to, true);
	return a == null || b == null ? null : { from: a, to: b };
}

function children(node: Node): Node[] {
	return Array.isArray(node.content) ? node.content : [];
}

/** Environment name, e.g. `itemize`. Its `env` is a node list in minimal mode. */
function envName(node: Node): string {
	const env = node.env as Node | string | Node[] | undefined;
	if (typeof env === "string") return env;
	if (Array.isArray(env))
		return env.map((n) => (typeof n.content === "string" ? n.content : "")).join("");
	if (env && typeof env === "object" && typeof env.content === "string") return env.content;
	return "";
}

/**
 * The balanced `{…}` argument of the first `\name` in `text`, as offsets into
 * it: `from`/`to` bound the contents, `start`/`end` the whole command. A regex
 * cannot do this, and `[^}]*` truncated `\caption{a \textbf{b} c}` at the first
 * brace.
 */
export function commandArg(
	text: string,
	name: string
): { start: number; from: number; to: number; end: number } | null {
	const head = new RegExp(`\\\\${name}\\s*\\*?\\s*(?:\\[[^\\]]*\\])?\\s*\\{`);
	const match = head.exec(text);
	if (!match) return null;
	const open = match.index + match[0].length - 1;
	let depth = 0;
	for (let i = open; i < text.length; i++) {
		if (text[i] === "\\") {
			i++;
			continue;
		}
		if (text[i] === "{") depth++;
		else if (text[i] === "}" && --depth === 0)
			return { start: match.index, from: open + 1, to: i, end: i + 1 };
	}
	return null;
}

/** Flatten a node list back to its literal source text. */
function literal(nodes: Node[], source: string): string {
	const from = offsetOf(nodes[0]);
	const to = offsetOf(nodes[nodes.length - 1], true);
	return from == null || to == null ? "" : source.slice(from, to);
}

/** Text content of a group, used for titles, captions and labels. */
function plainText(nodes: Node[]): string {
	let out = "";
	for (const node of nodes) {
		if (node.type === "string" && typeof node.content === "string") out += node.content;
		else if (node.type === "whitespace") out += " ";
		else if (node.type === "group") out += plainText(children(node));
		else if (node.type === "macro" && typeof node.content === "string") {
			// A macro inside a title contributes nothing readable on its own.
			out += "";
		}
	}
	return out.replace(/\s+/g, " ").trim();
}

// --- Inline runs -------------------------------------------------------------

/** How far an unmodelled macro's arguments reach. Stopping at the first group
 *  turned `\textcolor{red}{word}` into `\textcolor{red}word`. */
function argumentsEnd(nodes: Node[], start: number): number {
	let j = start;
	for (;;) {
		const node = nodes[j];
		if (node?.type === "group") {
			j++;
			continue;
		}
		if (node?.type === "string" && node.content === "[") {
			// Bounded: an unclosed `[` in prose would otherwise scan to the end of the
			// paragraph once per macro.
			const limit = Math.min(nodes.length, j + 64);
			let k = j + 1;
			while (k < limit) {
				const inside = nodes[k];
				if (inside.type === "parbreak" || inside.type === "comment") break;
				if (inside.type === "string" && inside.content === "]") break;
				k++;
			}
			if (nodes[k]?.type === "string" && nodes[k].content === "]") {
				j = k + 1;
				continue;
			}
		}
		return j;
	}
}

function parseInlines(nodes: Node[], source: string): Inline[] {
	const out: Inline[] = [];
	const pushText = (text: string) => {
		if (!text) return;
		const last = out[out.length - 1];
		if (last?.kind === "text") last.text += text;
		else out.push({ kind: "text", text });
	};

	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		if (node.type === "string" && typeof node.content === "string") {
			// A tie is a command, not a character: as text it would be escaped back
			// out as a literal tilde and stop binding the two words together.
			if (node.content === "~") out.push({ kind: "raw", source: "~" });
			else pushText(node.content);
			continue;
		}
		if (node.type === "whitespace") {
			pushText(" ");
			continue;
		}
		if (node.type === "inlinemath") {
			const at = offsetOf(node);
			out.push({
				kind: "math",
				source: literal(children(node), source),
				paren: at != null && source.startsWith("\\(", at)
			});
			continue;
		}
		// Braces nobody claimed as an argument are the author's own grouping. Kept
		// whole: dropping them lets `{\bfseries a}` bold the rest of the block.
		if (node.type === "group") {
			const span = spanOf(node);
			if (span) out.push({ kind: "raw", source: source.slice(span.from, span.to) });
			else out.push(...parseInlines(children(node), source));
			continue;
		}
		if (node.type === "macro" && typeof node.content === "string") {
			const name = node.content;
			const next = nodes[i + 1];
			const arg = next?.type === "group" ? next : null;

			const mark = INLINE_MARKS[name];
			if (mark && arg) {
				out.push({
					kind: "mark",
					mark,
					command: name,
					content: parseInlines(children(arg), source)
				});
				i++;
				continue;
			}
			if (CITE.test(name) && arg) {
				const raw = literal(children(arg), source);
				out.push({
					kind: "cite",
					command: name,
					raw,
					keys: raw
						.split(",")
						.map((k) => k.trim())
						.filter(Boolean)
				});
				i++;
				continue;
			}
			if (REF.test(name) && arg) {
				out.push({
					kind: "ref",
					command: name,
					target: plainText(children(arg))
				});
				i++;
				continue;
			}
			if (name === "label" && arg) {
				out.push({ kind: "label", name: plainText(children(arg)) });
				i++;
				continue;
			}
			// Sliced from the source, not projected: a URL is full of characters
			// (`~`, `_`, `%`) that the text projection would drop or rewrite.
			if (name === "url" && arg) {
				const url = literal(children(arg), source);
				out.push({ kind: "link", command: "url", url, text: url });
				i++;
				continue;
			}
			if (name === "href" && arg && nodes[i + 2]?.type === "group") {
				out.push({
					kind: "link",
					command: "href",
					url: literal(children(arg), source),
					text: literal(children(nodes[i + 2]), source)
				});
				i += 2;
				continue;
			}
			if (name === "footnote" && arg) {
				out.push({ kind: "footnote", source: literal(children(arg), source) });
				i++;
				continue;
			}
			// Escaped punctuation reads as the character it produces.
			if (/^[%&$#_{}]$/.test(name)) {
				pushText(name);
				continue;
			}
			// Unmodelled: keep the command and every argument it takes, verbatim.
			const last = argumentsEnd(nodes, i + 1);
			const span = spanOf(node, last > i + 1 ? nodes[last - 1] : node);
			out.push({
				kind: "raw",
				source: span ? source.slice(span.from, span.to) : `\\${name}`
			});
			i = last - 1;
			continue;
		}
		if (node.type === "comment") {
			out.push({
				kind: "comment",
				text: typeof node.content === "string" ? node.content : "",
				sameline: node.sameline === true
			});
			continue;
		}
		const span = spanOf(node);
		if (span) out.push({ kind: "raw", source: source.slice(span.from, span.to) });
	}

	// Collapse the runs of spaces that LaTeX itself would collapse.
	for (const run of out) if (run.kind === "text") run.text = run.text.replace(/[ \t]+/g, " ");
	return out.filter((run) => run.kind !== "text" || run.text !== "");
}

/**
 * Drop the whitespace at a block's edges. A block's span starts at its first
 * meaningful node, so keeping the newline in front of it would make every
 * reprint one space longer than the last, so the round trip would never settle.
 */
function trimRuns(runs: Inline[]): Inline[] {
	const out = runs.slice();
	while (out.length) {
		const first = out[0];
		// A comment at either edge lies outside the span too, since the span starts
		// and ends at meaningful nodes. Printing one back would duplicate it.
		if (first.kind === "comment") {
			out.shift();
			continue;
		}
		if (first.kind !== "text") break;
		const text = first.text.replace(/^\s+/, "");
		if (text) {
			out[0] = { kind: "text", text };
			break;
		}
		out.shift();
	}
	while (out.length) {
		const last = out[out.length - 1];
		if (last.kind === "comment") {
			out.pop();
			continue;
		}
		if (last.kind !== "text") break;
		const text = last.text.replace(/\s+$/, "");
		if (text) {
			out[out.length - 1] = { kind: "text", text };
			break;
		}
		out.pop();
	}
	return out;
}

/** Inline runs for a block's content, safe to print straight back out. */
function blockInlines(nodes: Node[], source: string): Inline[] {
	return trimRuns(parseInlines(nodes, source));
}

/**
 * Read a snippet that is not a block of its own: a table cell, where `\textbf{…}`
 * has to render as bold rather than as the six characters someone typed.
 */
export function parseInlineFragment(source: string): Inline[] {
	if (!source.trim()) return [];
	return blockInlines(children(parseMinimal(source) as unknown as Node), source);
}

// --- Blocks ------------------------------------------------------------------

/**
 * `\item[Term]` in a description list. Split off the projected text rather than
 * the node stream: minimal mode tokenises `[` as its own node, so matching the
 * bracket against the AST misses it and leaves the term inside the item's prose.
 */
function extractTerm(content: Inline[]): { term?: string; content: Inline[] } {
	const first = content[0];
	if (first?.kind !== "text") return { content };
	const bracket = /^\s*\[([^\]]*)\]\s*/.exec(first.text);
	if (!bracket) return { content };
	const rest = first.text.slice(bracket[0].length);
	return {
		term: bracket[1],
		content: rest ? [{ kind: "text", text: rest }, ...content.slice(1)] : content.slice(1)
	};
}

function listItems(nodes: Node[], source: string, description: boolean) {
	const items: { term?: string; content: Inline[] }[] = [];
	let current: Node[] | null = null;

	const flush = () => {
		if (!current) return;
		const content = blockInlines(current, source);
		items.push(description ? extractTerm(content) : { content });
		current = null;
	};

	for (const node of nodes) {
		if (node.type === "macro" && node.content === "item") {
			flush();
			current = [];
			continue;
		}
		if (current) current.push(node);
	}
	flush();
	return items;
}

/** Strip `\begin{env}[opts]` and `\end{env}` off an environment's source. */
function envBody(text: string): string {
	return text
		.replace(/^\\begin\s*\{[^}]*\}[ \t]*(?:\[[^\]]*\])?[ \t]*\r?\n?/, "")
		.replace(/\r?\n?[ \t]*\\end\s*\{[^}]*\}[ \t]*$/, "");
}

function blockFor(node: Node, source: string, span: Span): Block | null {
	// A verbatim environment is its own node type too, and its body arrives as one
	// raw string, which is the point: nothing inside it is LaTeX.
	if (node.type === "verbatim") {
		return {
			kind: "code",
			source: typeof node.content === "string" ? node.content : "",
			environment: envName(node) || "verbatim",
			span,
			fidelity: "source"
		};
	}

	// `equation` and friends parse as `mathenv`, a type of their own rather than
	// an `environment`, so they need matching before the generic branch.
	if (node.type === "mathenv") {
		return {
			kind: "math",
			source: literal(children(node), source),
			environment: envName(node) || null,
			span,
			fidelity: "source"
		};
	}

	if (node.type === "environment") {
		const name = envName(node);
		const body = children(node);
		if (LIST_ENVS.has(name)) {
			return {
				kind: "list",
				environment: name,
				ordered: name === "enumerate",
				description: name === "description",
				items: listItems(body, source, name === "description"),
				span,
				fidelity: "native"
			};
		}
		if (MATH_ENVS.has(name)) {
			return {
				kind: "math",
				source: literal(body, source),
				environment: name,
				span,
				fidelity: "source"
			};
		}
		if (CODE_ENVS.has(name)) {
			// Sliced from the source, not from the child nodes: a listing's body is
			// not LaTeX, so it has no nodes to read positions off.
			return {
				kind: "code",
				source: envBody(source.slice(span.from, span.to)),
				environment: name,
				span,
				fidelity: "source"
			};
		}
		if (QUOTE_ENVS.has(name)) {
			return {
				kind: "quote",
				environment: name,
				content: blockInlines(body, source),
				span,
				fidelity: "native"
			};
		}
		if (FLOAT_ENVS.has(name)) {
			const text = source.slice(span.from, span.to);
			const captionAt = commandArg(text, "caption");
			return {
				kind: "float",
				environment: name,
				caption: captionAt ? text.slice(captionAt.from, captionAt.to) : null,
				label: /\\label\s*\{([^}]*)\}/.exec(text)?.[1] ?? null,
				graphic: /\\includegraphics(?:\[[^\]]*\])?\s*\{([^}]*)\}/.exec(text)?.[1] ?? null,
				span,
				fidelity: "source"
			};
		}
		return {
			kind: "raw",
			label: name || "environment",
			source: source.slice(span.from, span.to),
			span,
			fidelity: "raw"
		};
	}

	if (node.type === "displaymath") {
		return {
			kind: "math",
			source: literal(children(node), source),
			environment: null,
			span,
			fidelity: "source"
		};
	}

	return null;
}

/**
 * A sectioning command with its (optional) star and title group. In minimal mode
 * the star is its own `string` node, so `\section*{X}` is three nodes, not one.
 */
function headingAt(
	nodes: Node[],
	i: number,
	source: string
): { block: Block; next: number } | null {
	const node = nodes[i];
	if (node.type !== "macro" || typeof node.content !== "string") return null;
	const level = SECTION_LEVEL[node.content];
	if (level === undefined) return null;

	let j = i + 1;
	const star = nodes[j];
	const starred = star?.type === "string" && star.content === "*";
	if (starred) j++;

	const group = nodes[j];
	if (group?.type !== "group") return null;
	const span = spanOf(node, group);
	if (!span) return null;

	return {
		block: {
			kind: "heading",
			level,
			starred,
			title: blockInlines(children(group), source),
			span,
			fidelity: "native"
		},
		next: j
	};
}

/** Split a run of inline nodes into paragraphs on `parbreak`. */
function paragraphs(nodes: Node[], source: string): Block[] {
	const out: Block[] = [];
	let run: Node[] = [];

	const flush = () => {
		const meaningful = run.filter((n) => n.type !== "whitespace" && n.type !== "comment");
		if (meaningful.length) {
			const from = offsetOf(meaningful[0]);
			const to = offsetOf(meaningful[meaningful.length - 1], true);
			const content = blockInlines(run, source);
			if (from != null && to != null && content.length) {
				out.push({
					kind: "paragraph",
					content,
					span: { from, to },
					fidelity: "native"
				});
			}
		}
		run = [];
	};

	for (const node of nodes) {
		if (node.type === "parbreak") flush();
		else run.push(node);
	}
	flush();
	return out;
}

function scanPreamble(source: string, end: number) {
	const head = source.slice(0, end);
	const packages: string[] = [];
	const macros: string[] = [];
	let m: RegExpExecArray | null;

	const pkg = /\\(?:usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
	while ((m = pkg.exec(head)))
		for (const p of m[1].split(",")) if (p.trim()) packages.push(p.trim());

	const def =
		/\\(?:newcommand|renewcommand|providecommand|DeclareMathOperator|NewDocumentCommand)\s*\*?\s*\{?\\([a-zA-Z@]+)\}?/g;
	while ((m = def.exec(head))) macros.push(m[1]);

	return {
		span: { from: 0, to: end },
		documentClass: /\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/.exec(head)?.[1] ?? null,
		packages,
		macros
	};
}

/**
 * A `\label` on its own line is an anchor for the block above it, not a
 * paragraph. Fold it in and widen that block's span, so rewriting the block
 * carries the anchor rather than orphaning it.
 */
function foldLabels(blocks: Block[]): Block[] {
	const out: Block[] = [];
	for (const block of blocks) {
		const onlyLabels =
			block.kind === "paragraph" &&
			block.content.length > 0 &&
			block.content.every(
				(run) => run.kind === "label" || (run.kind === "text" && !run.text.trim())
			);
		const previous = out[out.length - 1];
		if (onlyLabels && previous) {
			const names = block.content.flatMap((run) => (run.kind === "label" ? [run.name] : []));
			previous.labels = [...(previous.labels ?? []), ...names];
			previous.span = { from: previous.span.from, to: block.span.to };
			continue;
		}
		out.push(block);
	}
	return out;
}

/** Demote any block our printer cannot reproduce: fidelity is a claim about the
 *  content, not about the kind. */
function guardFidelity(blocks: Block[], source: string): Block[] {
	const settle = (text: string) => text.replace(/\s+/g, " ").trim();
	return blocks.map((block) => {
		if (block.fidelity !== "native") return block;
		const original = source.slice(block.span.from, block.span.to);
		if (settle(printBlock(block, source)) === settle(original)) return block;
		return { ...block, fidelity: "source" as const };
	});
}

/** Project LaTeX source into a preamble summary plus body blocks. */
export function parseTexDoc(source: string): TexDoc {
	const ast = parseMinimal(source) as unknown as Node;
	const top = children(ast);

	// The body is the `document` environment when there is one; a fragment
	// (an \input-ed chapter) is body from end to end.
	const documentEnv = top.find((n) => n.type === "environment" && envName(n) === "document");
	const bodyNodes = documentEnv ? children(documentEnv) : top;
	const bodySpan =
		documentEnv && bodyNodes.length
			? {
					from: offsetOf(bodyNodes[0]) ?? 0,
					to: offsetOf(bodyNodes[bodyNodes.length - 1], true) ?? source.length
				}
			: { from: 0, to: source.length };

	const blocks: Block[] = [];
	let inlineRun: Node[] = [];
	const flushParagraphs = () => {
		if (inlineRun.length) blocks.push(...paragraphs(inlineRun, source));
		inlineRun = [];
	};

	for (let i = 0; i < bodyNodes.length; i++) {
		const node = bodyNodes[i];

		const heading = headingAt(bodyNodes, i, source);
		if (heading) {
			flushParagraphs();
			blocks.push(heading.block);
			i = heading.next;
			continue;
		}

		const span = spanOf(node);
		const block = span ? blockFor(node, source, span) : null;
		if (block) {
			flushParagraphs();
			blocks.push(block);
			continue;
		}
		inlineRun.push(node);
	}
	flushParagraphs();

	return {
		preamble: scanPreamble(source, documentEnv ? (offsetOf(documentEnv) ?? 0) : 0),
		blocks: guardFidelity(foldLabels(blocks), source),
		bodySpan,
		fragment: !documentEnv
	};
}
