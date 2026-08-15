import { printBlock, printInlines } from './print';
import type { Block, Inline, Span } from './types';

// Source patches for block edits: a splice over one block's span, so everything
// outside it survives byte for byte.

export type Patch = { from: number; to: number; insert: string };

export function applyPatch(source: string, patch: Patch): string {
	return source.slice(0, patch.from) + patch.insert + source.slice(patch.to);
}

/** Back to front, so the earlier patches keep their offsets. */
export function applyPatches(source: string, patches: (Patch | null)[]): string {
	return patches
		.filter((patch): patch is Patch => patch !== null)
		.sort((a, b) => b.from - a.from)
		.reduce(applyPatch, source);
}

/** How many characters the document grew (or shrank) by. */
export function patchDelta(patch: Patch): number {
	return patch.insert.length - (patch.to - patch.from);
}

/** Rewrite one block in place. */
export function replaceBlock(source: string, block: Block, next: Block): Patch {
	return { ...block.span, insert: printBlock(next, source) };
}

/** Replace a block's inline content, keeping everything else about it. */
export function setInlines(source: string, block: Block, content: Inline[]): Patch | null {
	if (block.kind === 'paragraph') return replaceBlock(source, block, { ...block, content });
	if (block.kind === 'heading') return replaceBlock(source, block, { ...block, title: content });
	if (block.kind === 'quote') return replaceBlock(source, block, { ...block, content });
	return null;
}

/** Replace one item's inline content in a list. */
export function setListItem(
	source: string,
	block: Extract<Block, { kind: 'list' }>,
	index: number,
	content: Inline[]
): Patch {
	const items = block.items.map((item, i) => (i === index ? { ...item, content } : item));
	return replaceBlock(source, block, { ...block, items });
}

export function setListItems(
	source: string,
	block: Extract<Block, { kind: 'list' }>,
	items: Extract<Block, { kind: 'list' }>['items']
): Patch {
	return replaceBlock(source, block, { ...block, items });
}

/** LaTeX separates paragraphs with a blank line, so that is what goes between
 *  the two halves. */
export function splitParagraph(block: Block, left: Inline[], right: Inline[]): Patch {
	return {
		...block.span,
		insert: `${printInlines(left)}\n\n${printInlines(right)}`
	};
}

/** Append `block`'s content to the end of `previous` and drop the separator. */
export function mergeIntoPrevious(source: string, previous: Block, block: Block): Patch | null {
	if (previous.fidelity !== 'native' || block.kind !== 'paragraph') return null;

	const tail = block.content;
	const merged =
		previous.kind === 'heading'
			? printBlock({ ...previous, title: [...previous.title, ...tail] }, source)
			: previous.kind === 'paragraph'
				? printBlock({ ...previous, content: [...previous.content, ...tail] }, source)
				: null;
	if (merged === null) return null;

	return { from: previous.span.from, to: block.span.to, insert: merged };
}

/** Insert new source after a block, on its own paragraph. */
export function insertAfter(block: Block, text: string): Patch {
	return { from: block.span.to, to: block.span.to, insert: `\n\n${text}` };
}

/** Insert at the top of the body, for a document with nothing in it yet. */
export function insertAtStart(bodySpan: Span, text: string): Patch {
	return { from: bodySpan.from, to: bodySpan.from, insert: `${text}\n\n` };
}

/** Takes the blank line with it, so deleting from the middle does not leave a
 *  widening gap behind. */
export function deleteBlock(source: string, block: Block): Patch {
	let { from, to } = block.span;
	const trailing = /^\n[ \t]*\n/.exec(source.slice(to));
	if (trailing) to += trailing[0].length;
	else {
		const leading = /\n[ \t]*\n$/.exec(source.slice(0, from));
		if (leading) from -= leading[0].length;
	}
	return { from, to, insert: '' };
}

// --- Floats -------------------------------------------------------------------
// Rewrite the one command inside the span; everything else in the environment is
// left exactly as written.

/** Rewrite capture group 1 inside a block. The `d` flag is what makes this use
 *  the group's own offsets rather than searching for the matched text again. */
function patchInside(
	source: string,
	block: Block,
	pattern: RegExp,
	replacement: string
): Patch | null {
	const match = pattern.exec(source.slice(block.span.from, block.span.to));
	const at = match?.indices?.[1];
	if (!at) return null;
	return { from: block.span.from + at[0], to: block.span.from + at[1], insert: replacement };
}

const CAPTION = /\\caption\s*\*?\s*(?:\[[^\]]*\])?\s*\{([\s\S]*?)\}/d;
const LABEL = /\\label\s*\{([^}]*)\}/d;
const GRAPHIC = /\\includegraphics\s*\*?\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/d;
const GRAPHIC_WIDTH = /\\includegraphics\s*\*?\s*\[[^\]]*?width\s*=\s*([^,\]]+)[^\]]*\]/d;
const GRAPHIC_OPTS = /\\includegraphics\s*\*?\s*(\[[^\]]*\])?\s*\{/d;
const PLACEMENT = /^\\begin\s*\{[^}]*\}[ \t]*(\[[^\]]*\])?/d;
const ALIGNMENT = /\\(centering|raggedright|raggedleft)\b/d;

