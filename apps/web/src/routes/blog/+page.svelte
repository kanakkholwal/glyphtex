<script lang="ts">
	import { Container, Section } from "$lib/landing";
	import PostCard from "$lib/content/PostCard.svelte";
	import SiteFooter from "$lib/SiteFooter.svelte";
	import SiteHeader from "$lib/SiteHeader.svelte";
	import { articleLd, breadcrumbLd, serialise } from "$lib/seo/jsonld";
	import { SITE_URL } from "$lib/seo/site";
	import Seo from "$lib/seo/Seo.svelte";
	import { Chip } from "@glyphtex/ui/chip";
	import { Eyebrow } from "@glyphtex/ui/eyebrow";
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

<SiteHeader />

<main id="main">
	<Section spacing="tight" class="pt-32 md:pt-36">
		<Container>
			<Eyebrow variant="muted">Writing, compiled locally</Eyebrow>
			<h1 class="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
				The GlyphTeX blog
			</h1>
			<p class="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
				{description}
			</p>

			{#if data.tags.length}
				<div class="mt-8 flex flex-wrap gap-2">
					{#each data.tags as { tag, count } (tag)}
						<a href="/blog/tag/{encodeURIComponent(tag)}">
							<Chip label={`${tag} (${count})`} />
						</a>
					{/each}
				</div>
			{/if}
		</Container>
	</Section>

	<Section spacing="none" class="pb-24">
		<Container>
			{#if data.posts.length === 0}
				<p class="text-muted-foreground">No articles yet. Check back soon.</p>
			{:else}
				{#if featured}
					<div class="mb-6">
						<PostCard post={featured} featured />
					</div>
				{/if}
				<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{#each rest as post (post.slug)}
						<PostCard {post} />
					{/each}
				</div>
			{/if}
		</Container>
	</Section>
</main>

<SiteFooter />
