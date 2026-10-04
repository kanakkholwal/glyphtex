<script lang="ts">
	import PostCard from "$lib/content/PostCard.svelte";
	import { breadcrumbLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { PageHero, RailFrame, RailRow, Section } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
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

<RailFrame>
	<RailRow divider={false} label="Topic">
		<PageHero badge="Topic" title="Articles on" accent={data.tag} lede={description}>
			{#snippet actions()}
				<Button href="/blog" variant="outline">
					<IconArrowLeft />
					All articles
				</Button>
			{/snippet}
		</PageHero>
	</RailRow>

	<Section id="articles" number={1} title="articles.">
		<ul class="group/list flex flex-col">
			{#each data.posts as post (post.slug)}
				<li><PostCard {post} /></li>
			{/each}
		</ul>
	</Section>

	<Section id="topics" number={2} title="other topics.">
		<nav aria-label="Topics">
			<ul class="flex flex-wrap gap-1.5">
				{#each data.tags as { tag, count } (tag)}
					{@const current = tag === data.tag}
					<li>
						<a
							href="/blog/tag/{encodeURIComponent(tag)}"
							aria-current={current ? 'page' : undefined}
							class={[
								'flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm outline-none transition-colors duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-ring',
								current
									? 'border-transparent bg-primary text-primary-foreground'
									: 'border-border text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground'
							]}
						>
							{#if current}<span class="sr-only">Current topic:</span>{/if}
							{tag}
							<span class="font-mono text-xs tabular-nums">{count}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</Section>
</RailFrame>
