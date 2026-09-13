<script lang="ts">
	import { goto } from "$app/navigation";
	import { track } from "$lib/analytics";
	import { TiltedChip } from "$lib/site";
	import { cn } from "@glyphtex/ui/utils";
	import {
		IconAlertTriangle,
		IconArrowRight,
		IconBook2,
		IconLayoutGrid,
		IconNews,
		IconRocket,
		IconSearch,
		IconWriting
	} from "@tabler/icons-svelte";
	import type { Guide } from "./guides";

	let {
		guides,
		headingLevel = 2,
		initialCategory = "all"
	}: {
		guides: Guide[];
		headingLevel?: 1 | 2;
		/** A docs category name, "blog" or "all". */
		initialCategory?: string;
	} = $props();

	const iconFor = (category: string) => {
		const c = category.toLowerCase();
		if (c.includes("error") || c.includes("fix")) return IconAlertTriangle;
		if (c.includes("start")) return IconRocket;
		if (c.includes("writ")) return IconWriting;
		return IconBook2;
	};

	// Docs categories in authored order, then the blog as one bucket.
	const categories = $derived([
		{ id: "all", name: "Everything", icon: IconLayoutGrid },
		...[...new Set(guides.filter((g) => g.kind === "docs").map((g) => g.category))].map((c) => ({
			id: c,
			name: c,
			icon: iconFor(c)
		})),
		{ id: "blog", name: "Blog", icon: IconNews }
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

<div class="flex flex-col">
	<div class="mx-auto flex w-full max-w-3xl flex-col items-center px-1 py-10 text-center sm:py-14">
		<TiltedChip tilt="right">
			<span class="text-primary">{guides.length} guides</span>, written for this editor
			{#snippet tail()}Free{/snippet}
		</TiltedChip>

		<svelte:element
			this={`h${headingLevel}`}
			class="mt-4 text-balance text-heading-lg font-medium text-foreground md:text-display"
		>
			Stuck on a
			<br />
			<span class="text-primary">LaTeX error</span> today?
		</svelte:element>
		<p class="mt-3 text-pretty text-body text-muted-foreground md:text-body-lg">
			Search the guides, or pick a topic to browse.
		</p>

		<form
			aria-label="Search guides"
			onsubmit={openBest}
			class="mt-8 w-full rounded-3xl border border-border bg-card p-2 text-left dark:bg-background"
		>
			<fieldset class="no-scrollbar flex min-w-0 gap-1 overflow-x-auto border-0 p-1">
				<legend class="sr-only">Filter by topic</legend>
				{#each categories as c (c.id)}
					{@const active = category === c.id}
					<button
						type="button"
						aria-pressed={active}
						onclick={() => (category = c.id)}
						class={cn(
							'flex h-10 shrink-0 items-center gap-2 rounded-xl border px-2 pr-3 text-body outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring',
							active
								? 'border-border bg-background font-medium text-foreground shadow-xs dark:bg-muted'
								: 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
						)}
					>
						<span
							class={cn(
								'grid size-6 place-items-center rounded-md border',
								active ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
							)}
						>
							<c.icon class="size-3.5" aria-hidden="true" />
						</span>
						{c.name}
					</button>
				{/each}
			</fieldset>

			<label
				class="mt-1 flex h-14 items-center gap-3 rounded-2xl bg-muted pr-2 pl-4 focus-within:ring-2 focus-within:ring-ring"
			>
				<IconSearch class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
				<span class="sr-only">Search guides</span>
				<input
					type="search"
					bind:value={query}
					placeholder="Undefined control sequence, bibliography, thesis..."
					class="h-full min-w-0 flex-1 bg-transparent text-body-lg text-foreground outline-none"
				/>
				<button
					type="submit"
					aria-label="Open the best match"
					class="grid size-10 shrink-0 place-items-center rounded-full bg-action text-action-foreground outline-none transition-transform duration-100 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<IconArrowRight class="size-4" aria-hidden="true" />
				</button>
			</label>
		</form>

		<p class="mt-4 text-body text-muted-foreground" aria-live="polite">
			{#if results.length === 0}
				No guide matches “{query}”. Try a shorter phrase, or ask on GitHub.
			{:else}
				{results.length}
				{results.length === 1 ? 'guide' : 'guides'} · press Enter to open the first
			{/if}
		</p>
	</div>

	{#if results.length > 0}
		<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each results as g (g.href)}
				{@const Icon = g.kind === 'blog' ? IconNews : iconFor(g.category)}
				<li>
					<a
						href={g.href}
						class="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 outline-none transition-[border-color] duration-200 ease-craft hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring dark:bg-background"
					>
						<div class="flex items-start justify-between gap-3">
							<span
								class="grid size-10 place-items-center rounded-lg border border-border text-foreground transition-colors duration-200 group-hover:text-primary"
							>
								<Icon class="size-5" aria-hidden="true" />
							</span>
							<span
								class="rounded-full border border-border px-2 py-0.5 text-caption font-medium text-muted-foreground"
							>
								{g.kind === 'blog' ? 'Article' : g.category}
							</span>
						</div>
						<div class="flex flex-1 flex-col gap-1">
							<h3 class="flex items-center gap-1.5 text-body-lg font-medium text-foreground">
								{g.title}
								<IconArrowRight
									aria-hidden="true"
									class="size-4 shrink-0 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100"
								/>
							</h3>
							<p class="line-clamp-2 text-body text-muted-foreground">{g.description}</p>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
