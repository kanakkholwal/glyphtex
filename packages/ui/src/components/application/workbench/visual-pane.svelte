<script lang="ts">
	import { settings } from '@glyphtex/ui/settings';
	import type {
		Block,
		BlockTemplate,
		Inline,
		ListBlock,
		Patch,
		TexDoc
	} from '@glyphtex/ui/tex-doc';
	import {
		IconAlertTriangle,
		IconCode,
		IconMathFunction,
		IconPlus,
		IconTrash
	} from '@tabler/icons-svelte';

	import type { WorkbenchController } from './controller.svelte';
	import BlockEditor, { type CaretTarget } from './visual/block-editor.svelte';
	import FloatCard from './visual/float-card.svelte';
	import SlashMenu from './visual/slash-menu.svelte';

	/**
	 * Visual (WYSIWYG) editing surface.
	 *
	 * The LaTeX source stays the single source of truth. Every edit here is a
	 * patch over one block's span, so anything the model does not understand —
	 * TikZ, custom environments, hand-tuned spacing — is never rewritten, and the
	 * two modes stay byte-identical outside the block you touched.
	 */
	let { ctrl }: { ctrl: WorkbenchController } = $props();

	const layout = $derived(ctrl.layout);
	const files = $derived(ctrl.files);

	const bodySize = $derived(settings.docSmallText ? '0.875rem' : '1rem');
	const measure = $derived(settings.docFullWidth ? 'none' : '708px');

	type TexDocModule = typeof import('@glyphtex/ui/tex-doc');
	let tex = $state<TexDocModule>();
	let doc = $state<TexDoc>();
	let parseError = $state<string>();

	// Source this pane produced. Re-parsing it would rebuild the DOM under a live
	// caret for no gain, so the parse effect skips it.
	let selfWritten: string | null = null;

	let focusKey = $state<string | null>(null);
	let focusToken = $state(0);
	let caretAt = $state<CaretTarget>('end');

	/** An empty block being typed into. LaTeX has no representation for one, so it
	 *  lives here until it has content and can be written to the source. */
	let draftAfter = $state<number | null>(null);
	let draftRuns = $state<Inline[]>([]);

	type SlashMode =
		| { kind: 'convert'; index: number }
		| { kind: 'insertAfter'; index: number }
		| { kind: 'draft' };
	let slash = $state<{ rect: DOMRect; mode: SlashMode } | null>(null);

	// The parser is imported lazily: it is 58 KB the LaTeX view never needs, and
	// keeping it out of the SSR graph keeps the Worker inside its size budget.
	$effect(() => {
		void import('@glyphtex/ui/tex-doc')
			.then((module) => (tex = module))
			.catch((error) => (parseError = String(error)));
	});

	// Parsing a long chapter costs ~170ms, far too much per keystroke, so an
	// external change (the LaTeX view, a file switch) is debounced.
	$effect(() => {
		const source = files.source;
		const module = tex;
		if (!module || source === selfWritten) return;
		let cancelled = false;
		const timer = setTimeout(() => {
			if (cancelled) return;
			try {
				doc = module.parseTexDoc(source);
				parseError = undefined;
			} catch (error) {
				parseError = error instanceof Error ? error.message : String(error);
			}
		}, 180);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	});

	// --- Undo -------------------------------------------------------------------
	// Visual edits bypass the LaTeX view's history (they are applied as external
	// updates there), so this pane keeps its own.
	const undoStack: string[] = [];
	const redoStack: string[] = [];
	let coalesceKey = '';
	let coalesceAt = 0;

	function pushUndo(source: string, coalesce?: string) {
		const now = Date.now();
		// Typing into one block is a single undo step, not one per keystroke.
		if (coalesce && coalesce === coalesceKey && now - coalesceAt < 1000) {
			coalesceAt = now;
			return;
		}
		undoStack.push(source);
		if (undoStack.length > 200) undoStack.shift();
		redoStack.length = 0;
		coalesceKey = coalesce ?? '';
		coalesceAt = now;
	}

	function restore(from: string[], to: string[]) {
		const previous = from.pop();
		if (previous === undefined || !tex) return;
		to.push(files.source);
		coalesceKey = '';
		selfWritten = previous;
		files.source = previous;
		doc = tex.parseTexDoc(previous);
	}

	function onPaneKeyDown(event: KeyboardEvent) {
		if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
		const key = event.key.toLowerCase();
		if (key === 'z' && !event.shiftKey) {
			event.preventDefault();
			restore(undoStack, redoStack);
		} else if (key === 'y' || (key === 'z' && event.shiftKey)) {
			event.preventDefault();
			restore(redoStack, undoStack);
		}
	}

	// --- Writing back -----------------------------------------------------------
	function focusOn(key: string | null, caret: CaretTarget = 'end') {
		focusKey = key;
		caretAt = caret;
		focusToken += 1;
	}

	function write(next: string, coalesce?: string) {
		pushUndo(files.source, coalesce);
		selfWritten = next;
		files.source = next;
	}

	/**
	 * Typing inside a block. The source is patched but never re-parsed: the DOM
	 * already shows the result, and re-rendering would move the caret. The spans
	 * after the edit are shifted by hand instead.
	 */
	function commitInline(index: number, patch: Patch) {
		if (!tex || !doc) return false;
		const next = tex.applyPatch(files.source, patch);
		if (next === files.source) return false;

		const delta = tex.patchDelta(patch);
		write(next, `block:${index}`);
		doc.blocks[index].span.to += delta;
		for (let i = index + 1; i < doc.blocks.length; i++) {
			doc.blocks[i].span.from += delta;
			doc.blocks[i].span.to += delta;
		}
		doc.bodySpan.to += delta;
		return true;
	}

	/** A change to the block structure: re-parse, then hand the caret somewhere. */
	function commitStructural(patch: Patch, focus: { key: string | null; caret?: CaretTarget }) {
		if (!tex) return;
		const next = tex.applyPatch(files.source, patch);
		write(next);
		doc = tex.parseTexDoc(next);
		focusOn(focus.key, focus.caret ?? 'end');
	}

	function withInlines(block: Block, runs: Inline[]): Block {
		if (block.kind === 'heading') return { ...block, title: runs };
		if (block.kind === 'paragraph' || block.kind === 'quote') return { ...block, content: runs };
		return block;
	}

	const isBlank = (runs: Inline[]) => !tex || tex.printInlines(runs).trim() === '';

	// --- Prose blocks -----------------------------------------------------------
	function onInlineInput(index: number, next: Inline[]) {
		const block = doc?.blocks[index];
		if (!tex || !block) return;
		const patch = tex.setInlines(files.source, block, next);
		if (!patch || !commitInline(index, patch)) return;
		if (block.kind === 'heading') block.title = next;
		else if (block.kind === 'paragraph' || block.kind === 'quote') block.content = next;
	}

	function openDraft(after: number) {
		draftAfter = after;
		draftRuns = [];
		focusOn('draft');
	}

	function onSplit(index: number, left: Inline[], right: Inline[]) {
		const block = doc?.blocks[index];
		if (!tex || !block) return;

		if (isBlank(right)) {
			onInlineInput(index, left);
			openDraft(index);
			return;
		}
		if (isBlank(left)) {
			// Enter at the very start pushes this block down and opens an empty one
			// above it; the block's own text is untouched.
			openDraft(index - 1);
			return;
		}
		commitStructural(
			{
				...block.span,
				insert: `${tex.printBlock(withInlines(block, left), files.source)}\n\n${tex.printInlines(right)}`
			},
			{ key: `${index + 1}`, caret: 'start' }
		);
	}

	function onMergeBack(index: number, rest: Inline[]) {
		const block = doc?.blocks[index];
		const previous = doc?.blocks[index - 1];
		if (!tex || !block) return;

		if (!previous) {
			// Nothing above to merge into; an empty first block just goes away.
			if (isBlank(rest)) commitStructural(tex.deleteBlock(files.source, block), { key: '0' });
			return;
		}
		if (isBlank(rest)) {
			commitStructural(tex.deleteBlock(files.source, block), {
				key: `${index - 1}`,
				caret: 'end'
			});
			return;
		}
		// Only a paragraph can be folded into the block above it; a heading keeps
		// its own line.
		if (block.kind !== 'paragraph') return;
		const patch = tex.mergeIntoPrevious(files.source, previous, { ...block, content: rest });
		// A figure or a TikZ picture above: refuse rather than mangle it.
		if (!patch) return;
		const seam = tex.printInlines(
			previous.kind === 'heading' ? previous.title : (previous as { content: Inline[] }).content
		).length;
		commitStructural(patch, { key: `${index - 1}`, caret: seam });
	}

	function templateFocusKey(id: string, index: number): string | null {
		if (id === 'itemize' || id === 'enumerate') return `${index}:0`;
		if (['equation', 'align', 'figure', 'table', 'verbatim'].includes(id)) return null;
		return `${index}`;
	}

	function onConvert(index: number, templateId: string, rest: Inline[]) {
		const block = doc?.blocks[index];
		if (!tex || !block) return;
		const template = tex.BLOCK_TEMPLATES.find((t) => t.id === templateId);
		if (!template) return;

		const restText = tex.printInlines(rest);
		const { text, caret } = tex.expandTemplate(template.source);
		const insert =
			templateId === 'paragraph' ? restText : text.slice(0, caret) + restText + text.slice(caret);
		if (!insert.trim()) return;
		commitStructural({ ...block.span, insert }, { key: templateFocusKey(templateId, index) });
	}

	// --- Lists ------------------------------------------------------------------
	function listAt(index: number): ListBlock | null {
		const block = doc?.blocks[index];
		return block?.kind === 'list' ? block : null;
	}

	function onItemInput(index: number, item: number, next: Inline[]) {
		const block = listAt(index);
		if (!tex || !block) return;
		if (commitInline(index, tex.setListItem(files.source, block, item, next))) {
			block.items[item].content = next;
		}
	}

	function onItemSplit(index: number, item: number, left: Inline[], right: Inline[]) {
		const block = listAt(index);
		if (!tex || !block) return;
		const items = block.items.map((entry, i) => (i === item ? { ...entry, content: left } : entry));

		// Enter on the last, empty item leaves the list rather than growing it.
		if (isBlank(left) && isBlank(right) && item === items.length - 1) {
			items.pop();
			commitStructural(
				items.length
					? tex.setListItems(files.source, block, items)
					: tex.deleteBlock(files.source, block),
				{ key: null }
			);
			openDraft(items.length ? index : index - 1);
			return;
		}
		items.splice(item + 1, 0, { content: right });
		commitStructural(tex.setListItems(files.source, block, items), {
			key: `${index}:${item + 1}`,
			caret: 'start'
		});
	}

	function onItemMergeBack(index: number, item: number, rest: Inline[]) {
		const block = listAt(index);
		if (!tex || !block) return;

		if (item === 0) {
			// The first item leaves the list and becomes a paragraph above it.
			const remaining = block.items.slice(1);
			const paragraph = tex.printInlines(rest);
			const tail = remaining.length
				? tex.printBlock({ ...block, items: remaining }, files.source)
				: '';
			const insert = [paragraph, tail].filter(Boolean).join('\n\n');
			if (!insert) {
				commitStructural(tex.deleteBlock(files.source, block), { key: `${index - 1}` });
				return;
			}
			commitStructural(
				{ ...block.span, insert },
				{
					key: paragraph ? `${index}` : `${index}:0`,
					caret: 'end'
				}
			);
			return;
		}

		const items = [...block.items];
		const seam = tex.printInlines(items[item - 1].content).length;
		items[item - 1] = {
			...items[item - 1],
			content: [...items[item - 1].content, ...rest]
		};
		items.splice(item, 1);
		commitStructural(tex.setListItems(files.source, block, items), {
			key: `${index}:${item - 1}`,
			caret: seam
		});
	}

	// --- Draft block ------------------------------------------------------------
	function onDraftInput(next: Inline[]) {
		const after = draftAfter;
		if (!tex || !doc || after === null) return;
		draftRuns = next;
		if (isBlank(next)) return;

		const anchor = doc.blocks[after];
		const patch = anchor
			? tex.insertAfter(anchor, tex.printInlines(next))
			: tex.insertAtStart(doc.bodySpan, tex.printInlines(next));
		draftAfter = null;
		draftRuns = [];
		commitStructural(patch, { key: `${after + 1}`, caret: 'end' });
	}

	function onDraftKeyOut() {
		const after = draftAfter;
		draftAfter = null;
		if (after !== null && after >= 0) focusOn(`${after}`, 'end');
	}

	// --- Insert menu ------------------------------------------------------------
	/** Materialise a template as a new block after `after` (-1 = top of the body). */
	function insertTemplate(id: string, after: number) {
		if (!tex || !doc) return;
		const template = tex.BLOCK_TEMPLATES.find((t) => t.id === id);
		if (!template) return;
		if (id === 'paragraph') {
			openDraft(after);
			return;
		}
		const { text } = tex.expandTemplate(template.source);
		const anchor = doc.blocks[after];
		draftAfter = null;
		commitStructural(
			anchor ? tex.insertAfter(anchor, text) : tex.insertAtStart(doc.bodySpan, text),
			{ key: templateFocusKey(id, after + 1) }
		);
	}

	/** An input rule fired inside the empty draft: become that block instead. */
	function convertDraft(id: string) {
		insertTemplate(id, draftAfter ?? -1);
	}

	function pickTemplate(template: BlockTemplate) {
		const mode = slash?.mode;
		slash = null;
		if (!mode) return;
		if (mode.kind === 'convert') onConvert(mode.index, template.id, []);
		else insertTemplate(template.id, mode.kind === 'draft' ? (draftAfter ?? -1) : mode.index);
	}

	// --- Block chrome -----------------------------------------------------------
	function openInSource(block: Block) {
		layout.revealSpan = block.span;
		layout.docMode = 'latex';
	}

	function removeBlock(index: number) {
		const block = doc?.blocks[index];
		if (!tex || !block) return;
		commitStructural(tex.deleteBlock(files.source, block), {
			key: index > 0 ? `${index - 1}` : null
		});
	}

	function insertAfterBlock(index: number, origin: HTMLElement) {
		slash = { rect: origin.getBoundingClientRect(), mode: { kind: 'insertAfter', index } };
	}

	/** A float card edited one of its own commands. Re-parse: the caption and the
	 *  graphic are read out of the source, not held as block state. */
	function applyFloatPatch(patch: Patch | null) {
		if (patch) commitStructural(patch, { key: null });
	}

	/** Every editable spot in document order, so the arrow keys can walk them. */
	const editableKeys = $derived(
		(doc?.blocks ?? []).flatMap((block, i) =>
			block.kind === 'list'
				? block.items.map((_, j) => `${i}:${j}`)
				: block.kind === 'heading' || block.kind === 'paragraph' || block.kind === 'quote'
					? [`${i}`]
					: []
		)
	);

	function moveFocus(from: string, direction: -1 | 1) {
		const at = editableKeys.indexOf(from);
		const next = editableKeys[at + direction];
		if (at !== -1 && next) focusOn(next, direction === 1 ? 'start' : 'end');
	}

	const tokenFor = (key: string) => (focusKey === key ? focusToken : null);

	const HEADING_CLASS = [
		'text-[2rem] font-bold tracking-[-0.02em] mt-10',
		'text-[1.75rem] font-bold tracking-[-0.018em] mt-10',
		'text-[1.5rem] font-semibold tracking-[-0.015em] mt-9',
		'text-[1.25rem] font-semibold mt-8',
		'text-[1.1rem] font-semibold mt-7',
		'text-[1rem] font-semibold mt-6',
		'text-[0.95rem] font-semibold mt-5'
	];
