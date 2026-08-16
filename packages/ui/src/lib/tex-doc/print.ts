import { SECTION_COMMANDS, type Block, type Inline } from './types';

/**
 * Blocks → LaTeX.
 *
 * Only `native` blocks are ever printed; everything else is written back as the
 * bytes it was read from, which is why {@link printBlock} takes the source. The
 * contract this must hold is idempotence: `print(parse(print(b))) === print(b)`,
 * so switching modes repeatedly can never drift.
 *
 * `printRaw` from unified-latex is deliberately not used: it normalises
 * whitespace, so a round-trip through it rewrites lines nobody edited.
 */

// One pass, not one per character class: a second pass would escape the braces
// in the `\textbackslash{}` the first pass just produced.
const ESCAPABLE = /[\\^~%&#_${}]/g;

const ESCAPED: Record<string, string> = {
	'\\': '\\textbackslash{}',
	'^': '\\textasciicircum{}',
	'~': '\\textasciitilde{}'
};

/** Escape a literal text run so it survives a LaTeX round-trip unchanged. */
export function escapeText(text: string): string {
	return text.replace(ESCAPABLE, (char) => ESCAPED[char] ?? `\\${char}`);
}

export function printInlines(runs: Inline[]): string {
	let out = '';
	for (const run of runs) {
		switch (run.kind) {
			case 'text':
				out += escapeText(run.text);
				break;
			case 'mark':
				out += `\\${run.command}{${printInlines(run.content)}}`;
				break;
			case 'math':
				out += run.paren ? `\\(${run.source}\\)` : `$${run.source}$`;
				break;
			case 'cite':
				out += `\\${run.command}{${run.raw ?? run.keys.join(', ')}}`;
				break;
			case 'ref':
				out += `\\${run.command}{${run.target}}`;
				break;
			case 'label':
				out += `\\label{${run.name}}`;
				break;
			case 'link':
				out += run.command === 'url' ? `\\url{${run.url}}` : `\\href{${run.url}}{${run.text}}`;
				break;
			case 'footnote':
				out += `\\footnote{${run.source}}`;
				break;
			case 'comment':
				// The trailing newline is load-bearing: without it the rest of the
				// paragraph ends up inside the comment.
				out += `${run.sameline ? ' ' : '\n'}%${run.text.replace(/[\r\n]+/g, ' ')}\n`;
				break;
			case 'raw':
				out += run.source;
				break;
		}
	}
	return out;
}

/** Trailing `\label`s, each on its own line, matching how they were folded in. */
function printLabels(block: Block): string {
	return (block.labels ?? []).map((name) => `\n\\label{${name}}`).join('');
}

export function sectionCommand(level: number, starred = false): string {
	const name = SECTION_COMMANDS[Math.min(Math.max(level, 0), SECTION_COMMANDS.length - 1)];
	return `\\${name}${starred ? '*' : ''}`;
}

function printListItems(block: Extract<Block, { kind: 'list' }>): string {
	return block.items
		.map((item) => {
			const term = block.description && item.term ? `[${item.term}]` : '';
			return `  \\item${term} ${printInlines(item.content)}`.trimEnd();
		})
		.join('\n');
}

/**
 * One block back to LaTeX. Blocks we do not model natively are returned as the
 * exact bytes they came from, so editing a paragraph can never reformat the
 * TikZ picture next to it.
 */
export function printBlock(block: Block, source: string): string {
	if (block.fidelity !== 'native') return source.slice(block.span.from, block.span.to);

	switch (block.kind) {
		case 'heading':
			return `${sectionCommand(block.level, block.starred)}{${printInlines(block.title)}}${printLabels(block)}`;
		case 'paragraph':
			return `${printInlines(block.content)}${printLabels(block)}`;
		case 'list':
			return `\\begin{${block.environment}}\n${printListItems(block)}\n\\end{${block.environment}}${printLabels(block)}`;
		case 'quote':
			return `\\begin{${block.environment}}\n${printInlines(block.content)}\n\\end{${block.environment}}${printLabels(block)}`;
		default:
			return source.slice(block.span.from, block.span.to);
	}
}
