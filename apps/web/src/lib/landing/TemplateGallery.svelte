<script lang="ts">
	import { TemplateFilter, TemplateFilterBar } from "@glyphtex/ui/application";
	import { Button } from "@glyphtex/ui/button";
	import { type ProjectTemplate, TEMPLATE_CATEGORIES } from "@glyphtex/ui/project-templates";
	import { IconX } from "@tabler/icons-svelte";
	import { onMount } from "svelte";
	import TemplateCard from "./TemplateCard.svelte";

	let { templates }: { templates: ProjectTemplate[] } = $props();

	const filter = new TemplateFilter(() => templates);

	// The page is prerendered, so a category link from the home page arrives as a hash.
	onMount(() => {
		const wanted = location.hash.slice(1);
		if (TEMPLATE_CATEGORIES.some((c) => c.id === wanted)) filter.category = wanted;
	});
</script>

<div class="flex flex-col gap-6">
	<TemplateFilterBar
		{filter}
		anchors
		class="sticky top-16 z-30 -mx-5 border-b border-dashed border-border bg-background/85 px-5 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
	/>

	{#if filter.visible.length === 0}
		<div
			class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center"
		>
			<p class="text-sm font-medium text-foreground">
				{filter.query.trim() ? `No templates match “${filter.query.trim()}”` : "No templates in this view"}
			</p>
			<Button variant="outline" size="sm" onclick={() => filter.clear()}>
				<IconX /> Clear filters
			</Button>
		</div>
	{:else}
		<ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Templates">
			{#each filter.visible as t, i (t.id)}
				<TemplateCard template={t} location="templates" priority={i < 3} />
			{/each}
		</ul>
	{/if}
</div>