/** Insert on the line above `\end{env}`, matching its indentation. */
function insertBeforeEnd(source: string, block: Block, text: string): Patch {
	const inner = source.slice(block.span.from, block.span.to);
	const end = /\n([ \t]*)\\end\s*\{[^}]*\}[ \t]*$/.exec(inner);
	const at = block.span.from + (end ? end.index : inner.length);
	return { from: at, to: at, insert: `\n${end?.[1] ?? ''}  ${text}` };
}

/** Set the caption, creating one when the float has none yet. Removing the text
 *  removes the command: an empty `\caption{}` still prints "Figure 1:". */
export function setFloatCaption(source: string, block: Block, caption: string): Patch | null {
	const existing = patchInside(source, block, CAPTION, caption);
	if (existing) return caption.trim() ? existing : removeCommand(source, block, CAPTION);
	return caption.trim() ? insertBeforeEnd(source, block, `\\caption{${caption}}`) : null;
}

/** The `\label` a float carries, if any. Read off the source rather than the
 *  block so it stays right after an edit that has not been reparsed yet. */
export function floatLabel(source: string, block: Block): string | null {
	return LABEL.exec(source.slice(block.span.from, block.span.to))?.[1] ?? null;
}

export function setFloatLabel(source: string, block: Block, label: string): Patch | null {
	const existing = patchInside(source, block, LABEL, label);
	if (existing) return label.trim() ? existing : removeCommand(source, block, LABEL);
	return label.trim() ? insertBeforeEnd(source, block, `\\label{${label}}`) : null;
}

/** Drop a whole command, and the line it sits on when that line is now blank. */
function removeCommand(source: string, block: Block, pattern: RegExp): Patch | null {
	const inner = source.slice(block.span.from, block.span.to);
	const match = pattern.exec(inner);
	if (!match) return null;
	let from = block.span.from + match.index;
	let to = from + match[0].length;
	const before = /\n[ \t]*$/.exec(source.slice(block.span.from, from));
	if (before && /^[ \t]*(\n|$)/.test(source.slice(to))) from -= before[0].length;
	return { from, to, insert: '' };
}

export function setFloatGraphic(source: string, block: Block, path: string): Patch | null {
	return patchInside(source, block, GRAPHIC, path);
}

/** Set `width=`, adding the option list or the key when the graphic has neither. */
export function setFloatWidth(source: string, block: Block, width: string): Patch | null {
	const existing = patchInside(source, block, GRAPHIC_WIDTH, width);
	if (existing) return existing;
	const inner = source.slice(block.span.from, block.span.to);
	const match = GRAPHIC_OPTS.exec(inner);
	const at = match?.indices?.[1];
	if (!match) return null;
	if (!at) {
		const insertAt = block.span.from + match.index + match[0].length - 1;
		return { from: insertAt, to: insertAt, insert: `[width=${width}]` };
	}
	const keys = inner.slice(at[0] + 1, at[1] - 1).trim();
	return {
		from: block.span.from + at[0],
		to: block.span.from + at[1],
		insert: `[${keys ? `${keys}, ` : ''}width=${width}]`
	};
}

/** The `width=` argument on a float's `\includegraphics`, if it has one. */
export function floatWidth(source: string, block: Block): string | null {
	return GRAPHIC_WIDTH.exec(source.slice(block.span.from, block.span.to))?.[1].trim() ?? null;
}

/** The `[htbp]` argument on `\begin{figure}`, without its brackets. */
export function floatPlacement(source: string, block: Block): string | null {
	const match = PLACEMENT.exec(source.slice(block.span.from, block.span.to));
	return match?.[1] ? match[1].slice(1, -1) : null;
}

export function setFloatPlacement(source: string, block: Block, placement: string): Patch | null {
	const inner = source.slice(block.span.from, block.span.to);
	const match = PLACEMENT.exec(inner);
	if (!match) return null;
	const at = match.indices?.[1];
	const from = block.span.from + (at ? at[0] : match[0].length);
	const to = block.span.from + (at ? at[1] : match[0].length);
	return { from, to, insert: placement ? `[${placement}]` : '' };
}

export type FloatAlignment = 'centering' | 'raggedright' | 'raggedleft' | null;

export function floatAlignment(source: string, block: Block): FloatAlignment {
	const found = ALIGNMENT.exec(source.slice(block.span.from, block.span.to))?.[1];
	return (found as FloatAlignment) ?? null;
}

