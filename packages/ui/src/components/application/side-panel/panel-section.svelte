<script lang="ts">
	import { IconChevronRight } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";
	import { cubicOut } from "svelte/easing";
	import { slide } from "svelte/transition";

	/** Collapsible section inside the side panel (Outline, Recent, …). */
	let {
		title,
		open = $bindable(true),
		count,
		children
	}: {
		title: string;
		open?: boolean;
		/** Shown after the title when there is something to count. */
		count?: number;
		children: Snippet;
	} = $props();
</script>

<div class="border-border/70 mt-1 border-t pt-1">
	<button
		class="text-faint hover:bg-accent hover:text-foreground flex h-7 w-full items-center gap-1 rounded-md px-1.5 text-xs font-medium transition-colors"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<IconChevronRight
			size={14}
			class="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] {open
				? 'rotate-90'
				: ''}"
		/>
		<span class="truncate">{title}</span>
		{#if count}
			<span class="ml-auto tabular-nums">{count}</span>
		{/if}
	</button>
	{#if open}
		<div transition:slide={{ duration: 200, easing: cubicOut }}>
			{@render children()}
		</div>
	{/if}
</div>
