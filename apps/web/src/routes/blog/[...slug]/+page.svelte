<script lang="ts">
	import { resolve } from "$app/paths";
	import { ArticleBody, AuthorCard, Toc } from "$lib/content";
	import PostCard from "$lib/content/PostCard.svelte";
	import { Container } from "$lib/landing";
	import { articleLd, breadcrumbLd, faqLd, serialise } from "$lib/seo/jsonld";
	import { AUTHOR } from "$lib/seo/site";
	import Seo from "$lib/seo/Seo.svelte";
	import SiteFooter from "$lib/SiteFooter.svelte";
	import SiteHeader from "$lib/SiteHeader.svelte";
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
					image: data.meta.hero,
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
</script>

<Seo
	title={data.meta.title}
	description={data.meta.description}
	canonical={data.meta.url}
	image={data.meta.hero}
	type="article"
	{jsonld}
/>

<SiteHeader />

<main id="main">
	<article>
		<Container size="narrow" class="pt-32 md:pt-36">
			<a
				href="/blog"
				class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<IconArrowLeft class="size-4" stroke-width={2} />
				All articles
			</a>

			<div class="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
				<span class="font-medium text-foreground">{data.meta.category}</span>
				{#if dateLabel}<span aria-hidden="true">·</span><time datetime={data.meta.date}>{dateLabel}</time>{/if}
				<span aria-hidden="true">·</span><span>{data.readingMinutes} min read</span>
			</div>

			<h1
				class="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-[2.75rem]"
			>
				{data.meta.title}
			</h1>
			<p class="mt-5 text-xl leading-relaxed text-muted-foreground">{data.meta.description}</p>

			<div class="mt-6 flex items-center gap-3">
				<img
					src={AUTHOR.avatar}
					alt={AUTHOR.name}
					width="36"
					height="36"
					class="size-9 rounded-full border border-hairline object-cover"
				/>
				<span class="text-sm text-muted-foreground">
					By <span class="font-medium text-foreground">{AUTHOR.name}</span>
				</span>
			</div>
		</Container>

		{#if data.meta.hero}
			<Container size="narrow" class="mt-10">
				<img
					src={data.meta.hero}
					alt={data.meta.heroAlt ?? data.meta.title}
					class="aspect-[16/9] w-full rounded-2xl border border-hairline object-cover"
					fetchpriority="high"
				/>
			</Container>
		{/if}

		<Container size="wide" class="mt-12 pb-8">
			<div class="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12">
				<div class="mx-auto w-full max-w-2xl lg:mx-0">
					<ArticleBody content={data.content} />

					<div class="mt-14 border-t border-hairline pt-8">
						<AuthorCard />
					</div>

					{#if data.meta.tags.length}
						<div class="mt-8 flex flex-wrap gap-2">
							{#each data.meta.tags as tag (tag)}
								<a
									href="/blog/tag/{encodeURIComponent(tag)}"
									class="rounded-full border border-hairline px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
								>#{tag}</a>
							{/each}
						</div>
					{/if}
				</div>

				<aside class="hidden lg:block">
					<div class="sticky top-28">
						<Toc headings={data.headings} />
						<div class="mt-8 rounded-xl border border-hairline bg-surface-soft p-5">
							<p class="text-sm font-semibold text-foreground">Try it now</p>
							<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
								Compile LaTeX in your browser. No account.
							</p>
							<Button href={resolve('/workspace')} size="sm" class="mt-3 w-full">
								Open the workspace
								<IconArrowRight class="size-4" stroke-width={2} />
							</Button>
						</div>
					</div>
				</aside>
			</div>
		</Container>
	</article>

	{#if data.related.length}
		<Container size="wide" class="border-t border-hairline py-16">
			<h2 class="text-xl font-semibold tracking-tight text-foreground">Keep reading</h2>
			<div class="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.related as post (post.slug)}
					<PostCard {post} />
				{/each}
			</div>
		</Container>
	{/if}
</main>

<SiteFooter />
