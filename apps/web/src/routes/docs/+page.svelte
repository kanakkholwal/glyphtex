<script lang="ts">
	import { resolve } from "$app/paths";
	import { breadcrumbLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow, Section } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { IconArrowRight, IconBook2 } from "@tabler/icons-svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const description =
		"Practical LaTeX documentation: fix compile errors, structure a thesis, manage figures and bibliographies, all compiled locally in GlyphTeX.";
	const crumbLd = serialise(
		breadcrumbLd([
			{ name: "Home", url: "/" },
			{ name: "Docs", url: "/docs" }
		])
	);

	const first = $derived(data.groups[0]?.items[0]);
	const total = $derived(data.groups.reduce((n, g) => n + g.items.length, 0));
	const slug = (s: string) =>
		s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
</script>

<Seo title="GlyphTeX Docs" {description} canonical="/docs" jsonld={[crumbLd]} />

<RailFrame>
	<RailRow divider={false} label="Documentation">
		<PageHero
			badge="Documentation"
			title="LaTeX,"
			accent="without the guesswork"
			lede={description}
		>
			{#snippet actions()}
				{#if first}
					<Button href={first.url} variant="default">
						Start with {first.title}
						<IconArrowRight />
					</Button>
				{/if}
			{/snippet}
		</PageHero>
	</RailRow>

	{#if total === 0}
		<RailRow label="Guides">
			<p class="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
				No guides are published yet. The blog has the articles written so far.
			</p>
		</RailRow>
	{/if}

	{#each data.groups as group, i (group.category)}
		<Section
			id={slug(group.category)}
			number={i + 1}
			title="{group.category}."
			description="{group.items.length} {group.items.length === 1 ? 'guide' : 'guides'}"
		>
			<ul class="group/list grid gap-x-10 md:grid-cols-2">
				{#each group.items as item (item.slug)}
					<li>
						<a
							href={item.url}
							class="flex h-full flex-col gap-1 border-t border-dashed border-border py-4 outline-none transition-opacity duration-(--duration-fast) group-hover/list:opacity-50 hover:opacity-100! focus-visible:opacity-100! focus-visible:ring-2 focus-visible:ring-ring"
						>
							<span class="text-sm font-medium text-foreground">{item.title}</span>
							<span class="text-sm text-pretty text-muted-foreground">{item.description}</span>
						</a>
					</li>
				{/each}
			</ul>
		</Section>
	{/each}

	<RailRow label="Try it">
		<BrandPanel
			title="Practise in the real editor."
			body="Every guide compiles in the browser workspace. No account, nothing uploaded."
		>
			{#snippet icon()}
				<IconBook2 stroke-width={1.5} />
			{/snippet}
			{#snippet actions()}
				<Button href={resolve('/workspace')} variant="dark">Open the workspace</Button>
				<Button href={resolve('/blog')} variant="outline">Read the blog</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
