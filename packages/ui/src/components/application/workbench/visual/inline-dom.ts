import type { Inline, MarkKind } from '@glyphtex/ui/tex-doc';

/**
 * The bridge between inline runs and a `contenteditable`.
 *
 * Runs the model does not let you type into (math, citations, refs, labels,
 * unmodelled macros) render as `contenteditable="false"` atoms carrying their
 * source in `data-src`. The browser then treats each as a single character: it
 * can be selected and deleted whole, but never half-edited into invalid LaTeX.
 */

/** Stands in for an atom in the plain-text projection: invisible, width-zero,
 *  and never matched by an input rule. */
const ATOM_CHAR = String.fromCharCode(0x2063);

const MARK_TAG: Record<MarkKind, string> = {
	bold: 'strong',
	italic: 'em',
	emph: 'em',
	code: 'code',
	smallcaps: 'span',
	underline: 'u',
	strike: 's',
	sans: 'span',
	superscript: 'sup',
	subscript: 'sub'
};

const MARK_CLASS: Record<MarkKind, string> = {
	bold: 'font-semibold',
	italic: 'italic',
	emph: 'italic',
	code: 'bg-muted rounded px-1 py-0.5 text-[0.85em]',
	smallcaps: 'uppercase text-[0.85em] tracking-[0.03em]',
	underline: 'underline underline-offset-2',
	strike: 'line-through',
	sans: 'font-sans',
	superscript: '',
	subscript: ''
};

const ATOM_CLASS: Record<string, string> = {
	math: 'text-brand bg-brand-subtle/40 rounded px-1 py-0.5 text-[0.85em] font-mono',
	cite: 'text-brand',
	ref: 'text-brand',
	label: 'text-faint text-[0.75em]',
	link: 'text-brand underline underline-offset-2',
	footnote: 'text-brand align-super text-[0.7em]',
	comment: 'text-faint bg-accent/60 rounded px-1 text-[0.8em] font-mono',
	raw: 'text-muted-foreground bg-accent rounded px-1 py-0.5 text-[0.8em] font-mono'
};

