<script lang="ts">
	import { viewSection } from "$lib/analytics";
	import { cn } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";

	/** A page block: sentence-case display title, optional blue tail, description and action. */
	let {
		id,
		title,
		accent,
		description,
		section,
		index = 0,
		action,
		class: className,
		children
	}: {
		id: string;
		/** Accepted for older call sites; no longer rendered. */
		number?: number;
		title: string;
		/** Tail of the title, set in the brand blue. */
		accent?: string;
		/** Accepted for older call sites; no longer rendered. */
		eyebrow?: string;
		description?: string;
		/** Analytics section name, reported once when the block is read. */
		section?: string;
		/** Stagger slot for the first-paint `rise`. */
		index?: number;
		action?: Snippet;
		class?: string;
		children: Snippet;
	} = $props();

	// Older call sites write lowercase titles with a full stop; the new style is sentence case.
	const heading = $derived(title.replace(/\.$/, "").replace(/^./, (c) => c.toUpperCase()));

	const noop = () => {};
</script>

<section
	{id}
	aria-labelledby="{id}-title"
	class={cn(
		'rise scroll-mt-20 px-5 py-14 sm:px-6 lg:px-10 lg:py-20',
		className
	)}
	style:--i={index}
	{@attach section ? viewSection(section) : noop}
>
	<div class="mb-10 flex flex-wrap items-end justify-between gap-6 lg:mb-12">
		<div class="max-w-2xl">
			<h2 id="{id}-title" class="display text-3xl text-foreground sm:text-4xl">
				{heading}{#if accent}{' '}<span class="text-accent-ink">{accent}</span>{/if}
			</h2>
			{#if description}
				<p class="mt-4 max-w-xl text-base text-pretty text-muted-foreground">{description}</p>
			{/if}
		</div>
		{#if action}
			<div class="shrink-0">{@render action()}</div>
		{/if}
	</div>
	{@render children()}
</section>
