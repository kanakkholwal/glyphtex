<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import { IconCheck } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";

	// Quiet mono label; the name is kept for older call sites, it no longer tilts.
	let {
		children,
		tail,
		icon: Icon,
		class: className
	}: {
		children: Snippet;
		/** Trailing one-word tag. */
		tail?: Snippet;
		icon?: typeof IconCheck;
		/** Accepted for older call sites. */
		tilt?: "left" | "right";
		class?: string;
	} = $props();
</script>

<span
	class={cn(
		'inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-0.5 font-mono text-xs text-muted-foreground',
		className
	)}
>
	{#if Icon}<Icon class="size-3.5" aria-hidden="true" />{/if}
	<span>{@render children()}</span>
	{#if tail}<span class="text-foreground">{@render tail()}</span>{/if}
</span>
