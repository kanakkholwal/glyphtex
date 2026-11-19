<script lang="ts">
	import { viewSection } from "$lib/analytics";
	import { cn } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";

	let {
		id,
		title,
		accent,
		description,
		section,
		action,
		class: className,
		children
	}: {
		id: string;
		title: string;
		/** Tail of the title, set in the brand blue. */
		accent?: string;
		description?: string;
		/** Analytics section name, reported once when the block is read. */
		section?: string;
		action?: Snippet;
		class?: string;
		children: Snippet;
	} = $props();

	const noop = () => {};
</script>

<section
	{id}
	aria-labelledby="{id}-title"
	class={cn(
		'scroll-mt-20 px-5 py-16 sm:px-6 lg:px-10 lg:py-24',
		className
	)}
	{@attach section ? viewSection(section) : noop}
>
	<div class="mb-10 flex flex-wrap items-end justify-between gap-6 lg:mb-14">
		<div class="max-w-2xl">
			<h2 id="{id}-title" class="display text-4xl text-foreground sm:text-5xl">
				{title}{#if accent}{' '}<span class="text-accent-ink">{accent}</span>{/if}
			</h2>
			{#if description}
				<p class="mt-5 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
					{description}
				</p>
			{/if}
		</div>
		{#if action}
			<div class="shrink-0">{@render action()}</div>
		{/if}
	</div>
	{@render children()}
</section>