export function setFloatAlignment(
	source: string,
	block: Block,
	alignment: FloatAlignment
): Patch | null {
	const existing = patchInside(source, block, ALIGNMENT, alignment ?? '');
	if (existing) return alignment ? existing : removeCommand(source, block, ALIGNMENT);
	if (!alignment) return null;
	// First thing inside the environment, which is where it has to be to apply to
	// everything after it.
	const inner = source.slice(block.span.from, block.span.to);
	const begin = /^\\begin\s*\{[^}]*\}[ \t]*(?:\[[^\]]*\])?[ \t]*/.exec(inner);
	const at = block.span.from + (begin?.[0].length ?? 0);
	return { from: at, to: at, insert: `\n  \\${alignment}` };
}

/** Figure to `wrapfigure` and back. Everything inside is left alone. */
export function setFloatWrap(
	source: string,
	block: Block,
	side: 'l' | 'r' | null,
	width = '0.45\\linewidth'
): Patch | null {
	const inner = source.slice(block.span.from, block.span.to);
	const begin =
		/^\\begin\s*\{(figure\*?|wrapfigure)\}[ \t]*(?:\[[^\]]*\])?[ \t]*(?:\{[^}]*\}[ \t]*)*/.exec(
			inner
		);
	if (!begin) return null;
	const head = side ? `\\begin{wrapfigure}{${side}}{${width}}` : `\\begin{figure}[h]`;
	const rest = inner
		.slice(begin[0].length)
		.replace(
			/\\end\s*\{(figure\*?|wrapfigure)\}[ \t]*$/,
			`\\end{${side ? 'wrapfigure' : 'figure'}}`
		);
	return { ...block.span, insert: head + rest };
}

/** Where a `\usepackage` should go, when a control needs one that is missing. */
export function ensurePackage(source: string, preambleEnd: number, name: string): Patch | null {
	const head = source.slice(0, preambleEnd);
	if (new RegExp(`\\\\usepackage\\s*(?:\\[[^\\]]*\\])?\\s*\\{[^}]*\\b${name}\\b`).test(head))
		return null;
	const packages = [...head.matchAll(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g)];
	const last = packages[packages.length - 1];
	const documentClass = /\\documentclass\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/.exec(head);
	const anchor = last ?? documentClass;
	if (!anchor) return null;
	const at = (anchor.index ?? 0) + anchor[0].length;
	return { from: at, to: at, insert: `\n\\usepackage{${name}}` };
}

/** Swap the environment a block is written in, keeping its body. */
export function setEnvironment(source: string, block: Block, name: string): Patch | null {
	const inner = source.slice(block.span.from, block.span.to);
	const begin = /^\\begin\s*\{([^}]*)\}/.exec(inner);
	const end = /\\end\s*\{([^}]*)\}[ \t]*$/.exec(inner);
	if (!begin || !end || begin[1] === name) return null;
	const body = inner.slice(begin[0].length, end.index);
	return { ...block.span, insert: `\\begin{${name}}${body}\\end{${name}}` };
}

/** A `key=value` from an environment's optional argument, such as a listing's
 *  `language=`. */
export function envOption(source: string, block: Block, key: string): string | null {
	const options = PLACEMENT.exec(source.slice(block.span.from, block.span.to))?.[1];
	const found = options
		?.slice(1, -1)
		.split(',')
		.find((pair) => pair.trim().startsWith(`${key}=`));
	return found ? found.split('=').slice(1).join('=').trim() : null;
}

/** Set or clear one option, leaving the others in the order they were written. */
export function setEnvOption(
	source: string,
	block: Block,
	key: string,
	value: string
): Patch | null {
	const inner = source.slice(block.span.from, block.span.to);
	const match = PLACEMENT.exec(inner);
	if (!match) return null;
	const at = match.indices?.[1];
	const pairs = (at ? inner.slice(at[0] + 1, at[1] - 1) : '')
		.split(',')
		.map((pair) => pair.trim())
		.filter((pair) => pair && !pair.startsWith(`${key}=`));
	if (value) pairs.push(`${key}=${value}`);
	return {
		from: block.span.from + (at ? at[0] : match[0].length),
		to: block.span.from + (at ? at[1] : match[0].length),
		insert: pairs.length ? `[${pairs.join(', ')}]` : ''
	};
}

/** `\[ … \]` has no number to turn on, so switching it on promotes it to an
 *  `equation`; the rest are one star away. */
export function setMathNumbered(source: string, block: Block, on: boolean): Patch | null {
	if (block.kind !== 'math') return null;
	const environment = block.environment;
	if (!environment) {
		if (!on) return null;
		const inner = source.slice(block.span.from, block.span.to);
		const body = inner.replace(/^\\\[/, '').replace(/\\\]$/, '');
		return { ...block.span, insert: `\\begin{equation}${body}\\end{equation}` };
	}
	const starred = environment.endsWith('*');
	if (starred === !on) return null;
	return setEnvironment(source, block, on ? environment.slice(0, -1) : `${environment}*`);
}

export { BLOCK_TEMPLATES, CARET, expandTemplate, templateSource } from './templates';
export type { BlockTemplate } from './templates';
