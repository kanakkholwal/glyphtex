<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import type { IconCheck } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";
	import TiltedChip from "./TiltedChip.svelte";

	let {
		badge,
		badgeIcon,
		title,
		accent,
		lede,
		actions,
		aside,
		class: className
	}: {
		badge?: string;
		/** Chip glyph; defaults to a check. */
		badgeIcon?: typeof IconCheck;
		title: string;
		/** Second line of the title, set in the brand colour. */
		accent?: string;
		lede?: string;
		actions?: Snippet;
		aside?: Snippet;
		class?: string;
	} = $props();
</script>

<div
	class={cn(
		'grid grid-cols-1 gap-10 px-1 pt-28 pb-6 sm:px-4 sm:pt-32 sm:pb-10 lg:px-16',
		aside && 'lg:grid-cols-2 lg:items-center',
		className
	)}
>
	<div class="flex flex-col">
		{#if badge}
			<TiltedChip class="mb-4" icon={badgeIcon}>{badge}</TiltedChip>
		{/if}
		<h1 class="text-balance text-heading-lg font-medium text-foreground md:text-display">
			{title}
			{#if accent}
				<br />
				<span class="text-primary">{accent}</span>
			{/if}
		</h1>
		{#if lede}
			<p class="mt-4 max-w-xl text-pretty text-body text-muted-foreground md:text-body-lg">{lede}</p>
		{/if}
		{#if actions}
			<div class="mt-8 flex flex-wrap items-center gap-2 sm:gap-4">{@render actions()}</div>
		{/if}
	</div>
	{#if aside}
		<div class="min-w-0">{@render aside()}</div>
	{/if}
</div>
