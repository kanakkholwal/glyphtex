<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import { Button } from "@glyphtex/ui/button";
	import { type ProjectTemplate, TEMPLATE_CATEGORIES } from "@glyphtex/ui/project-templates";
	import { cn } from "@glyphtex/ui/utils";
	import { IconArrowRight, IconExternalLink, IconSearch, IconX } from "@tabler/icons-svelte";

	let { templates }: { templates: ProjectTemplate[] } = $props();

	let query = $state("");
	let category = $state("all");

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

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-3 lg:flex-row lg:items-center">
		<div
			class="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1"
			role="group"
			aria-label="Filter templates by use"
		>
			{#each tabs as tab (tab.id)}
				{@const active = category === tab.id}
				<button
					type="button"
					aria-pressed={active}
					onclick={() => (category = tab.id)}
					class={cn(
						"flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-body outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
						active
							? "border-border bg-card font-medium text-foreground shadow-xs dark:bg-background"
							: "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
					)}
				>
					{tab.label}
					<span class="text-caption tabular-nums text-muted-foreground">{tab.count}</span>
				</button>
			{/each}
		</div>
		<label class="relative w-full lg:w-72">
			<span class="sr-only">Search templates</span>
			<IconSearch
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<input
				bind:value={query}
				type="search"
				placeholder="Search thesis, CV, beamer..."
				spellcheck="false"
				class="h-10 w-full rounded-lg border border-border bg-background py-1 pr-3 pl-9 text-body text-foreground outline-none placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
			/>
		</label>
	</div>

	<p class="text-body text-muted-foreground" aria-live="polite">
		{visible.length}
		{visible.length === 1 ? "template" : "templates"} · each credits its author and keeps their licence
	</p>

	{#if visible.length === 0}
		<div
			class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong px-6 py-16 text-center"
		>
			<p class="text-body-lg font-medium text-foreground">No templates match “{query}”</p>
			<Button
				variant="outline"
				onclick={() => {
					query = "";
					category = "all";
				}}
			>
				<IconX /> Clear filters
			</Button>
		</div>
	{:else}
		<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Templates">
			{#each visible as t (t.id)}
				<li class="panel-card flex flex-col gap-3 p-5">
					<div class="flex items-center justify-between gap-2">
						<span class="text-caption font-medium text-muted-foreground">{label(t.category)}</span>
						<span
							class="rounded-md border border-border px-1.5 py-0.5 font-mono text-caption text-muted-foreground"
							>{t.documentClass}</span
						>
					</div>
					<div class="min-w-0 flex-1">
						<h3 class="line-clamp-2 text-body-lg font-medium text-foreground">{t.title}</h3>
						{#if t.description}
							<p class="mt-1 line-clamp-3 text-body text-muted-foreground">{t.description}</p>
						{/if}
					</div>
					<p class="truncate text-caption text-muted-foreground" title={`${t.author} · ${t.license}`}>
						by <span class="text-foreground">{t.author}</span> · {t.license.replace("Creative Commons ", "")}
					</p>
					<div class="flex items-center gap-2">
						<Button
							href={useHref(t.id)}
							variant="outline"
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
							size="icon"
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
