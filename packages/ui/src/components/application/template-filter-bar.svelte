<script lang="ts">
	import { IconSearch, IconX } from "@tabler/icons-svelte";
	import { cn } from "../../lib/cn.js";
	import type { TemplateFilter, TemplateSource } from "../../lib/project-templates/filter.svelte";
	import { Button } from "../ui/button";
	import { Input } from "../ui/input";
	import { shortcutCap } from "../ui/shortcut";
	import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";

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

	let search = $state<HTMLInputElement | null>(null);

	function focusSearch(event: KeyboardEvent) {
		if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
		if ((event.target as HTMLElement | null)?.closest("input, textarea, [contenteditable]")) return;
		event.preventDefault();
		search?.focus();
	}
</script>

<svelte:window onkeydown={focusSearch} />

<div class={cn("flex flex-col gap-3", className)}>
	<div class="flex flex-wrap items-center gap-2">
		<label class="relative min-w-0 flex-1 sm:max-w-sm">
			<span class="sr-only">Search templates</span>
			<IconSearch
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<Input
				bind:ref={search}
				bind:value={filter.query}
				type="search"
				placeholder="Search thesis, CV, beamer..."
				spellcheck="false"
				class="pr-10 pl-9"
			/>
			<kbd
				class={cn(
					shortcutCap(),
					"pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 sm:inline-flex"
				)}
				aria-hidden="true"
			>
				/
			</kbd>
		</label>
		<ToggleGroup
			type="single"
			size="lg"
			label="Filter templates by source"
			bind:value={() => filter.source, (v) => (filter.source = (v || "all") as TemplateSource)}
		>
			<ToggleGroupItem value="all">All</ToggleGroupItem>
			<ToggleGroupItem value="glyphtex">GlyphTeX</ToggleGroupItem>
			<ToggleGroupItem value="overleaf">Community</ToggleGroupItem>
		</ToggleGroup>
		<div class="ml-auto flex items-center gap-2">
			<p class="font-mono text-xs text-muted-foreground tabular-nums" aria-live="polite">
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
				class={cn(
					"flex h-8 shrink-0 scroll-mt-24 items-center gap-1.5 rounded-full border px-3 text-sm outline-none transition-colors duration-(--duration-fast) ease-(--ease-out) focus-visible:ring-2 focus-visible:ring-ring",
					on
						? "border-transparent bg-primary text-primary-foreground"
						: "border-border text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
				)}
			>
				{tab.label}
				<span class={cn("font-mono text-xs tabular-nums", !on && "text-muted-foreground")}>
					{tab.count}
				</span>
			</button>
		{/each}
	</div>
</div>
