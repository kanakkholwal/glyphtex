<script lang="ts">
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
		/** Tail of the title, set in muted ink. */
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

<div class={cn('relative w-full py-2 sm:py-4', className)}>
	<div class="flex flex-col gap-8 lg:flex-row lg:gap-16">
		<div class="flex shrink-0 flex-col gap-2 lg:w-80">
			<div class={cn('flex flex-col gap-2', sticky && 'lg:sticky lg:top-24')}>
				<svelte:element
					this={`h${headingLevel}`}
					class="pixel cursor-default text-2xl text-balance text-foreground hover:[--elsh:60]"
				>
					{title}{#if accent}{' '}<span class="text-muted-foreground">{accent}</span>{/if}
				</svelte:element>
				{#if description}
					<p class="max-w-sm text-sm text-pretty text-muted-foreground">{description}</p>
				{/if}
				{#if aside}
					<div class="mt-5">{@render aside()}</div>
				{/if}
			</div>
		</div>
		<div class="min-w-0 flex-1">{@render children()}</div>
	</div>
</div>
