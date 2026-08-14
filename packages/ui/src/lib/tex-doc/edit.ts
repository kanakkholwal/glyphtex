import { printBlock, printInlines } from './print';
import type { Block, Inline, Span } from './types';

/**
 * Source patches for block edits.
 *
 * Every visual edit is a splice over one block's span. Nothing outside the span
 * is read or rewritten, so a document full of TikZ, custom environments and
 * hand-tuned spacing survives an edit to the paragraph next to it byte for byte.
 */

export type Patch = { from: number; to: number; insert: string };

export function applyPatch(source: string, patch: Patch): string {
	return source.slice(0, patch.from) + patch.insert + source.slice(patch.to);
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

/**
 * Split a paragraph in two at a run boundary. LaTeX separates paragraphs with a
 * blank line, so that is what goes between them.
 */
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

/**
 * Remove a block along with the blank line that separated it, so deleting the
 * middle of a document does not leave a widening gap behind.
 */
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
// A figure or table is edited in place: we rewrite the one command inside its
// span and leave the rest of the environment — placement, spacing, subfigures,
// anything we do not model — exactly as written.

/** Rewrite the first match of `pattern` inside a block's span. Group 1 is the
 *  part replaced, so the surrounding command survives verbatim. */
function patchInside(
	source: string,
	block: Block,
	pattern: RegExp,
	replacement: string
): Patch | null {
	const text = source.slice(block.span.from, block.span.to);
	const match = pattern.exec(text);
	if (!match || match.index === undefined) return null;
	const at = block.span.from + match.index + match[0].indexOf(match[1], 0);
	return { from: at, to: at + match[1].length, insert: replacement };
}

const CAPTION = /\caption\s*\*?\s*(?:\[[^\]]*\])?\s*\{([\s\S]*?)\}/;
const GRAPHIC = /\includegraphics\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/;
const GRAPHIC_WIDTH = /\includegraphics\s*\[[^\]]*?width\s*=\s*([^,\]]+)[^\]]*\]/;

export function setFloatCaption(source: string, block: Block, caption: string): Patch | null {
	return patchInside(source, block, CAPTION, caption);
}

export function setFloatGraphic(source: string, block: Block, path: string): Patch | null {
	return patchInside(source, block, GRAPHIC, path);
}

export function setFloatWidth(source: string, block: Block, width: string): Patch | null {
	return patchInside(source, block, GRAPHIC_WIDTH, width);
}

/** The `width=` argument on a float's `\includegraphics`, if it has one. */
export function floatWidth(source: string, block: Block): string | null {
	return GRAPHIC_WIDTH.exec(source.slice(block.span.from, block.span.to))?.[1].trim() ?? null;
}

export { BLOCK_TEMPLATES, CARET, expandTemplate, templateSource } from './templates';
export type { BlockTemplate } from './templates';
