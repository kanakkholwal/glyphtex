<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import FilterChips from "$lib/site/FilterChips.svelte";
	import { Button } from "@glyphtex/ui/button";
	import { Input } from "@glyphtex/ui/input";
	import { type ProjectTemplate, TEMPLATE_CATEGORIES } from "@glyphtex/ui/project-templates";
	import { cn } from "@glyphtex/ui/utils";
	import { IconArrowRight, IconExternalLink, IconSearch, IconX } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	let { templates }: { templates: ProjectTemplate[] } = $props();

	let query = $state("");
	let category = $state("all");

	// The page is prerendered, so a category link from the home page arrives as a hash.
	onMount(() => {
		const wanted = location.hash.slice(1);
		if (TEMPLATE_CATEGORIES.some((c) => c.id === wanted)) category = wanted;
	});

	const counts = $derived.by(() => {
		const acc: Record<string, number> = {};
		for (const t of templates) acc[t.category] = (acc[t.category] ?? 0) + 1;
		return acc;
	});
	const tabs = $derived([
		{ id: "all", label: "All", count: templates.length },
		...TEMPLATE_CATEGORIES.filter((c) => counts[c.id]).map((c) => ({
			id: c.id as string,
			label: c.label,
			count: counts[c.id]
		}))
	]);
	const visible = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return templates.filter(
			(t) =>
				(category === "all" || t.category === category) &&
				(!q ||
					t.title.toLowerCase().includes(q) ||
					t.description.toLowerCase().includes(q) ||
					t.author.toLowerCase().includes(q))
		);
	});
	const label = (id: string) => TEMPLATE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
	const useHref = (id: string) =>
		`${resolve("/workspace/templates")}?use=${encodeURIComponent(id)}`;
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-3 lg:flex-row lg:items-center">
		<FilterChips
			options={tabs}
			value={category}
			onchange={(id) => (category = id)}
			label="Filter templates by use"
			class="flex-1"
		/>
		<label class="relative w-full lg:w-72">
			<span class="sr-only">Search templates</span>
			<IconSearch
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<Input
				bind:value={query}
				type="search"
				placeholder="Search thesis, CV, beamer..."
				spellcheck="false"
				class="pl-9"
			/>
		</label>
	</div>

	<p class="font-mono text-xs text-muted-foreground tabular-nums" aria-live="polite">
		{visible.length}
		{visible.length === 1 ? "template" : "templates"} · each credits its author and keeps their licence
	</p>

	{#if visible.length === 0}
		<div
			class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center"
		>
			<p class="text-sm font-medium text-foreground">No templates match “{query}”</p>
			<Button
				variant="outline"
				size="sm"
				onclick={() => {
					query = "";
					category = "all";
				}}
			>
				<IconX /> Clear filters
			</Button>
		</div>
	{:else}
		<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Templates">
			{#each visible as t (t.id)}
				<li class="panel-card flex flex-col gap-4 p-5">
					<div class="flex items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
						<span>{label(t.category)}</span>
						<span>{t.documentClass}</span>
					</div>
					<div class="min-w-0 flex-1">
						<h3 class="line-clamp-2 text-base font-medium text-foreground">{t.title}</h3>
						{#if t.description}
							<p class="mt-1 line-clamp-3 text-sm text-pretty text-muted-foreground">
								{t.description}
							</p>
						{/if}
					</div>
					<p
						class="truncate border-t border-dashed border-border pt-3 font-mono text-xs text-muted-foreground"
						title={`${t.author} · ${t.license}`}
					>
						by <span class="text-foreground">{t.author}</span> · {t.license.replace("Creative Commons ", "")}
					</p>
					<div class="flex items-center gap-2">
						<Button
							href={useHref(t.id)}
							variant="outline"
							size="sm"
							class="flex-1"
							onclick={() => track("cta_clicked", { target: "template", location: "templates" })}
						>
							Use template
							<IconArrowRight />
						</Button>
						<Button
							href={t.sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							variant="ghost"
							size="icon-sm"
							aria-label={`Original source of ${t.title}`}
							title="Original source"
						>
							<IconExternalLink />
						</Button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
