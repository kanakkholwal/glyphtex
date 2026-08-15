<script lang="ts" module>
	/** Markdown-ish prefixes that convert a block as you type, Notion-style. */
	const INPUT_RULES: { pattern: RegExp; template: string }[] = [
		{ pattern: /^#\s$/, template: 'section' },
		{ pattern: /^##\s$/, template: 'subsection' },
		{ pattern: /^###\s$/, template: 'subsubsection' },
		{ pattern: /^[-*+]\s$/, template: 'itemize' },
		{ pattern: /^1[.)]\s$/, template: 'enumerate' },
		{ pattern: /^>\s$/, template: 'quote' },
		{ pattern: /^```$/, template: 'verbatim' },
		{ pattern: /^\$\$$/, template: 'equation' }
	];

	/** Where a freshly focused block should put its caret: either end, or a
	 *  character offset. A merge has to land the caret on the seam. */
	export type CaretTarget = 'start' | 'end' | number;

	export function placeCaret(el: HTMLElement, where: CaretTarget): void {
		const range = document.createRange();
		range.selectNodeContents(el);
		if (typeof where === 'number') {
			let remaining = where;
			const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
			let node = walker.nextNode();
			while (node) {
				const length = node.nodeValue?.length ?? 0;
				if (remaining <= length) {
					range.setStart(node, remaining);
					break;
				}
				remaining -= length;
				node = walker.nextNode();
			}
			range.collapse(true);
		} else {
			range.collapse(where === 'start');
		}
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	import type { Inline } from '@glyphtex/ui/tex-doc';

	import { domToInlines, dropLeading, inlinesToHtml, inlinesToText } from './inline-dom';

	/** One editable run of inline content. The DOM is authoritative while focused:
	 *  `runs` is only projected back in when the caret is elsewhere. */
	let {
		runs,
		tag = 'div',
		class: className = '',
		placeholder = '',
		focusToken = null,
		caretAt = 'end' as CaretTarget,
		oninput,
		onsplit,
		onmergeback,
		onconvert,
		onslash,
		onmove,
		onfocus,
		onatom,
		onpasteblocks,
		label = 'Text block'
	}: {
		runs: Inline[];
		tag?: string;
		class?: string;
		placeholder?: string;
		/** Announced to screen readers, which otherwise hear "text box" per block. */
		label?: string;
		/** Bumped by the parent to take the caret. A nonce, not a boolean: the same
		 *  block can be re-focused twice in a row and both must land. */
		focusToken?: number | null;
		caretAt?: CaretTarget;
		oninput: (next: Inline[]) => void;
		onsplit?: (left: Inline[], right: Inline[]) => void;
		/** Backspace at the very start, with nothing selected. */
		onmergeback?: (rest: Inline[]) => void;
		/** An input rule fired: become this block template, keeping `rest`. */
		onconvert?: (template: string, rest: Inline[]) => void;
		/** `/` typed at a word boundary: the parent opens the insert menu. `empty`
		 *  decides whether a picked block replaces this one or is inserted after it. */
		onslash?: (anchor: DOMRect, empty: boolean) => void;
		onmove?: (direction: -1 | 1) => void;
		onfocus?: () => void;
		/** An atom was clicked: math, a citation, a ref, an unmodelled macro. */
		onatom?: (el: HTMLElement) => void;
		/** Several paragraphs were pasted at once. */
		onpasteblocks?: (paragraphs: string[]) => void;
	} = $props();

	let el = $state<HTMLElement>();
	let focused = $state(false);
	/** Blocks the blur write after a structural report, which would otherwise push
	 *  stale text into the block that replaced us. */
	let handedOff = false;

	const html = $derived(inlinesToHtml(runs));

	// Project the model in only when the caret is not here. `focused` is read so
	// the effect re-runs on blur and picks up whatever the parent settled on.
	$effect(() => {
		const node = el;
		const next = html;
		if (!node || focused) return;
		if (node.innerHTML !== next) node.innerHTML = next;
	});

	$effect(() => {
		const token = focusToken;
		const node = el;
		if (token == null || !node) return;
		node.focus();
		placeCaret(
			node,
			untrack(() => caretAt)
		);
	});

	const isEmpty = $derived(inlinesToText(runs).trim() === '');

	function read(): Inline[] {
		return el ? domToInlines(el) : [];
	}

	/** Text between the start of the block and the caret. */
	function textBeforeCaret(): string | null {
		const selection = window.getSelection();
		if (!el || !selection || !selection.isCollapsed || !selection.anchorNode) return null;
		if (!el.contains(selection.anchorNode)) return null;
		const range = document.createRange();
		range.selectNodeContents(el);
		range.setEnd(selection.anchorNode, selection.anchorOffset);
		return range.toString();
	}

	function atStart(): boolean {
		return textBeforeCaret() === '';
	}

	/** Where the caret is on screen, for anchoring a menu. A collapsed range has a
	 *  zero-size rect in some browsers, so fall back to the block. */
	function caretRect(): DOMRect {
		const selection = window.getSelection();
		const rect =
			selection && selection.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
		return rect && (rect.width || rect.height) ? rect : el!.getBoundingClientRect();
	}

	function atEnd(): boolean {
		const before = textBeforeCaret();
		return before !== null && before.length === (el?.textContent?.length ?? 0);
	}

	/** Cut the block at the caret, returning the runs on each side. */
	function splitAtCaret(): [Inline[], Inline[]] | null {
		const selection = window.getSelection();
		if (!el || !selection || selection.rangeCount === 0) return null;
		const caret = selection.getRangeAt(0);
		const tail = caret.cloneRange();
		tail.selectNodeContents(el);
		tail.setStart(caret.endContainer, caret.endOffset);
		// extractContents mutates the DOM; the parent re-renders both halves from
		// the runs we return, so the torn state is never painted.
		const right = domToInlines(tail.extractContents());
		return [read(), right];
	}

	/** True when the whole selection lives inside this block. */
	function selectionIsLocal(): boolean {
		const selection = window.getSelection();
		if (!el || !selection || selection.rangeCount === 0) return false;
		const range = selection.getRangeAt(0);
		return el.contains(range.startContainer) && el.contains(range.endContainer);
	}

	function onBeforeInput(event: InputEvent) {
		// Blocks are separate editables, so a selection dragged across two of them
		// belongs to neither. Letting the browser apply the edit rewrites one block
		// from another block's DOM and silently drops the source in between.
		if (!selectionIsLocal()) {
			event.preventDefault();
			window.getSelection()?.collapseToStart();
			return;
		}

		// Input rules fire on the space (or the final backtick) that completes them.
		if (event.inputType !== 'insertText' || !onconvert) return;
		const typed = event.data ?? '';
		const prefix = (textBeforeCaret() ?? '') + typed;
		if (prefix.length > 4) return;
		const rule = INPUT_RULES.find((r) => r.pattern.test(prefix));
		if (!rule) return;
		event.preventDefault();
		handedOff = true;
		// Everything after the prefix survives the conversion.
		onconvert(rule.template, dropLeading(read(), prefix.length - typed.length));
	}

	function onKeyDown(event: KeyboardEvent) {
		const meta = event.ctrlKey || event.metaKey;

		if (meta && !event.altKey) {
			const key = event.key.toLowerCase();
			// execCommand is deprecated but is still the only cross-browser way to
			// toggle a mark over an arbitrary selection inside contenteditable.
			if (key === 'b' || key === 'i') {
				event.preventDefault();
				document.execCommand('styleWithCSS', false, 'false');
				document.execCommand(key === 'b' ? 'bold' : 'italic');
				oninput(read());
				return;
			}
			// Select All would otherwise take the whole page, since every block is
			// its own editable and the browser walks up to the document.
			if (key === 'a' && el) {
				event.preventDefault();
				const range = document.createRange();
				range.selectNodeContents(el);
				const selection = window.getSelection();
				selection?.removeAllRanges();
				selection?.addRange(range);
				return;
			}
		}

		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (!onsplit) return;
			const halves = splitAtCaret();
			if (!halves) return;
			handedOff = true;
			onsplit(halves[0], halves[1]);
			return;
		}

		if (event.key === 'Backspace' && atStart() && window.getSelection()?.isCollapsed) {
			if (!onmergeback) return;
			event.preventDefault();
			handedOff = true;
			onmergeback(read());
			return;
		}

		// A bare `/` only at a word boundary: firing on every one would eat the slash
		// in "and/or" or in a path. Ctrl+/ is the way in from anywhere else, since
		// a footnote often belongs tight against the word before it.
		if (event.key === '/' && onslash) {
			const boundary = isEmpty || /(^|[\s.,;:!?)\]}])$/.test(textBeforeCaret() ?? 'x');
			if (meta || boundary) {
				event.preventDefault();
				onslash(caretRect(), isEmpty);
				return;
			}
		}

		if ((event.key === 'ArrowUp' && atStart()) || (event.key === 'ArrowDown' && atEnd())) {
			if (!onmove) return;
			event.preventDefault();
			onmove(event.key === 'ArrowUp' ? -1 : 1);
		}
	}

	// Paste as plain text: pasted markup would arrive as tags this model cannot
	// name, and would be silently dropped on the next serialize.
	function onPaste(event: ClipboardEvent) {
		event.preventDefault();
		const text = event.clipboardData?.getData('text/plain') ?? '';
		if (!text) return;

		// A blank line is a paragraph break in LaTeX as much as in the clipboard, so
		// pasting several paragraphs must produce several blocks, not one long line.
		const paragraphs = text.split(/\r?\n[ \t]*\r?\n/).map((p) => p.replace(/\r?\n/g, ' ').trim());
		if (paragraphs.length > 1 && onpasteblocks) {
			handedOff = true;
			onpasteblocks(paragraphs.filter(Boolean));
			return;
		}
		document.execCommand('insertText', false, paragraphs.join(' '));
		oninput(read());
	}

	/** Clicking an atom opens its own editor: its source is not typeable inline. */
	function onClick(event: MouseEvent) {
		const atom = (event.target as Element | null)?.closest?.('[data-atom]');
		if (atom && onatom) {
			event.preventDefault();
			onatom(atom as HTMLElement);
		}
	}
</script>

<svelte:element
	this={tag}
	bind:this={el}
	contenteditable="true"
	role="textbox"
	tabindex="0"
	aria-multiline="false"
	aria-label={label}
	data-block-editor
	data-empty={isEmpty || undefined}
	data-placeholder={placeholder}
	class="outline-none {className}"
	oninput={() => oninput(read())}
	onbeforeinput={onBeforeInput}
	onkeydown={onKeyDown}
	onpaste={onPaste}
	onclick={onClick}
	onfocusin={() => {
		focused = true;
		handedOff = false;
		onfocus?.();
	}}
	onfocusout={() => {
		// Settle the model before releasing the DOM: dropping `focused` first would
		// let the projection effect run against runs one keystroke out of date.
		if (!handedOff) oninput(read());
		focused = false;
	}}
></svelte:element>

<style>
	[data-block-editor][data-empty]::before {
		content: attr(data-placeholder);
		color: var(--color-faint);
		pointer-events: none;
		position: absolute;
	}
	/* An atom is one unit to the caret, so it should read as one to the pointer. */
	[data-block-editor] :global([data-atom]) {
		cursor: pointer;
		user-select: none;
	}
	[data-block-editor] :global([data-atom]:hover) {
		outline: 1px solid var(--color-border);
		outline-offset: 1px;
	}
</style>
