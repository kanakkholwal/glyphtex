<script lang="ts">
	import { BLOCK_TEMPLATES, type BlockTemplate } from '@glyphtex/ui/tex-doc';
	import {
		IconCode,
		IconH1,
		IconH2,
		IconH3,
		IconList,
		IconListNumbers,
		IconMathFunction,
		IconPhoto,
		IconQuote,
		IconSum,
		IconTable,
		IconTypography
	} from '@tabler/icons-svelte';

	/**
	 * Insert menu, opened by `/` in an empty block or by the `+` handle. It owns
	 * the filter input rather than reading the block's text, so the block never
	 * has to hold a half-typed command that could reach the source.
	 */
	let {
		anchor,
		onpick,
		onclose
	}: {
		anchor: DOMRect;
		onpick: (template: BlockTemplate) => void;
		onclose: () => void;
	} = $props();

	const ICONS: Record<string, typeof IconTypography> = {
		paragraph: IconTypography,
		section: IconH1,
		subsection: IconH2,
		subsubsection: IconH3,
		itemize: IconList,
		enumerate: IconListNumbers,
		equation: IconMathFunction,
		align: IconSum,
		figure: IconPhoto,
		table: IconTable,
		quote: IconQuote,
		verbatim: IconCode
	};

	let query = $state('');
	let active = $state(0);
	let input = $state<HTMLInputElement>();

	const matches = $derived(
		BLOCK_TEMPLATES.filter((t) => {
			const q = query.trim().toLowerCase();
			return !q || `${t.label} ${t.keywords}`.toLowerCase().includes(q);
		})
	);

	$effect(() => {
		input?.focus();
	});

	// Clamp as the list shrinks under the filter.
	$effect(() => {
		if (active >= matches.length) active = Math.max(0, matches.length - 1);
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
			if (pick) onpick(pick);
		}
	}

	// Below the block when there is room, above it when there is not.
	const MENU_H = 320;
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
	<div class="max-h-64 overflow-y-auto py-1" role="listbox" aria-label="Block types">
		{#each matches as template, i (template.id)}
			{@const Icon = ICONS[template.id] ?? IconTypography}
			<button
				type="button"
				role="option"
				aria-selected={i === active}
				class="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm {i === active
					? 'bg-accent text-foreground'
					: 'text-muted-foreground'}"
				onpointerenter={() => (active = i)}
				onpointerdown={(e) => e.preventDefault()}
				onclick={() => onpick(template)}
			>
				<Icon size={16} class="shrink-0" />
				{template.label}
			</button>
		{:else}
			<p class="text-muted-foreground px-3 py-2 text-sm">No block matches “{query}”.</p>
		{/each}
	</div>
</div>
