<script lang="ts">
	import { resolve } from "$app/paths";
	import PostCard from "$lib/content/PostCard.svelte";
	import { articleLd, breadcrumbLd, serialise } from "$lib/seo/jsonld";
	import { SITE_URL } from "$lib/seo/site";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow } from "$lib/site";
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
					image: post.hero,
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

	<RailRow label="Articles">
		<div class="flex flex-col gap-6 px-1 py-6 sm:px-4 sm:py-8 lg:px-16">
			{#if data.tags.length}
				<nav aria-label="Topics" class="flex flex-col gap-2">
					<h2 class="text-caption font-medium text-muted-foreground">Browse by topic</h2>
					<ul class="flex flex-wrap gap-2">
						{#each data.tags as { tag, count } (tag)}
							<li>
								<a
									href="/blog/tag/{encodeURIComponent(tag)}"
									class="flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-body text-foreground outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring dark:bg-background"
								>
									{tag}
									<span class="text-caption tabular-nums text-muted-foreground">{count}</span>
								</a>
							</li>
						{/each}
					</ul>
				</nav>
			{/if}

			<h2 class="pt-2 text-heading-sm font-medium text-foreground">Latest articles</h2>
			{#if data.posts.length === 0}
				<p class="panel-card p-6 text-body text-muted-foreground">
					No articles are published yet. The docs cover the editor in the meantime.
				</p>
			{:else}
				<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#if featured}
						<li class="sm:col-span-2 lg:col-span-3">
							<PostCard post={featured} featured />
						</li>
					{/if}
					{#each rest as post (post.slug)}
						<li><PostCard {post} /></li>
					{/each}
				</ul>
			{/if}
		</div>
	</RailRow>

	<RailRow label="Try it">
		<BrandPanel
			title="Try the ideas in the editor."
			body="Open the browser workspace and compile a document. No account, nothing uploaded."
		>
			{#snippet icon()}
				<IconNews class="size-10" stroke-width={1.5} aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				<Button href={resolve('/workspace')} variant="ink">Open the workspace</Button>
				<Button href={resolve('/docs')} variant="light">Read the docs</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
