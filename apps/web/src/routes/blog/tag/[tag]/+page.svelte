<script lang="ts">
	import PostCard from "$lib/content/PostCard.svelte";
	import { breadcrumbLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { PageHero, RailFrame, RailRow } from "$lib/site";
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

	<RailRow label="Articles">
		<div class="flex flex-col gap-6 px-1 py-6 sm:px-4 sm:py-8 lg:px-16">
			<nav aria-label="Topics" class="flex flex-col gap-2">
				<h2 class="text-caption font-medium text-muted-foreground">Topics</h2>
				<ul class="flex flex-wrap gap-2">
					{#each data.tags as { tag, count } (tag)}
						{@const current = tag === data.tag}
						<li>
							<a
								href="/blog/tag/{encodeURIComponent(tag)}"
								aria-current={current ? "page" : undefined}
								class={[
									'flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-body outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring',
									current
										? 'border-primary bg-primary/10 font-medium text-foreground'
										: 'border-border bg-card text-foreground hover:bg-muted dark:bg-background'
								]}
							>
								{#if current}<span class="sr-only">Current topic:</span>{/if}
								{tag}
								<span class="text-caption tabular-nums text-muted-foreground">{count}</span>
							</a>
						</li>
					{/each}
				</ul>
			</nav>

			<h2 class="pt-2 text-heading-sm font-medium text-foreground">Articles</h2>
			<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.posts as post (post.slug)}
					<li><PostCard {post} /></li>
				{/each}
			</ul>
		</div>
	</RailRow>
</RailFrame>