function esc(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function atom(
	kind: string,
	src: string,
	command: string,
	shown: string,
	title: string,
	extra = ''
): string {
	return (
		`<span class="glyphtex-atom ${ATOM_CLASS[kind] ?? ''}" contenteditable="false"` +
		` data-atom="${kind}" data-src="${esc(src)}" data-cmd="${esc(command)}"${extra}` +
		` title="${esc(title)}">${esc(shown)}</span>`
	);
}

export function inlinesToHtml(runs: Inline[]): string {
	let out = '';
	for (const run of runs) {
		switch (run.kind) {
			case 'text':
				out += esc(run.text);
				break;
			case 'mark': {
				const tag = MARK_TAG[run.mark];
				out +=
					`<${tag} class="${MARK_CLASS[run.mark]}" data-mark="${run.mark}"` +
					` data-cmd="${esc(run.command)}">${inlinesToHtml(run.content)}</${tag}>`;
				break;
			}
			case 'math':
				out += atom(
					'math',
					run.source,
					run.paren ? 'paren' : '',
					run.source,
					`Math: ${run.paren ? `\\(${run.source}\\)` : `$${run.source}$`}`
				);
				break;
			case 'cite': {
				const keys = run.raw ?? run.keys.join(', ');
				out += atom(
					'cite',
					keys,
					run.command,
					`[${run.keys.join(', ')}]`,
					`\\${run.command}{${keys}}`
				);
				break;
			}
			case 'ref':
				out += atom('ref', run.target, run.command, run.target, `\\${run.command}{${run.target}}`);
				break;
			case 'label':
				out += atom('label', run.name, 'label', `#${run.name}`, `Anchor: ${run.name}`);
				break;
			case 'link':
				out += atom(
					'link',
					run.text,
					run.command,
					run.text || run.url,
					run.url,
					` data-url="${esc(run.url)}"`
				);
				break;
			case 'footnote':
				// A dagger, not a number: the number depends on the whole document, and
				// showing a wrong one is worse than showing none.
				out += atom('footnote', run.source, 'footnote', '†', `Footnote: ${run.source}`);
				break;
			case 'comment':
				out += atom(
					'comment',
					run.text,
					'',
					`%${run.text}`,
					'Comment: kept in the source, never printed',
					run.sameline ? ' data-sameline="1"' : ''
				);
				break;
			case 'raw':
				out += atom('raw', run.source, '', run.source, 'Not modelled: edit in the LaTeX view');
				break;
		}
	}
	// An empty editable collapses to zero height and cannot be clicked into.
	return out || '<br>';
}

const TAG_MARK: Record<string, MarkKind> = {
	strong: 'bold',
	b: 'bold',
	code: 'code',
	tt: 'code',
	kbd: 'code',
	em: 'italic',
	i: 'italic',
	u: 'underline',
	ins: 'underline',
	s: 'strike',
	strike: 'strike',
	del: 'strike',
	sup: 'superscript',
	sub: 'subscript'
};

function markOf(el: Element): MarkKind | null {
	// What we rendered wins over the tag: `\textsc` and `\textsf` share a `span`,
	// and only the attribute tells them apart.
	const declared = el.getAttribute('data-mark') as MarkKind | null;
	if (declared && declared in MARK_TAG) return declared;
	const byTag = TAG_MARK[el.tagName.toLowerCase()];
	if (byTag) return byTag;
	// execCommand can style instead of wrapping, depending on the browser.
	const style = (el as HTMLElement).style;
	if (style?.fontWeight === 'bold' || Number(style?.fontWeight) >= 600) return 'bold';
	if (style?.fontStyle === 'italic') return 'italic';
	if (style?.textDecorationLine === 'underline') return 'underline';
	if (style?.textDecorationLine === 'line-through') return 'strike';
	return null;
}

const DEFAULT_COMMAND: Record<MarkKind, string> = {
	bold: 'textbf',
	italic: 'textit',
	emph: 'emph',
	code: 'texttt',
	smallcaps: 'textsc',
	underline: 'underline',
	// Needs the ulem package, same as the LaTeX toolbar's Strikethrough.
	strike: 'sout',
	sans: 'textsf',
	superscript: 'textsuperscript',
	subscript: 'textsubscript'
};

function atomRun(el: Element): Inline {
	const src = el.getAttribute('data-src') ?? '';
	const command = el.getAttribute('data-cmd') || '';
	switch (el.getAttribute('data-atom')) {
		case 'math':
			return { kind: 'math', source: src, paren: command === 'paren' };
		case 'cite':
			return {
				kind: 'cite',
				command: command || 'cite',
				raw: src,
				keys: src
					.split(',')
					.map((k) => k.trim())
					.filter(Boolean)
			};
		case 'ref':
			return { kind: 'ref', command: command || 'ref', target: src };
		case 'label':
			return { kind: 'label', name: src };
		case 'link': {
			const url = el.getAttribute('data-url') ?? src;
			return command === 'url'
				? { kind: 'link', command: 'url', url, text: url }
				: { kind: 'link', command: 'href', url, text: src };
		}
		case 'footnote':
			return { kind: 'footnote', source: src };
		case 'comment':
			return {
				kind: 'comment',
				text: src,
				sameline: el.getAttribute('data-sameline') === '1'
			};
		default:
			return { kind: 'raw', source: src };
	}
}

/** Read a `contenteditable` subtree back into inline runs. */
export function domToInlines(root: Node): Inline[] {
	const out: Inline[] = [];

	const pushText = (text: string) => {
		if (!text) return;
		const last = out[out.length - 1];
		if (last?.kind === 'text') last.text += text;
		else out.push({ kind: 'text', text });
	};

	for (const node of Array.from(root.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			// contenteditable pads with non-breaking spaces and can hold stray
			// newlines; both are one plain space to LaTeX. Replaced one-for-one so
			// the caret offset keeps matching the text we serialize.
			pushText((node.nodeValue ?? '').replace(/\s/g, ' '));
			continue;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) continue;

		const el = node as Element;
		if (el.tagName === 'BR') {
			pushText(' ');
			continue;
		}
		if (el.hasAttribute('data-atom')) {
			out.push(atomRun(el));
			continue;
		}

		const mark = markOf(el);
		const content = domToInlines(el);
		if (!mark) {
			// A wrapper the browser invented (div/span from a paste): keep the text.
			out.push(...content);
			continue;
		}
		if (content.length) {
			out.push({
				kind: 'mark',
				mark,
				command: el.getAttribute('data-cmd') || DEFAULT_COMMAND[mark],
				content
			});
		}
	}

	return out.filter((run) => run.kind !== 'text' || run.text !== '');
}

/**
 * Drop the first `count` characters of a run list, the markdown prefix an input
 * rule just consumed. Computed on the model rather than by splitting the DOM at
 * the caret: the caret's range can be anchored on the element rather than the
 * text node, and the split then hands back the whole block instead of nothing.
 */
export function dropLeading(runs: Inline[], count: number): Inline[] {
	let remaining = count;
	const out: Inline[] = [];
	for (const run of runs) {
		if (remaining <= 0) {
			out.push(run);
			continue;
		}
		if (run.kind === 'text') {
			if (run.text.length <= remaining) {
				remaining -= run.text.length;
				continue;
			}
			out.push({ kind: 'text', text: run.text.slice(remaining) });
			remaining = 0;
			continue;
		}
		// Anything else is one opaque unit, matching `inlinesToText`.
		remaining -= 1;
	}
	return out;
}

/** Plain text of a run list, for prefix matching in input rules. */
export function inlinesToText(runs: Inline[]): string {
	return runs
		.map((run) => {
			if (run.kind === 'text') return run.text;
			if (run.kind === 'mark') return inlinesToText(run.content);
			return ATOM_CHAR;
		})
		.join('');
}
