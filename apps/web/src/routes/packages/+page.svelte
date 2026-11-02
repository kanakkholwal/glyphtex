<script lang="ts">
	import { resolve } from "$app/paths";
	import { breadcrumbLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow, Section } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { Input } from "@glyphtex/ui/input";
	import { IconPackage, IconSearch } from "@tabler/icons-svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const resolveAny = resolve as (route: string) => string;
	let query = $state("");

	const featured = $derived(data.packages.filter((p) => p.hasPage));
	const visible = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return data.packages;
		return data.packages.filter(
			(p) => p.name.toLowerCase().includes(q) || p.detail.toLowerCase().includes(q)
		);
	});

	const counts = (p: (typeof data.packages)[number]) =>
		[
			p.coverage.commands && `${p.coverage.commands} commands`,
			p.coverage.environments && `${p.coverage.environments} environments`,
			p.coverage.templates && `${p.coverage.templates} templates`
		]
			.filter(Boolean)
			.join(" · ");

	const jsonld = [
		serialise(
			breadcrumbLd([
				{ name: "Home", url: "/" },
				{ name: "LaTeX packages", url: "/packages" }
			])
		)
	];
</script>

<Seo
	title="LaTeX packages: what each one adds · GlyphTeX"
	description="A reference of common LaTeX packages: what each one does, the commands and environments it adds, and templates that use it. All compile offline in GlyphTeX."
	canonical="/packages"
	{jsonld}
/>

<RailFrame>
	<RailRow divider={false} label="LaTeX packages" section="packages_hero">
		<PageHero
			badge="{data.packages.length} packages"
			title="LaTeX packages"
			accent="and what they add."
			lede="What each package is for, the commands and environments it brings, and the templates that load it. Load any of them with \usepackage in the preamble."
		/>
	</RailRow>

	<Section
		id="featured"
		number={1}
		title="the ones that do the most."
		description="Each has its own page with its commands, environments and the templates that use it."
		section="packages_featured"
	>
		<ul class="group/list grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
			{#each featured as p (p.name)}
				<li>
					<a
						href={resolveAny(`/packages/${p.name}`)}
						class="flex flex-col gap-1.5 border-t border-dashed border-border py-5 outline-none transition-opacity duration-(--duration-fast) group-hover/list:opacity-50 hover:opacity-100! focus-visible:opacity-100! focus-visible:ring-2 focus-visible:ring-ring"
					>
						<span class="font-mono text-xs text-muted-foreground tabular-nums">{counts(p)}</span>
						<h3 class="font-mono text-base text-foreground">{p.name}</h3>
						<p class="line-clamp-2 text-sm text-pretty text-muted-foreground">{p.detail}</p>
					</a>
				</li>
			{/each}
		</ul>
	</Section>

	<Section id="all" number={2} title="every package." section="packages_all">
		{#snippet action()}
			<label class="relative block w-full sm:w-72">
				<span class="sr-only">Search packages</span>
				<IconSearch
					class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					bind:value={query}
					type="search"
					placeholder="Search tables, math, fonts..."
					spellcheck="false"
					class="pl-9"
				/>
			</label>
		{/snippet}
		<p class="mb-4 font-mono text-xs text-muted-foreground tabular-nums" aria-live="polite">
			{visible.length}
			{visible.length === 1 ? "package" : "packages"}
		</p>
		<ul class="grid gap-x-10 sm:grid-cols-2">
			{#each visible as p (p.name)}
				<li class="flex items-baseline gap-4 border-t border-dashed border-border py-3 text-sm">
					{#if p.hasPage}
						<a
							href={resolveAny(`/packages/${p.name}`)}
							class="w-32 shrink-0 truncate rounded-sm font-mono text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
						>
							{p.name}
						</a>
					{:else}
						<span class="w-32 shrink-0 truncate font-mono text-foreground">{p.name}</span>
					{/if}
					<span class="min-w-0 text-pretty text-muted-foreground">{p.detail}</span>
				</li>
			{/each}
		</ul>
	</Section>

	<RailRow label="Get started" section="packages_cta">
		<BrandPanel
			title="Try a package in your browser."
			body="Open the editor, add \usepackage to the preamble and watch the preview update. Nothing to install."
		>
			{#snippet icon()}
				<IconPackage aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				<Button href={resolve('/workspace')} variant="dark">Open the editor</Button>
				<Button href={resolve('/templates')} variant="outline">Browse templates</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
