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
		/** Mono eyebrow above the title. */
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
		'grid grid-cols-1 gap-10 pt-4 pb-2 sm:pt-8 sm:pb-4',
		aside && 'lg:grid-cols-2 lg:items-center',
		className
	)}
>
	<div class="flex flex-col">
		{#if badge}
			<p class="rise mb-4 font-mono text-xs text-muted-foreground">{badge}</p>
		{/if}
		<h1 class="rise pixel text-4xl text-balance text-foreground sm:text-5xl" style:--i={1}>
			{title}{#if accent}{' '}<span class="text-muted-foreground">{accent}</span>{/if}
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
