<script lang="ts">
	import { resolve } from "$app/paths";
	import PostCard from "$lib/content/PostCard.svelte";
	import { articleLd, breadcrumbLd, serialise } from "$lib/seo/jsonld";
	import { SITE_URL } from "$lib/seo/site";
	import { ogImageUrl } from "$lib/seo/og";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow, Section } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { IconNews, IconRss } from "@tabler/icons-svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const featured = $derived(data.posts.find((post) => post.featured) ?? data.posts[0]);
	const rest = $derived(data.posts.filter((post) => post.slug !== featured?.slug));

	const description =
		"Guides, comparisons, and engineering notes on writing LaTeX locally: no accounts, no uploads, compiled on your own machine.";

	// Blog graph over the posts, so an assistant reading the index sees the set.
	const listLd = $derived(
		serialise({
			"@context": "https://schema.org",
			"@type": "Blog",
			name: "GlyphTeX Blog",
			url: `${SITE_URL}/blog`,
			blogPost: data.posts.slice(0, 20).map((post) =>
				articleLd({
					title: post.title,
					description: post.description,
					url: post.url,
					image: ogImageUrl(post.url),
					published: post.date,
					modified: post.updated,
					tags: post.tags
				})
			)
		})
	);
	const crumbLd = serialise(
		breadcrumbLd([
			{ name: "Home", url: "/" },
			{ name: "Blog", url: "/blog" }
		])
	);
</script>

<Seo title="GlyphTeX Blog" {description} canonical="/blog" jsonld={[listLd, crumbLd]} />

<RailFrame>
	<RailRow divider={false} label="Blog">
		<PageHero badge="Writing, compiled locally" title="The GlyphTeX" accent="blog" lede={description}>
			{#snippet actions()}
				<Button href="/blog/rss.xml" variant="outline">
					<IconRss />
					RSS feed
				</Button>
			{/snippet}
		</PageHero>
	</RailRow>

	<Section id="articles" number={1} title="latest articles.">
		{#if data.posts.length === 0}
			<p class="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
				No articles are published yet. The docs cover the editor in the meantime.
			</p>
		{:else}
			<ul class="group/list flex flex-col">
				{#if featured}
					<li><PostCard post={featured} featured /></li>
				{/if}
				{#each rest as post (post.slug)}
					<li><PostCard {post} /></li>
				{/each}
			</ul>
		{/if}
	</Section>

	{#if data.tags.length}
		<Section id="topics" number={2} title="topics." description="Every article, grouped by subject.">
			<nav aria-label="Topics">
				<ul class="group/list grid gap-x-10 sm:grid-cols-2">
					{#each data.tags as { tag, count } (tag)}
						<li>
							<a
								href="/blog/tag/{encodeURIComponent(tag)}"
								class="flex items-center justify-between gap-4 border-t border-dashed border-border py-3 text-sm outline-none transition-opacity duration-(--duration-fast) group-hover/list:opacity-50 hover:opacity-100! focus-visible:opacity-100! focus-visible:ring-2 focus-visible:ring-ring"
							>
								<span class="font-medium text-foreground">{tag}</span>
								<span class="font-mono text-xs text-muted-foreground tabular-nums">{count}</span>
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</Section>
	{/if}

	<RailRow label="Try it">
		<BrandPanel
			title="Try the ideas in the editor."
			body="Open the browser workspace and compile a document. No account, nothing uploaded."
		>
			{#snippet icon()}
				<IconNews stroke-width={1.5} />
			{/snippet}
			{#snippet actions()}
				<Button href={resolve('/workspace')} variant="dark">Open the workspace</Button>
				<Button href={resolve('/docs')} variant="outline">Read the docs</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
