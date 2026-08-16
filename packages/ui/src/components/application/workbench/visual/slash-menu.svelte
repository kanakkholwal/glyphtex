<script lang="ts" module>
	export type InsertPick = { type: "block" | "inline"; id: string };
</script>

<script lang="ts">
	import { BLOCK_TEMPLATES, INLINE_TEMPLATES } from '@glyphtex/ui/tex-doc';
	import {
		IconAbc,
		IconAnchor,
		IconBook,
		IconCode,
		IconH1,
		IconH2,
		IconH3,
		IconLetterP,
		IconLink,
		IconList,
		IconListNumbers,
		IconListDetails,
		IconMath,
		IconMathFunction,
		IconMathSymbols,
		IconNote,
		IconPhoto,
		IconQuote,
		IconQuoteFilled,
		IconSum,
		IconTable,
		IconTypography
	} from '@tabler/icons-svelte';

	/** Insert menu. It owns the filter input rather than reading the block, so no
	 *  half-typed command can reach the source. */
	let {
		anchor,
		allowInline = false,
		inlineFirst = false,
		onpick,
		onclose
	}: {
		anchor: DOMRect;
		/** False when the menu was opened from the gutter: there is no caret to put
		 *  an atom at, so offering one would be a dead entry. */
		allowInline?: boolean;
		/** The caret is inside prose, so inline things are the likelier intent. */
		inlineFirst?: boolean;
		onpick: (pick: InsertPick) => void;
		onclose: () => void;
	} = $props();

	const ICONS: Record<string, typeof IconTypography> = {
		paragraph: IconTypography,
		sample: IconAbc,
		part: IconBook,
		chapter: IconBook,
		section: IconH1,
		subsection: IconH2,
		subsubsection: IconH3,
		'paragraph-heading': IconLetterP,
		subparagraph: IconLetterP,
		itemize: IconList,
		enumerate: IconListNumbers,
		description: IconListDetails,
		equation: IconMathFunction,
		displaymath: IconMathFunction,
		align: IconSum,
		matrix: IconMathSymbols,
		cases: IconMathSymbols,
		figure: IconPhoto,
		table: IconTable,
		quote: IconQuote,
		verbatim: IconCode,
		math: IconMath,
		cite: IconQuoteFilled,
		ref: IconLink,
		label: IconAnchor,
		footnote: IconNote,
		link: IconLink
	};

	const GROUP_LABEL: Record<string, string> = {
		inline: 'Inline',
		text: 'Text',
		headings: 'Headings',
		lists: 'Lists',
		math: 'Maths',
		insert: 'Insert'
	};

	type Entry = {
		type: 'block' | 'inline';
		id: string;
		label: string;
		keywords: string;
		group: string;
	};

	const ALL = $derived<Entry[]>([
		...(allowInline ? INLINE_TEMPLATES : []).map((t) => ({
			type: 'inline' as const,
			id: t.id,
			label: t.label,
			keywords: t.keywords,
			group: 'inline'
		})),
		...BLOCK_TEMPLATES.map((t) => ({
			type: 'block' as const,
			id: t.id,
			label: t.label,
			keywords: t.keywords,
			group: t.group
		}))
	]);

	const ORDER = $derived(
		inlineFirst
			? ['inline', 'text', 'headings', 'lists', 'math', 'insert']
			: ['text', 'headings', 'lists', 'math', 'insert', 'inline']
	);

	let query = $state('');
	let active = $state(0);
	let input = $state<HTMLInputElement>();
	let list = $state<HTMLElement>();

	const matches = $derived(
		ALL.filter((entry) => {
			const q = query.trim().toLowerCase();
			return !q || `${entry.label} ${entry.keywords}`.toLowerCase().includes(q);
		}).sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group))
	);

	$effect(() => {
		input?.focus();
	});

	// Clamp as the list shrinks under the filter.
	$effect(() => {
		if (active >= matches.length) active = Math.max(0, matches.length - 1);
	});

	// Arrow keys can walk past the visible window; the list is twenty entries long.
	$effect(() => {
		const index = active;
		list?.querySelectorAll('[role="option"]')[index]?.scrollIntoView({ block: 'nearest' });
	});

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onclose();
			return;
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;
			active = (active + step + matches.length) % matches.length;
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			const pick = matches[active];
			if (pick) onpick({ type: pick.type, id: pick.id });
		}
	}

	// Below the block when there is room, above it when there is not.
	const MENU_H = 340;
	const top = $derived(
		anchor.bottom + MENU_H > window.innerHeight ? anchor.top - MENU_H - 6 : anchor.bottom + 6
	);
</script>

<svelte:window onresize={onclose} />

<!-- Clicking anywhere else dismisses; the overlay is transparent so the document
     underneath stays legible while the menu is open. -->
<div
	class="fixed inset-0 z-40"
	role="presentation"
	onpointerdown={onclose}
	oncontextmenu={onclose}
></div>

<div
	class="border-border bg-popover fixed z-50 w-72 overflow-hidden rounded-lg border shadow-lg"
	style:left="{Math.min(anchor.left, window.innerWidth - 300)}px"
	style:top="{Math.max(8, top)}px"
	role="dialog"
	aria-label="Insert block"
>
	<input
		bind:this={input}
		bind:value={query}
		onkeydown={onKeyDown}
		placeholder="Filter blocks…"
		aria-label="Filter blocks"
		class="border-border text-foreground placeholder:text-faint w-full border-b bg-transparent px-3 py-2 text-sm outline-none"
	/>
	<div
		bind:this={list}
		class="max-h-72 overflow-y-auto py-1"
		role="listbox"
		aria-label="Block types"
	>
		{#each matches as entry, i (entry.type + entry.id)}
			{@const Icon = ICONS[entry.id] ?? IconTypography}
			{#if i === 0 || matches[i - 1].group !== entry.group}
				<p class="text-faint px-3 pt-2 pb-1 text-[0.6875rem] font-medium tracking-wide uppercase">
					{GROUP_LABEL[entry.group] ?? entry.group}
				</p>
			{/if}
			<button
				type="button"
				role="option"
				aria-selected={i === active}
				class="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm {i === active
					? 'bg-accent text-foreground'
					: 'text-muted-foreground'}"
				onpointerenter={() => (active = i)}
				onpointerdown={(e) => e.preventDefault()}
				onclick={() => onpick({ type: entry.type, id: entry.id })}
			>
				<Icon size={16} class="shrink-0" />
				{entry.label}
			</button>
		{:else}
			<p class="text-muted-foreground px-3 py-2 text-sm">No block matches “{query}”.</p>
		{/each}
	</div>
</div>
