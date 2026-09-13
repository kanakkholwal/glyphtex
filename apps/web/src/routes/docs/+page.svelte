<script lang="ts">
	import { resolve } from "$app/paths";
	import { breadcrumbLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow, SplitSection } from "$lib/site";
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
					<Button href={first.url} variant="primary">
						Start with {first.title}
						<IconArrowRight />
					</Button>
				{/if}
			{/snippet}
		</PageHero>
	</RailRow>

	{#if total === 0}
		<RailRow label="Guides">
			<div class="px-1 py-6 sm:px-4 lg:px-16">
				<p class="panel-card p-6 text-body text-muted-foreground">
					No guides are published yet. The blog has the articles written so far.
				</p>
			</div>
		</RailRow>
	{/if}

	{#each data.groups as group (group.category)}
		<RailRow label={group.category}>
			<SplitSection
				title={group.category}
				description="{group.items.length} {group.items.length === 1 ? 'guide' : 'guides'}"
			>
				<ul class="grid grid-cols-1 gap-3 md:grid-cols-2">
					{#each group.items as item (item.slug)}
						<li>
							<a
								href={item.url}
								class="group flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-5 outline-none transition-[border-color] duration-200 ease-craft hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring dark:bg-background"
							>
								<span class="flex min-w-0 flex-1 flex-col gap-1">
									<span class="text-body-lg font-medium text-foreground">{item.title}</span>
									<span class="text-pretty text-body text-muted-foreground">{item.description}</span>
								</span>
								<IconArrowRight
									class="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-craft group-hover:translate-x-0.5"
									aria-hidden="true"
								/>
							</a>
						</li>
					{/each}
				</ul>
			</SplitSection>
		</RailRow>
	{/each}

	<RailRow label="Try it">
		<BrandPanel
			title="Practise in the real editor."
			body="Every guide compiles in the browser workspace. No account, nothing uploaded."
		>
			{#snippet icon()}
				<IconBook2 class="size-10" stroke-width={1.5} aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				<Button href={resolve('/workspace')} variant="ink">Open the workspace</Button>
				<Button href={resolve('/blog')} variant="light">Read the blog</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
