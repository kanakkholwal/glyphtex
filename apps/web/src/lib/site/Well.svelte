<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";

	/** A card rim around a raised body, optionally with a footer row in the rim. */
	let {
		class: className,
		bodyClass,
		children,
		footer
	}: { class?: string; bodyClass?: string; children: Snippet; footer?: Snippet } = $props();
</script>

<div class={cn('rounded-2xl bg-card p-1', className)}>
	<div
		class={cn('overflow-hidden rounded-xl bg-background shadow-(--surface-shadow) dark:bg-popover', bodyClass)}
	>
		{@render children()}
	</div>
	{#if footer}
		<div class="px-3 pt-3 pb-2">{@render footer()}</div>
	{/if}
</div>
