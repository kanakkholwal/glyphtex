<script lang="ts">
	import { viewSection } from "$lib/analytics";
	import { cn } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";

	let {
		id,
		divider = true,
		label,
		section,
		class: className,
		children
	}: {
		id?: string;
		/** Dashed rule above the row. The first row passes `false`. */
		divider?: boolean;
		/** Names the section for assistive tech. */
		label?: string;
		/** Analytics section name, reported once when the row is read. */
		section?: string;
		class?: string;
		children: Snippet;
	} = $props();

	const noop = () => {};
</script>

<section
	{id}
	aria-label={label}
	class={cn(
		'flex scroll-mt-20 flex-col px-5 py-10 sm:px-6 lg:px-10',
		divider && 'border-t border-dashed border-border',
		className
	)}
	{@attach section ? viewSection(section) : noop}
>
	{@render children()}
</section>
