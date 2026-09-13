<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import { IconCheck } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";

	// Hairline label chip. At most two per view.
	let {
		children,
		tail,
		icon: Icon = IconCheck,
		tilt = "left",
		class: className
	}: {
		children: Snippet;
		/** Replaces the icon tile, e.g. a one-word tag. */
		tail?: Snippet;
		/** Tile glyph; the check suits a claim, not a warning. */
		icon?: typeof IconCheck;
		tilt?: "left" | "right";
		class?: string;
	} = $props();
</script>

<span
	class={cn(
		'flex w-fit items-center gap-2 rounded-md border border-border p-0.5 pl-2.5 text-caption font-semibold text-foreground',
		tilt === 'left' ? '-rotate-2' : 'rotate-1',
		className
	)}
>
	<span>{@render children()}</span>
	<span class="rounded-sm border border-border bg-background px-1 py-1 leading-none">
		{#if tail}
			<span class="px-0.5">{@render tail()}</span>
		{:else}
			<Icon class="size-3.5" aria-hidden="true" />
		{/if}
	</span>
</span>
