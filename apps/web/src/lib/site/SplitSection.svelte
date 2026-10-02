<script lang="ts">
	import { revealOnScroll, staggerDelay } from "$lib/motion";
	import { cn } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";

	let {
		title,
		accent,
		description,
		sticky = false,
		headingLevel = 2,
		aside,
		class: className,
		children
	}: {
		title: string;
		accent?: string;
		description?: string;
		/** Keeps the title column in view while the content scrolls. */
		sticky?: boolean;
		headingLevel?: 2 | 3;
		aside?: Snippet;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<div class={cn('relative w-full px-1 py-6 sm:px-4 sm:py-8 lg:px-16 lg:py-10', className)}>
	<div class="flex flex-col gap-10 lg:flex-row lg:gap-20">
		<div class="flex shrink-0 flex-col gap-2 lg:w-110">
			<div class={cn('flex flex-col gap-2', sticky && 'lg:sticky lg:top-28')}>
				<svelte:element
					this={`h${headingLevel}`}
					class="reveal text-balance text-heading-lg font-medium text-foreground"
					{@attach revealOnScroll}
				>
					{title}
					{#if accent}
						<br />
						<span class="text-primary">{accent}</span>
					{/if}
				</svelte:element>
				{#if description}
					<p
						class="reveal max-w-sm text-pretty text-body text-muted-foreground"
						style={staggerDelay(1)}
						{@attach revealOnScroll}
					>
						{description}
					</p>
				{/if}
				{#if aside}
					<div class="reveal mt-6" style={staggerDelay(2)} {@attach revealOnScroll}>
						{@render aside()}
					</div>
				{/if}
			</div>
		</div>
		<div class="reveal min-w-0 flex-1" style={staggerDelay(1)} {@attach revealOnScroll}>
			{@render children()}
		</div>
	</div>
</div>
