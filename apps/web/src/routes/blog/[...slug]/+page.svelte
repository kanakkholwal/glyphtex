<script lang="ts">
	import { resolve } from "$app/paths";
	import { ArticleBody, AuthorCard, Toc } from "$lib/content";
	import PostCard from "$lib/content/PostCard.svelte";
	import { articleLd, breadcrumbLd, faqLd, serialise } from "$lib/seo/jsonld";
	import { AUTHOR } from "$lib/seo/site";
	import Seo from "$lib/seo/Seo.svelte";
	import { RailFrame, RailRow } from "$lib/site";
	import {
		Breadcrumb,
		BreadcrumbItem,
		BreadcrumbLink,
		BreadcrumbList,
		BreadcrumbPage,
		BreadcrumbSeparator
	} from "@glyphtex/ui/breadcrumb";
	import { Badge } from "@glyphtex/ui/badge";
	import { Button } from "@glyphtex/ui/button";
	import { IconArrowRight } from "@tabler/icons-svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	// Plain, per-post card: title + category on a neutral background, not the article's own art.
	const ogImage = $derived(`/og/blog/${data.meta.slug}`);

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
					image: ogImage,
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
	image={ogImage}
	imageAlt={data.meta.title}
	type="article"
	published={data.meta.date}
	modified={data.meta.updated ?? data.meta.date}
	section={data.meta.category}
	tags={data.meta.tags}
	{jsonld}
/>

<RailFrame>
	<RailRow divider={false} label="Article" class="px-3 pt-28 pb-12 sm:px-6 sm:pt-32">
		<div class="flex flex-col gap-10 px-1 sm:px-4 lg:px-10">
			<header class="flex max-w-3xl flex-col gap-4">
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href="/">Home</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink href="/blog">Blog</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage class="line-clamp-1">{data.meta.title}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<p class="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
					<Badge variant="primary">{data.meta.category}</Badge>
					{#if dateLabel}<span aria-hidden="true">·</span><time datetime={data.meta.date}>{dateLabel}</time>{/if}
					<span aria-hidden="true">·</span><span>{data.readingMinutes} min read</span>
				</p>
				<h1 class="text-balance text-heading-lg font-medium text-foreground md:text-display">
					{data.meta.title}
				</h1>
				<p class="text-pretty text-body-lg text-muted-foreground">{data.meta.description}</p>
				<p class="flex items-center gap-3 text-body text-muted-foreground">
					<!-- SVG avatar: @unpic/svelte is for raster images. -->
					<img
						src={AUTHOR.avatar}
						alt=""
						width="36"
						height="36"
						class="size-9 rounded-full border border-border object-cover"
					/>
					<span>By <a href="/about" class="{quiet} font-medium text-foreground">{AUTHOR.name}</a></span>
				</p>
			</header>

			<div class="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_17rem]">
				<div class="min-w-0">
					<article>
						<ArticleBody content={data.content} />
					</article>

					{#if data.meta.tags.length}
						<ul class="mt-12 flex max-w-3xl flex-wrap gap-2" aria-label="Topics">
							{#each data.meta.tags as tag (tag)}
								<li>
									<a
										href="/blog/tag/{encodeURIComponent(tag)}"
										class="flex min-h-10 items-center rounded-full border border-border bg-card px-3.5 text-body text-foreground outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring dark:bg-background"
									>
										{tag}
									</a>
								</li>
							{/each}
						</ul>
					{/if}

					<div class="mt-8 max-w-3xl">
						<AuthorCard />
					</div>
				</div>

				<aside class="flex flex-col gap-8 lg:sticky lg:top-28 lg:self-start">
					<div class="panel-card flex flex-col gap-3 p-5">
						<p class="text-body-lg font-medium text-foreground">Try it now</p>
						<p class="text-body text-muted-foreground">
							Compile LaTeX in your browser. No account, nothing uploaded.
						</p>
						<Button href={resolve('/workspace')} variant="primary" class="w-full">
							Open the workspace
							<IconArrowRight />
						</Button>
					</div>
					<div class="hidden lg:block">
						<Toc headings={data.headings} />
					</div>
				</aside>
			</div>
		</div>
	</RailRow>

	{#if data.related.length}
		<RailRow label="Keep reading">
			<div class="flex flex-col gap-5 px-1 py-6 sm:px-4 sm:py-8 lg:px-10">
				<h2 class="text-heading-sm font-medium text-foreground">Keep reading</h2>
				<ul class="grid grid-cols-1 gap-3 md:grid-cols-3">
					{#each data.related as post (post.slug)}
						<li><PostCard {post} /></li>
					{/each}
				</ul>
			</div>
		</RailRow>
	{/if}
</RailFrame>
