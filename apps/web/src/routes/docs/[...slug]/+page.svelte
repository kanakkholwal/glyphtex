<script lang="ts">
	import { ArticleBody, Toc } from "$lib/content";
	import DocsNav from "$lib/content/DocsNav.svelte";
	import { articleLd, breadcrumbLd, faqLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { RailFrame, RailRow } from "$lib/site";
	import { IconChevronDown } from "@tabler/icons-svelte";
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

<RailFrame>
	<RailRow divider={false} label="Documentation" class="px-3 pt-28 pb-12 sm:px-6 sm:pt-32">
		<div
			class="grid grid-cols-1 gap-10 px-1 sm:px-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[15rem_minmax(0,1fr)_14rem]"
		>
			<aside class="hidden lg:block">
				<div class="sticky top-28 max-h-[calc(100svh-8rem)] overflow-y-auto pb-8">
					<DocsNav groups={data.groups} />
				</div>
			</aside>

			<article class="min-w-0">
				<details class="group panel-card mb-8 lg:hidden">
					<summary
						class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 text-body font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
					>
						Browse the docs
						<IconChevronDown
							class="size-4 text-muted-foreground transition-transform duration-300 ease-craft group-open:rotate-180"
							aria-hidden="true"
						/>
					</summary>
					<div class="border-t border-border p-2">
						<DocsNav groups={data.groups} />
					</div>
				</details>

				<header class="flex max-w-3xl flex-col">
					<p class="text-caption font-medium text-primary">{data.meta.category}</p>
					<h1 class="mt-2 text-balance text-heading-lg font-medium text-foreground md:text-display">
						{data.meta.title}
					</h1>
					<p class="mt-4 text-pretty text-body-lg text-muted-foreground">{data.meta.description}</p>
					{#if updatedLabel}
						<p class="mt-3 text-caption text-muted-foreground">
							Updated <time datetime={data.meta.updated}>{updatedLabel}</time>
						</p>
					{/if}
				</header>

				<div class="mt-10">
					<ArticleBody content={data.content} />
				</div>
			</article>

			<aside class="hidden xl:block">
				<div class="sticky top-28">
					<Toc headings={data.headings} />
				</div>
			</aside>
		</div>
	</RailRow>
</RailFrame>
