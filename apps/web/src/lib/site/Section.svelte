<script lang="ts">
	import { viewSection } from "$lib/analytics";
	import { cn } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";

	/** A numbered block: dashed rule across the column, mono number, lowercase pixel title with a full stop. */
	let {
		id,
		number,
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
		number?: number;
		title: string;
		/** Tail of the title, set in muted ink. */
		accent?: string;
		description?: string;
		/** Analytics section name, reported once when the block is read. */
		section?: string;
		/** Stagger slot for the first-paint `rise`. */
		index?: number;
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
		'rise scroll-mt-20 border-t border-dashed border-border px-5 py-12 sm:px-6 lg:px-10 lg:py-16',
		className
	)}
	style:--i={index}
	{@attach section ? viewSection(section) : noop}
>
	<div class="mb-8 flex flex-wrap items-end justify-between gap-4">
		<div class="flex min-w-0 flex-col gap-2">
			<div class="flex items-baseline gap-2.5">
				{#if number !== undefined}
					<span class="font-mono text-xs text-accent-ink tabular-nums">
						{String(number).padStart(2, '0')}
					</span>
				{/if}
				<h2 id="{id}-title" class="pixel cursor-default text-2xl text-foreground hover:[--elsh:60]">
					{title}{#if accent}{' '}<span class="text-muted-foreground">{accent}</span>{/if}
				</h2>
			</div>
			{#if description}
				<p class="text-sm text-pretty text-muted-foreground">{description}</p>
			{/if}
		</div>
		{#if action}
			<div class="shrink-0">{@render action()}</div>
		{/if}
	</div>
	{@render children()}
</section>
