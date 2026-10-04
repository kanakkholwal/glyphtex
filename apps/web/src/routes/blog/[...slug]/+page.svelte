<script lang="ts">
	import { resolve } from "$app/paths";
	import { ArticleBody, AuthorCard, Toc } from "$lib/content";
	import PostCard from "$lib/content/PostCard.svelte";
	import { articleLd, breadcrumbLd, faqLd, serialise } from "$lib/seo/jsonld";
	import { AUTHOR } from "$lib/seo/site";
	import { ogImageUrl } from "$lib/seo/og";
	import Seo from "$lib/seo/Seo.svelte";
	import { RailFrame, RailRow, Section, Well } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { IconArrowLeft, IconArrowRight } from "@tabler/icons-svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const dateLabel = $derived(
		data.meta.date
			? new Date(`${data.meta.date}T00:00:00Z`).toLocaleDateString("en-GB", {
					day: "numeric",
					month: "long",
					year: "numeric"
				})
			: ""
	);

	const jsonld = $derived(
		[
			serialise(
				articleLd({
					type: "BlogPosting",
					title: data.meta.title,
					description: data.meta.description,
					url: data.meta.url,
					image: ogImageUrl(data.meta.url),
					published: data.meta.date,
					modified: data.meta.updated,
					tags: data.meta.tags
				})
			),
			serialise(
				breadcrumbLd([
					{ name: "Home", url: "/" },
					{ name: "Blog", url: "/blog" },
					{ name: data.meta.title, url: data.meta.url }
				])
			),
			data.faq.length ? serialise(faqLd(data.faq)!) : null
		].filter((v): v is string => !!v)
	);

	const quiet =
		"rounded-sm outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring";
</script>

<Seo
	title={data.meta.title}
	description={data.meta.description}
	canonical={data.meta.url}
	type="article"
	published={data.meta.date}
	modified={data.meta.updated ?? data.meta.date}
	section={data.meta.category}
	tags={data.meta.tags}
	{jsonld}
/>

<RailFrame>
	<RailRow divider={false} label="Article" class="pb-16">
		<div class="flex flex-col gap-10">
			<header class="flex flex-col">
				<a
					href={resolve('/blog')}
					class="flex w-fit items-center gap-1.5 rounded-sm font-mono text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
				>
					<IconArrowLeft class="size-3.5" aria-hidden="true" />
					All articles
				</a>
				<p
					class="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground tabular-nums"
				>
					<span>{data.meta.category}</span>
					{#if dateLabel}<span aria-hidden="true">·</span><time datetime={data.meta.date}>{dateLabel}</time>{/if}
					<span aria-hidden="true">·</span><span>{data.readingMinutes} min read</span>
				</p>
				<h1 class="pixel mt-4 text-4xl text-balance text-foreground">{data.meta.title}</h1>
				<p class="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
					{data.meta.description}
				</p>
				<p class="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
					<!-- SVG avatar: @unpic/svelte is for raster images. -->
					<img
						src={AUTHOR.avatar}
						alt=""
						width="32"
						height="32"
						class="size-8 rounded-full border border-border object-cover"
					/>
					<span>By <a href={resolve('/about')} class="{quiet} font-medium text-foreground">{AUTHOR.name}</a></span>
				</p>
			</header>


			<div class="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_15rem]">
				<div class="min-w-0">
					<article>
						<ArticleBody content={data.content} />
					</article>

					{#if data.meta.tags.length}
						<div class="mt-12 flex flex-wrap items-baseline gap-x-4 gap-y-2">
							<span class="font-mono text-xs text-muted-foreground">Topics</span>
							<ul class="group/list flex flex-wrap gap-x-4 gap-y-2" aria-label="Topics">
								{#each data.meta.tags as tag (tag)}
									<li>
										<a
											href="/blog/tag/{encodeURIComponent(tag)}"
											class="rounded-sm font-mono text-xs text-foreground underline-offset-4 outline-none transition-opacity duration-(--duration-fast) group-hover/list:opacity-50 hover:underline hover:opacity-100! focus-visible:opacity-100! focus-visible:ring-2 focus-visible:ring-ring"
										>
											{tag}
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<div class="mt-8">
						<AuthorCard />
					</div>
				</div>

				<aside class="flex flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
					<div class="hidden lg:block">
						<Toc headings={data.headings} />
					</div>
					<Well bodyClass="flex flex-col gap-3 p-4">
						<p class="text-sm font-medium text-foreground">Try it now</p>
						<p class="text-sm text-muted-foreground">
							Compile LaTeX in your browser. No account, nothing uploaded.
						</p>
						<Button href={resolve('/workspace')} variant="default" size="sm" class="w-full">
							Open the workspace
							<IconArrowRight />
						</Button>
					</Well>
				</aside>
			</div>
		</div>
	</RailRow>

	{#if data.related.length}
		<Section id="keep-reading" title="keep reading.">
			<ul class="group/list flex flex-col">
				{#each data.related as post (post.slug)}
					<li><PostCard {post} /></li>
				{/each}
			</ul>
		</Section>
	{/if}
</RailFrame>
