<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import { packageRequestUrl, REQUEST_ETA } from "$lib/packages/request";
	import { breadcrumbLd, faqLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow, Section } from "$lib/site";
	import { Badge } from "@glyphtex/ui/badge";
	import { Button } from "@glyphtex/ui/button";
	import { Input } from "@glyphtex/ui/input";
	import { IconBrandGithub, IconPackage, IconSearch } from "@tabler/icons-svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const resolveAny = resolve as (route: string) => string;
	let query = $state("");

	const core = $derived(data.groups.filter((g) => g.kind === "core"));
	const packs = $derived(data.groups.filter((g) => g.kind === "pack"));
	const featured = $derived(data.packages.filter((p) => p.hasPage));
	const known = $derived(new Map(data.packages.map((p) => [p.name, p])));

	type Row = {
		name: string;
		detail?: string;
		status: "core" | "pack" | "missing";
		packLabel?: string;
		hasPage: boolean;
	};
	const rows = $derived.by((): Row[] => {
		const out = new Map<string, Row>();
		for (const p of data.packages) {
			out.set(p.name, {
				name: p.name,
				detail: p.detail,
				status: p.support?.kind ?? "missing",
				packLabel: p.support?.kind === "pack" ? p.support.packLabel : undefined,
				hasPage: p.hasPage
			});
		}
		for (const [name, s] of data.supported) {
			if (out.has(name)) continue;
			out.set(name, {
				name,
				status: s.kind,
				packLabel: s.kind === "pack" ? s.packLabel : undefined,
				hasPage: false
			});
		}
		return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
	});

	// Without a query the list is the documented packages; a query searches every file the engine has.
	const visible = $derived.by(() => {
		const q = query
			.trim()
			.toLowerCase()
			.replace(/\.(sty|cls)$/, "");
		if (!q) return rows.filter((r) => known.has(r.name));
		return rows
			.filter((r) => r.name.toLowerCase().includes(q) || r.detail?.toLowerCase().includes(q))
			.sort((a, b) => Number(b.name.toLowerCase() === q) - Number(a.name.toLowerCase() === q))
			.slice(0, 40);
	});
	const exactMissing = $derived.by(() => {
		const q = query.trim().replace(/\.(sty|cls)$/, "");
		if (!q || !/^[A-Za-z0-9-]+$/.test(q)) return null;
		const hit = rows.find((r) => r.name.toLowerCase() === q.toLowerCase());
		return hit && hit.status !== "missing" ? null : q;
	});

	const statusLabel = (r: Row) =>
		r.status === "core" ? "Built in" : r.status === "pack" ? `${r.packLabel} set` : "Not yet";

	const faqs = $derived([
		{
			q: "Which LaTeX packages does GlyphTeX support?",
			a: `${data.supportedCount} packages and classes compile offline in GlyphTeX, including amsmath, graphicx, hyperref, tikz, biblatex and beamer. The common ones are built in, and package sets add more.`
		},
		{
			q: "What happens if my document uses a package GlyphTeX does not have?",
			a: `If an optional package set has it, GlyphTeX offers to add that set. If none does, it tells you and lets you request it on GitHub; the aim is to add requested packages within ${REQUEST_ETA}.`
		}
	]);

	const jsonld = $derived([
		serialise(
			breadcrumbLd([
				{ name: "Home", url: "/" },
				{ name: "LaTeX packages", url: "/packages" }
			])
		),
		serialise(faqLd(faqs)!)
	]);
	const requestHref = packageRequestUrl();
</script>

<Seo
	title="LaTeX packages that compile offline · GlyphTeX"
	description="Every LaTeX package and class GlyphTeX compiles in the browser, what each one adds, and how to request one that is missing. Nothing to install."
	canonical="/packages"
	{jsonld}
/>

