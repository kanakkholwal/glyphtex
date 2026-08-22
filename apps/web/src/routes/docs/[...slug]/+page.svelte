<script lang="ts">
	import { ArticleBody, Toc } from "$lib/content";
	import DocsNav from "$lib/content/DocsNav.svelte";
	import { Container } from "$lib/landing";
	import { articleLd, breadcrumbLd, faqLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import SiteFooter from "$lib/SiteFooter.svelte";
	import SiteHeader from "$lib/SiteHeader.svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const updatedLabel = $derived(
		data.meta.updated
			? new Date(`${data.meta.updated}T00:00:00Z`).toLocaleDateString("en-GB", {
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
					type: "TechArticle",
					title: data.meta.title,
					description: data.meta.description,
					url: data.meta.url,
					modified: data.meta.updated
				})
			),
			serialise(
				breadcrumbLd([
					{ name: "Home", url: "/" },
					{ name: "Docs", url: "/docs" },
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
	type="article"
	modified={data.meta.updated}
	section={data.meta.category}
	{jsonld}
/>

<SiteHeader />

<main id="main">
	<Container size="wide" class="pt-28 pb-24 md:pt-32">
		<div class="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)_14rem] lg:gap-10">
			<aside class="hidden lg:block">
				<div class="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pb-8">
					<DocsNav groups={data.groups} />
				</div>
			</aside>

			<article class="mx-auto w-full max-w-2xl lg:mx-0">
				<p class="text-sm font-medium text-brand">{data.meta.category}</p>
				<h1
					class="mt-2 text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-4xl"
				>
					{data.meta.title}
				</h1>
				<p class="mt-4 text-lg leading-relaxed text-muted-foreground">{data.meta.description}</p>
				{#if updatedLabel}
					<p class="mt-3 text-sm text-muted-foreground">Updated {updatedLabel}</p>
				{/if}

				<div class="mt-10">
					<ArticleBody content={data.content} />
				</div>
			</article>

			<aside class="hidden lg:block">
				<div class="sticky top-28">
					<Toc headings={data.headings} />
				</div>
			</aside>
		</div>
	</Container>
</main>

<SiteFooter />
