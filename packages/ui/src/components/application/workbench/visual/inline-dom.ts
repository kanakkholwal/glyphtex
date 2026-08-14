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
	code: 'code'
};

const MARK_CLASS: Record<MarkKind, string> = {
	bold: 'font-semibold',
	italic: 'italic',
	emph: 'italic',
	code: 'bg-muted rounded px-1 py-0.5 text-[0.85em]'
};

const ATOM_CLASS: Record<string, string> = {
	math: 'text-brand bg-brand-subtle/40 rounded px-1 py-0.5 text-[0.85em] font-mono',
	cite: 'text-brand',
	ref: 'text-brand',
	label: 'text-faint text-[0.75em]',
	raw: 'text-muted-foreground bg-accent rounded px-1 py-0.5 text-[0.8em] font-mono'
};

function esc(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function atom(kind: string, src: string, command: string, shown: string, title: string): string {
	return (
		`<span class="glyphtex-atom ${ATOM_CLASS[kind] ?? ''}" contenteditable="false"` +
		` data-atom="${kind}" data-src="${esc(src)}" data-cmd="${esc(command)}"` +
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
				out += `<${tag} class="${MARK_CLASS[run.mark]}" data-cmd="${esc(run.command)}">${inlinesToHtml(run.content)}</${tag}>`;
				break;
			}
			case 'math':
				out += atom('math', run.source, '', run.source, `Math: $${run.source}$`);
				break;
			case 'cite':
				out += atom(
					'cite',
					run.keys.join(', '),
					run.command,
					`[${run.keys.join(', ')}]`,
					`\\${run.command}{${run.keys.join(', ')}}`
				);
				break;
			case 'ref':
				out += atom('ref', run.target, run.command, run.target, `\\${run.command}{${run.target}}`);
				break;
			case 'label':
				out += atom('label', run.name, 'label', `#${run.name}`, `Anchor: ${run.name}`);
				break;
			case 'raw':
				out += atom('raw', run.source, '', run.source, 'Not modelled: edit in the LaTeX view');
				break;
		}
	}
	// An empty editable collapses to zero height and cannot be clicked into.
	return out || '<br>';
}

function markOf(el: Element): MarkKind | null {
	const tag = el.tagName.toLowerCase();
	if (tag === 'strong' || tag === 'b') return 'bold';
	if (tag === 'code' || tag === 'tt' || tag === 'kbd') return 'code';
	if (tag === 'em' || tag === 'i' || tag === 'u') return 'italic';
	// execCommand can style instead of wrapping, depending on the browser.
	const weight = (el as HTMLElement).style?.fontWeight;
	if (weight === 'bold' || Number(weight) >= 600) return 'bold';
	if ((el as HTMLElement).style?.fontStyle === 'italic') return 'italic';
	return null;
}

const DEFAULT_COMMAND: Record<MarkKind, string> = {
	bold: 'textbf',
	italic: 'textit',
	emph: 'emph',
	code: 'texttt'
};

function atomRun(el: Element): Inline {
	const src = el.getAttribute('data-src') ?? '';
	const command = el.getAttribute('data-cmd') || '';
	switch (el.getAttribute('data-atom')) {
		case 'math':
			return { kind: 'math', source: src };
		case 'cite':
			return {
				kind: 'cite',
				command: command || 'cite',
				keys: src
					.split(',')
					.map((k) => k.trim())
					.filter(Boolean)
			};
		case 'ref':
			return { kind: 'ref', command: command || 'ref', target: src };
		case 'label':
			return { kind: 'label', name: src };
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
