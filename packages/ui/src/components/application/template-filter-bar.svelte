<script lang="ts">
	import { IconX } from "@tabler/icons-svelte";
	import { cn } from "../../lib/cn.js";
	import type { TemplateFilter, TemplateSource } from "../../lib/project-templates/filter.svelte";
	import { Button } from "../ui/button";
	import { SearchInput } from "../ui/search-input";

	let {
		filter,
		anchors = false,
		class: className
	}: {
		filter: TemplateFilter;
		/** Gives each category chip its id, so `#category` links land on (and select) it. */
		anchors?: boolean;
		class?: string;
	} = $props();

	const sources: { id: TemplateSource; label: string }[] = [
		{ id: "all", label: "All" },
		{ id: "glyphtex", label: "GlyphTeX" },
		{ id: "overleaf", label: "Community" }
	];

	// Same pill as the workspace's project filters: hairline when idle, muted fill when on.
	const pill = (on: boolean) =>
		cn(
			"flex h-8 shrink-0 scroll-mt-24 items-center gap-1.5 rounded-lg border px-3 text-sm outline-none transition-[background-color,border-color,color] duration-(--duration-fast) ease-(--ease-out) focus-visible:ring-2 focus-visible:ring-ring",
			on
				? "border-transparent bg-muted font-medium text-foreground"
				: "border-border text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground"
		);
</script>

<div class={cn("flex flex-col gap-3", className)}>
	<div class="flex flex-wrap items-center gap-2">
		<SearchInput
			label="Search templates"
			placeholder="Search thesis, CV, beamer…"
			shortcut="/"
			size="sm"
			class="w-full sm:w-64"
			bind:value={filter.query}
		/>
		<div class="flex items-center gap-1.5" role="group" aria-label="Filter templates by source">
			{#each sources as s (s.id)}
				<button
					type="button"
					class={pill(filter.source === s.id)}
					aria-pressed={filter.source === s.id}
					onclick={() => (filter.source = s.id)}
				>
					{s.label}
				</button>
			{/each}
		</div>
		<div class="ml-auto flex items-center gap-2">
			<p class="text-muted-foreground text-xs tabular-nums" aria-live="polite">
				{filter.visible.length}
				{filter.visible.length === 1 ? "template" : "templates"}
			</p>
			{#if filter.active}
				<Button variant="ghost" size="sm" onclick={() => filter.clear()}>
					<IconX />
					Clear
				</Button>
			{/if}
		</div>
	</div>
	<!-- One scrolling row on narrow screens, so the bar stays two lines tall. -->
	<div
		class="scroll-area -mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-0.5"
		role="group"
		aria-label="Filter templates by use"
	>
		{#each filter.tabs as tab (tab.id)}
			{@const on = filter.category === tab.id}
			<button
				type="button"
				id={anchors ? tab.id : undefined}
				aria-pressed={on}
				onclick={() => (filter.category = tab.id)}
				class={pill(on)}
			>
				{tab.label}
				<span class="text-muted-foreground text-xs tabular-nums">{tab.count}</span>
			</button>
		{/each}
	</div>
</div>