{#snippet requestButton(variant: "dark" | "outline", location: string, name?: string)}
	<Button
		href={name ? packageRequestUrl(name) : requestHref}
		target="_blank"
		rel="noopener noreferrer"
		{variant}
		onclick={() => track("outbound_clicked", { destination: "github_issues", location })}
	>
		<IconBrandGithub />
		{name ? `Request ${name}` : "Request a package"}
	</Button>
{/snippet}

<RailFrame>
	<RailRow divider={false} label="LaTeX packages" section="packages_hero">
		<PageHero
			badge="{data.supportedCount} packages and classes"
			title="LaTeX packages"
			accent="that compile in GlyphTeX."
			lede="Everything here compiles in your browser with nothing to install. The common packages are built in, and package sets add more. Missing one? Ask for it: requests usually ship in {REQUEST_ETA}."
		>
			{#snippet actions()}
				<Button href="#search" variant="dark">
					<IconSearch />
					Check a package
				</Button>
				{@render requestButton("outline", "packages_hero")}
			{/snippet}
		</PageHero>
	</RailRow>

	<Section
		id="built-in"
		number={1}
		title="built into the engine."
		description="Ready on the first compile, along with everything they depend on."
		section="packages_core"
	>
		<div class="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
			{#each core as g (g.id)}
				<div class="flex flex-col gap-2.5 border-t border-dashed border-border py-5">
					<h3 class="text-sm font-medium text-foreground">{g.label}</h3>
					<ul class="flex flex-wrap gap-1.5" aria-label="{g.label} packages">
						{#each g.packages as name (name)}
							<li><Badge variant="outline" class="font-mono font-normal">{name}</Badge></li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</Section>

	<Section
		id="sets"
		number={2}
		title="package sets."
		description="Downloaded with the engine. Large optional sets, like Font Awesome, are offered the first time a document needs them."
		section="packages_sets"
	>
		<div class="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
			{#each packs as g (g.id)}
				<div class="flex flex-col gap-2 border-t border-dashed border-border py-5">
					<h3 class="text-sm font-medium text-foreground">{g.label}</h3>
					{#if g.description}
						<p class="text-sm text-pretty text-muted-foreground">{g.description}</p>
					{/if}
					<ul class="mt-1 flex flex-wrap gap-1.5" aria-label="{g.label} packages">
						{#each g.packages as name (name)}
							<li><Badge variant="outline" class="font-mono font-normal">{name}</Badge></li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</Section>

	<Section
		id="reference"
		number={3}
		title="package reference."
		description="Pages with the commands and environments each package adds, and templates that use it."
		section="packages_featured"
	>
		<ul class="group/list grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
			{#each featured as p (p.name)}
				<li>
					<a
						href={resolveAny(`/packages/${p.name}`)}
						class="flex flex-col gap-1.5 border-t border-dashed border-border py-5 outline-none transition-opacity duration-(--duration-fast) group-hover/list:opacity-50 hover:opacity-100! focus-visible:opacity-100! focus-visible:ring-2 focus-visible:ring-ring"
					>
						<h3 class="font-mono text-base text-foreground">{p.name}</h3>
						<p class="line-clamp-2 text-sm text-pretty text-muted-foreground">{p.detail}</p>
					</a>
				</li>
			{/each}
		</ul>
	</Section>

	<Section
		id="search"
		number={4}
		title="is my package supported?"
		description="Search by package or class name, with or without .sty or .cls."
		section="packages_search"
	>
		<label class="relative mb-6 block w-full sm:max-w-sm">
			<span class="sr-only">Search packages</span>
			<IconSearch
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<Input
				bind:value={query}
				type="search"
				placeholder="exam, fontspec, tikz..."
				spellcheck="false"
				class="pl-9"
			/>
		</label>

		{#if exactMissing}
			<div
				class="mb-6 flex flex-col gap-3 rounded-xl border border-dashed border-border p-5 sm:flex-row sm:items-center sm:justify-between"
				role="status"
			>
				<p class="text-sm text-pretty text-foreground">
					<span class="font-mono">{exactMissing}</span> is not in GlyphTeX yet.
					<span class="text-muted-foreground">Requests usually ship in {REQUEST_ETA}.</span>
				</p>
				{@render requestButton("dark", "packages_search", exactMissing)}
			</div>
		{/if}

		<p class="mb-2 font-mono text-xs text-muted-foreground tabular-nums" aria-live="polite">
			{visible.length}
			{visible.length === 1 ? "result" : "results"}
		</p>
		<ul class="grid gap-x-10 sm:grid-cols-2">
			{#each visible as r (r.name)}
				<li class="flex items-baseline gap-3 border-t border-dashed border-border py-3 text-sm">
					{#if r.hasPage}
						<a
							href={resolveAny(`/packages/${r.name}`)}
							class="w-28 shrink-0 truncate rounded-sm font-mono text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
						>
							{r.name}
						</a>
					{:else}
						<span class="w-28 shrink-0 truncate font-mono text-foreground">{r.name}</span>
					{/if}
					<span class="min-w-0 flex-1 truncate text-muted-foreground">{r.detail ?? ""}</span>
					<Badge
						variant={r.status === "core" ? "success" : r.status === "pack" ? "info" : "outline"}
						size="sm"
						class="shrink-0"
					>
						{statusLabel(r)}
					</Badge>
				</li>
			{/each}
		</ul>
	</Section>

	<RailRow label="Request a package" section="packages_cta">
		<BrandPanel
			title="Need a package that isn't here?"
			body="Open a request on GitHub with the package name. Most requests are added within {REQUEST_ETA}."
		>
			{#snippet icon()}
				<IconPackage aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				{@render requestButton("dark", "packages_cta")}
				<Button href={resolve("/templates")} variant="outline">Browse templates</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
