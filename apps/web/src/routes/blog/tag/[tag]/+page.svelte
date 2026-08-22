<script lang="ts">
	import PostCard from "$lib/content/PostCard.svelte";
	import { Container, Section } from "$lib/landing";
	import { breadcrumbLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import SiteFooter from "$lib/SiteFooter.svelte";
	import SiteHeader from "$lib/SiteHeader.svelte";
	import { Chip } from "@glyphtex/ui/chip";
	import { IconArrowLeft } from "@tabler/icons-svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const description = $derived(
		`${data.posts.length} article${data.posts.length === 1 ? "" : "s"} on ${data.tag} in GlyphTeX: local-first LaTeX, compiled on your own machine.`
	);
	const crumbLd = $derived(
		serialise(
			breadcrumbLd([
				{ name: "Home", url: "/" },
				{ name: "Blog", url: "/blog" },
				{ name: data.tag, url: `/blog/tag/${data.tag}` }
			])
		)
	);
</script>

<Seo
	title={`${data.tag} articles`}
	{description}
	canonical={`/blog/tag/${encodeURIComponent(data.tag)}`}
	jsonld={[crumbLd]}
/>

<SiteHeader />

<main id="main">
	<Section spacing="tight" class="pt-32 md:pt-36">
		<Container>
			<a
				href="/blog"
				class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<IconArrowLeft class="size-4" stroke-width={2} />
				All articles
			</a>
			<h1 class="mt-6 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
				#{data.tag}
			</h1>
			<p class="mt-4 text-lg text-muted-foreground">{description}</p>

			<div class="mt-8 flex flex-wrap gap-2">
				{#each data.tags as { tag, count } (tag)}
					<a href="/blog/tag/{encodeURIComponent(tag)}">
						<Chip label={`${tag} (${count})`} selected={tag === data.tag} />
					</a>
				{/each}
			</div>
		</Container>
	</Section>

	<Section spacing="none" class="pb-24">
		<Container>
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.posts as post (post.slug)}
					<PostCard {post} />
				{/each}
			</div>
		</Container>
	</Section>
</main>

<SiteFooter />