</script>

{#snippet prose(block: Block, index: number)}
	{@const key = `${index}`}
	{#if block.kind === 'heading'}
		<BlockEditor
			runs={block.title}
			tag={`h${Math.min(6, block.level)}`}
			placeholder="Heading"
			class="text-foreground relative mb-1 leading-tight {HEADING_CLASS[block.level] ??
				HEADING_CLASS[6]}"
			focusToken={tokenFor(key)}
			{caretAt}
			oninput={(next) => onInlineInput(index, next)}
			onsplit={(left, right) => onSplit(index, left, right)}
			onmergeback={(rest) => onMergeBack(index, rest)}
			onconvert={(template, rest) => onConvert(index, template, rest)}
			onslash={(rect) => (slash = { rect, mode: { kind: 'convert', index } })}
			onmove={(direction) => moveFocus(key, direction)}
		/>
	{:else if block.kind === 'paragraph'}
		<BlockEditor
			runs={block.content}
			tag="p"
			placeholder="Write, or press / for blocks"
			class="text-foreground relative mt-4 leading-[1.6]"
			focusToken={tokenFor(key)}
			{caretAt}
			oninput={(next) => onInlineInput(index, next)}
			onsplit={(left, right) => onSplit(index, left, right)}
			onmergeback={(rest) => onMergeBack(index, rest)}
			onconvert={(template, rest) => onConvert(index, template, rest)}
			onslash={(rect) => (slash = { rect, mode: { kind: 'convert', index } })}
			onmove={(direction) => moveFocus(key, direction)}
		/>
	{:else if block.kind === 'quote'}
		<blockquote class="border-border text-muted-foreground mt-4 border-l-2 pl-4">
			<BlockEditor
				runs={block.content}
				tag="p"
				placeholder="Quote"
				class="relative leading-[1.6]"
				focusToken={tokenFor(key)}
				{caretAt}
				oninput={(next) => onInlineInput(index, next)}
				onsplit={(left, right) => onSplit(index, left, right)}
				onmergeback={(rest) => onMergeBack(index, rest)}
				onmove={(direction) => moveFocus(key, direction)}
			/>
		</blockquote>
	{:else if block.kind === 'list'}
		<svelte:element
			this={block.ordered ? 'ol' : 'ul'}
			class="mt-4 space-y-1.5 {block.ordered ? 'list-decimal pl-6' : 'pl-1'}"
		>
			{#each block.items as item, j (j)}
				{@const itemKey = `${index}:${j}`}
				<li class="text-foreground leading-[1.6] {block.ordered ? '' : 'flex gap-2.5'}">
					{#if !block.ordered && !block.description}
						<span class="text-faint mt-[0.7em] size-1.5 shrink-0 rounded-full bg-current"></span>
					{/if}
					<span class="min-w-0 flex-1">
						{#if item.term}<strong class="font-semibold">{item.term}</strong>{' '}{/if}
						<BlockEditor
							runs={item.content}
							tag="span"
							placeholder="List item"
							class="relative block"
							focusToken={tokenFor(itemKey)}
							{caretAt}
							oninput={(next) => onItemInput(index, j, next)}
							onsplit={(left, right) => onItemSplit(index, j, left, right)}
							onmergeback={(rest) => onItemMergeBack(index, j, rest)}
							onmove={(direction) => moveFocus(itemKey, direction)}
						/>
					</span>
				</li>
			{/each}
		</svelte:element>
	{:else if block.kind === 'math'}
		<div class="border-border bg-surface-soft mt-5 rounded-lg border px-4 py-3.5">
			<div class="text-muted-foreground flex items-center gap-2 text-xs font-medium">
				<IconMathFunction size={14} />
				{block.environment ?? 'Display math'}
			</div>
			<pre
				class="text-foreground mt-2 overflow-x-auto text-center text-sm whitespace-pre-wrap">{block.source.trim()}</pre>
		</div>
	{:else if block.kind === 'code'}
		<div class="border-border bg-surface-soft mt-5 overflow-hidden rounded-lg border">
			<div
				class="text-muted-foreground border-border flex items-center gap-2 border-b px-3 py-1.5 text-xs font-medium"
			>
				<IconCode size={14} />
				{block.environment}
			</div>
			<pre class="overflow-x-auto px-3 py-2.5 font-mono text-xs">{block.source.replace(
					/^\n/,
					''
				)}</pre>
		</div>
	{:else if block.kind === 'float'}
		<FloatCard
			{block}
			{ctrl}
			source={files.source}
			onpatch={applyFloatPatch}
			onopensource={() => openInSource(block)}
		/>
	{:else}
		<div class="border-border bg-accent/40 mt-4 rounded-lg border border-dashed px-3 py-2">
			<div class="text-muted-foreground flex items-center gap-2 text-xs">
				<IconAlertTriangle size={13} class="shrink-0" />
				<span class="font-medium">{block.label}</span>
				<span class="text-faint">kept exactly as written</span>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet draftBlock()}
	<BlockEditor
		runs={draftRuns}
		tag="p"
		placeholder="Write, or press / for blocks"
		class="text-foreground relative mt-4 leading-[1.6]"
		focusToken={tokenFor('draft')}
		{caretAt}
		oninput={onDraftInput}
		onmergeback={onDraftKeyOut}
		onconvert={(template) => convertDraft(template)}
		onslash={(rect) => (slash = { rect, mode: { kind: 'draft' } })}
	/>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
	class="bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-auto"
	aria-label="Visual editor"
	role="document"
	onkeydown={onPaneKeyDown}
>
	<div
		class="mx-auto w-full px-6 pt-6 pb-24 sm:px-12 lg:px-16"
		style:max-width={settings.docFullWidth ? 'none' : '900px'}
	>
		{#if parseError}
			<p class="text-destructive text-sm">Could not read this document: {parseError}</p>
		{:else if !doc}
			<p class="text-muted-foreground text-sm">Reading the document…</p>
		{:else}
			{#if doc.preamble.packages.length || doc.preamble.documentClass}
				<!-- The preamble is summarised, never block-edited: macro definitions
				     and package options have no faithful block representation. -->
				<details class="border-border bg-surface-soft mb-6 rounded-lg border px-3.5 py-2.5">
					<summary class="text-muted-foreground cursor-pointer text-xs font-medium">
						Document setup
						{#if doc.preamble.documentClass}<span class="text-faint"
								>· {doc.preamble.documentClass}</span
							>{/if}
					</summary>
					<div class="text-muted-foreground mt-2 space-y-1 text-xs">
						{#if doc.preamble.packages.length}
							<p><span class="text-faint">Packages:</span> {doc.preamble.packages.join(', ')}</p>
						{/if}
						{#if doc.preamble.macros.length}
							<p>
								<span class="text-faint">Defines:</span>
								{doc.preamble.macros.map((m) => `\\${m}`).join(', ')}
							</p>
						{/if}
					</div>
				</details>
			{/if}

			<article
				class="glyphtex-doc mx-auto"
				style:max-width={measure}
				style:font-family={settings.docFontStack}
				style:font-size={bodySize}
			>
				{#if draftAfter === -1}{@render draftBlock()}{/if}

				{#each doc.blocks as block, i (i)}
					<!-- A float card carries its own controls, so it must not sit inside
					     the click-to-open-source wrapper that would swallow them. -->
					{@const editable =
						block.kind === 'heading' ||
						block.kind === 'paragraph' ||
						block.kind === 'quote' ||
						block.kind === 'list' ||
						block.kind === 'float'}
					<div class="group/block relative">
						<!-- Handles sit in the gutter so they never reflow the prose. -->
						<div
							class="absolute -left-11 z-10 flex gap-0.5 pt-1 opacity-0 transition-opacity group-hover/block:opacity-100 focus-within:opacity-100"
						>
							<button
								type="button"
								aria-label="Insert block below"
								class="text-faint hover:text-foreground hover:bg-accent rounded p-1"
								onclick={(e) => insertAfterBlock(i, e.currentTarget)}
							>
								<IconPlus size={15} />
							</button>
							<button
								type="button"
								aria-label="Delete block"
								class="text-faint hover:text-destructive hover:bg-accent rounded p-1"
								onclick={() => removeBlock(i)}
							>
								<IconTrash size={15} />
							</button>
						</div>

						{#if editable}
							{@render prose(block, i)}
						{:else}
							<!-- Not modelled for block editing: open the real source instead of
							     pretending it can be typed into. -->
							<div
								role="button"
								tabindex="0"
								class="hover:ring-border/70 -mx-2 cursor-pointer rounded-md px-2 hover:ring-1"
								onclick={() => openInSource(block)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										openInSource(block);
									}
								}}
							>
								{@render prose(block, i)}
							</div>
						{/if}
					</div>

					{#if draftAfter === i}{@render draftBlock()}{/if}
				{/each}

				{#if doc.blocks.length === 0 && draftAfter === null}
					<button
						type="button"
						class="text-muted-foreground hover:text-foreground mt-4 text-sm"
						onclick={() => openDraft(-1)}
					>
						This document has no body yet — click to start writing.
					</button>
				{/if}
			</article>
		{/if}
	</div>
</section>

{#if slash}
	<SlashMenu anchor={slash.rect} onpick={pickTemplate} onclose={() => (slash = null)} />
{/if}
