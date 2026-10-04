<script lang="ts">
	import { goto } from "$app/navigation";
	import { track } from "$lib/analytics";
	import FilterChips from "$lib/site/FilterChips.svelte";
	import { Button } from "@glyphtex/ui/button";
	import { Input } from "@glyphtex/ui/input";
	import { cn } from "@glyphtex/ui/utils";
	import { IconArrowRight, IconSearch } from "@tabler/icons-svelte";
	import type { Guide } from "./guides";

	let {
		guides,
		initialCategory = "all"
	}: {
		guides: Guide[];
		/** A docs category name, "blog" or "all". */
		initialCategory?: string;
	} = $props();

	// Docs categories in authored order, then the blog as one bucket.
	const categories = $derived([
		{ id: "all", name: "Everything" },
		...[...new Set(guides.filter((g) => g.kind === "docs").map((g) => g.category))].map((c) => ({
			id: c,
			name: c
		})),
		{ id: "blog", name: "Blog" }
	]);

	let query = $state("");
	// svelte-ignore state_referenced_locally
	let category = $state(initialCategory);

	const results = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return guides
			.filter((g) =>
				category === "all"
					? true
					: category === "blog"
						? g.kind === "blog"
						: g.category === category
			)
			.filter(
				(g) => !q || g.title.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)
			);
	});

	function openBest(event: SubmitEvent) {
		event.preventDefault();
		const best = results[0];
		if (!best) return;
		track("cta_clicked", { target: "guide", location: "launcher" });
		goto(best.href);
	}
</script>

<div class="flex flex-col gap-8">
	<form aria-label="Search guides" onsubmit={openBest} class="flex max-w-3xl flex-col gap-4">
		<FilterChips
			options={categories.map((c) => ({ id: c.id, label: c.name }))}
			value={category}
			onchange={(id) => (category = id)}
			label="Filter by topic"
		/>

		<div class="flex items-center gap-2">
			<label class="relative min-w-0 flex-1">
				<span class="sr-only">Search guides</span>
				<IconSearch
					class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					type="search"
					size="xl"
					bind:value={query}
					placeholder="Undefined control sequence, bibliography, thesis..."
					class="pl-10"
				/>
			</label>
			<Button type="submit" variant="dark" size="icon-xl" aria-label="Open the best match">
				<IconArrowRight aria-hidden="true" />
			</Button>
		</div>

		<p class="font-mono text-xs text-muted-foreground tabular-nums" aria-live="polite">
			{#if results.length === 0}
				No guide matches “{query}”. Try a shorter phrase, or ask on GitHub.
			{:else}
				{results.length}
				{results.length === 1 ? 'guide' : 'guides'} · press Enter to open the first
			{/if}
		</p>
	</form>

	{#if results.length > 0}
		<ul class="group/list grid gap-x-10 sm:grid-cols-2">
			{#each results as g (g.href)}
				<li>
					<a
						href={g.href}
						class="flex h-full flex-col gap-1 border-t border-dashed border-border py-4 outline-none transition-opacity duration-(--duration-fast) group-hover/list:opacity-50 hover:opacity-100! focus-visible:opacity-100! focus-visible:ring-2 focus-visible:ring-ring"
					>
						<div class="flex items-baseline justify-between gap-4">
							<h3 class="text-sm font-medium text-foreground">{g.title}</h3>
							<span class="shrink-0 font-mono text-xs text-muted-foreground">
								{g.kind === 'blog' ? 'Article' : g.category}
							</span>
						</div>
						<p class="line-clamp-2 text-sm text-pretty text-muted-foreground">{g.description}</p>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
