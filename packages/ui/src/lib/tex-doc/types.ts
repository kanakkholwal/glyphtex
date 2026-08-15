/**
 * A projection of LaTeX source into editable blocks.
 *
 * The source string stays the single source of truth: every block carries the
 * byte range it came from, so an edit is a patch over that range and everything
 * outside it survives untouched. Anything the model does not understand becomes
 * a {@link RawBlock} holding its source verbatim, so nothing can be lost.
 */

/** Half-open byte range into the source: `source.slice(from, to)`. */
export type Span = { from: number; to: number };

/** The sectioning ladder, indexed by {@link HeadingBlock.level}. */
export const SECTION_COMMANDS = [
	'part',
	'chapter',
	'section',
	'subsection',
	'subsubsection',
	'paragraph',
	'subparagraph'
] as const;

/**
 * How faithfully a block is modelled, which decides how it is edited.
 * `native` blocks round-trip through our own printer; `source` blocks render but
 * are edited as raw LaTeX; `raw` blocks are inert and open in the LaTeX view.
 */
export type Fidelity = 'native' | 'source' | 'raw';

export type MarkKind =
	| 'bold'
	| 'italic'
	| 'emph'
	| 'code'
	| 'smallcaps'
	| 'underline'
	| 'strike'
	| 'sans'
	| 'superscript'
	| 'subscript';

/** Inline run inside a paragraph or heading. */
export type Inline =
	| { kind: 'text'; text: string }
	/** `command` is the macro it came from, so `\textsc` is not reprinted as
	 *  `\emph` when the block is written back. */
	| { kind: 'mark'; mark: MarkKind; command: string; content: Inline[] }
	| { kind: 'math'; source: string }
	| { kind: 'cite'; command: string; keys: string[] }
	| { kind: 'ref'; command: string; target: string }
	| { kind: 'label'; name: string }
	/** `\href{url}{text}`, or `\url{url}` with no separate text. */
	| { kind: 'link'; command: 'href' | 'url'; url: string; text: string }
	/** The argument is kept as source, not runs: a footnote can hold anything, and
	 *  writing it back verbatim is what keeps the round trip exact. */
	| { kind: 'footnote'; source: string }
	/** A command we do not model: shown as an inert chip, never rewritten. */
	| { kind: 'raw'; source: string };

type BlockBase = {
	span: Span;
	fidelity: Fidelity;
	/**
	 * `\label`s that belong to this block. A label on its own line is folded into
	 * the block above it, and the span widened to cover it, so rewriting the block
	 * carries its anchor along instead of orphaning it.
	 */
	labels?: string[];
};

export type HeadingBlock = {
	kind: 'heading';
	/** 0 = part … 6 = subparagraph, matching the sectioning ladder. */
	level: number;
	/** `\section*`: unnumbered, and kept so write-back doesn't renumber the doc. */
	starred: boolean;
	title: Inline[];
} & BlockBase;

export type ParagraphBlock = {
	kind: 'paragraph';
	content: Inline[];
} & BlockBase;

export type ListBlock = {
	kind: 'list';
	/** The source environment, so `enumerate*` and friends print back as written. */
	environment: string;
	ordered: boolean;
	description: boolean;
	items: { term?: string; content: Inline[] }[];
} & BlockBase;

export type MathBlock = {
	kind: 'math';
	/** The body without its delimiters, for rendering. */
	source: string;
	/** `equation`, `align`, or null for `\[ … \]`. */
	environment: string | null;
} & BlockBase;

export type CodeBlock = {
	kind: 'code';
	source: string;
	environment: string;
} & BlockBase;

export type QuoteBlock = {
	kind: 'quote';
	environment: string;
	content: Inline[];
} & BlockBase;

/** A figure or table: rendered as a card, edited in the LaTeX view for now. */
export type FloatBlock = {
	kind: 'float';
	environment: string;
	caption: string | null;
	label: string | null;
	/** Path from `\includegraphics`, when there is one. */
	graphic: string | null;
} & BlockBase;

/** Anything unmodelled. Never rewritten, never reformatted. */
export type RawBlock = {
	kind: 'raw';
	/** What to call it in the chip: an environment or command name. */
	label: string;
	source: string;
} & BlockBase;

export type Block =
	| HeadingBlock
	| ParagraphBlock
	| ListBlock
	| MathBlock
	| CodeBlock
	| QuoteBlock
	| FloatBlock
	| RawBlock;

/** The parsed document: a preamble summary plus the body's blocks. */
export type TexDoc = {
	/** Everything before `\begin{document}`; never block-edited. */
	preamble: {
		span: Span;
		documentClass: string | null;
		packages: string[];
		/** `\newcommand` and friends, so the reader knows what is defined. */
		macros: string[];
	};
	/** Body content between the document delimiters. */
	blocks: Block[];
	/** Body range, so a patch can be bounded to it. */
	bodySpan: Span;
	/** True when there is no `\begin{document}`: the whole file is body. */
	fragment: boolean;
};
