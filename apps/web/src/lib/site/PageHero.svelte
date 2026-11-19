<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import type { IconCheck } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";

	let {
		badge,
		title,
		accent,
		lede,
		actions,
		aside,
		class: className
	}: {
		/** Accepted for older call sites; no longer rendered. */
		badge?: string;
		/** Accepted for older call sites; the eyebrow has no glyph. */
		badgeIcon?: typeof IconCheck;
		title: string;
		/** Tail of the title, set in muted ink. */
		accent?: string;
		lede?: string;
		actions?: Snippet;
		aside?: Snippet;
		class?: string;
	} = $props();
</script>

<div
	class={cn(
		'grid grid-cols-1 gap-10 pt-8 pb-4 sm:pt-16 sm:pb-8',
		aside && 'lg:grid-cols-2 lg:items-center',
		className
	)}
>
	<div class="flex flex-col">
		<h1 class="rise display text-4xl text-foreground sm:text-6xl" style:--i={1}>
			{title}{#if accent}{' '}<span class="text-accent-ink">{accent}</span>{/if}
		</h1>
		{#if lede}
			<p
				class="rise mt-5 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg"
				style:--i={2}
			>
				{lede}
			</p>
		{/if}
		{#if actions}
			<div class="rise mt-8 flex flex-wrap items-center gap-2" style:--i={3}>
				{@render actions()}
			</div>
		{/if}
	</div>
	{#if aside}
		<div class="rise min-w-0" style:--i={4}>{@render aside()}</div>
	{/if}
</div>
