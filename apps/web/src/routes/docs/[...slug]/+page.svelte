<script lang="ts">
	import { resolve } from "$app/paths";
	import { ArticleBody, Toc } from "$lib/content";
	import DocsNav from "$lib/content/DocsNav.svelte";
	import { articleLd, breadcrumbLd, faqLd, serialise } from "$lib/seo/jsonld";
	import { ogImageUrl } from "$lib/seo/og";
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
					image: ogImageUrl(data.meta.url),
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
	<RailRow divider={false} label="Documentation" class="pb-16">
		<div
			class="grid grid-cols-1 gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[14rem_minmax(0,1fr)_13rem]"
		>
			<aside class="hidden lg:block">
				<div class="sticky top-24 max-h-[calc(100svh-7rem)] overflow-y-auto pb-8">
					<DocsNav groups={data.groups} />
				</div>
			</aside>

			<article class="min-w-0">
				<details class="group mb-8 rounded-xl border border-border lg:hidden">
					<summary
						class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 text-sm font-medium text-foreground outline-none transition-colors duration-(--duration-fast) hover:bg-foreground/[0.03] focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
					>
						Browse the docs
						<IconChevronDown
							class="size-4 text-muted-foreground transition-transform duration-(--duration-base) ease-(--ease-out) group-open:rotate-180"
							aria-hidden="true"
						/>
					</summary>
					<div class="border-t border-dashed border-border p-2">
						<DocsNav groups={data.groups} />
					</div>
				</details>

				<header class="flex flex-col">
					<nav aria-label="Breadcrumb" class="font-mono text-xs text-muted-foreground">
						<ol class="flex flex-wrap items-center gap-1.5">
							<li>
								<a
									href={resolve('/docs')}
									class="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
								>
									Docs
								</a>
							</li>
							<li aria-hidden="true">/</li>
							<li>{data.meta.category}</li>
						</ol>
					</nav>
					<h1 class="pixel mt-4 text-4xl text-balance text-foreground">{data.meta.title}</h1>
					<p class="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
						{data.meta.description}
					</p>
					{#if updatedLabel}
						<p class="mt-4 font-mono text-xs text-muted-foreground tabular-nums">
							Updated <time datetime={data.meta.updated}>{updatedLabel}</time>
						</p>
					{/if}
				</header>

				<div class="mt-10">
					<ArticleBody content={data.content} />
				</div>
			</article>

			<aside class="hidden xl:block">
				<div class="sticky top-24">
					<Toc headings={data.headings} />
				</div>
			</aside>
		</div>
	</RailRow>
</RailFrame>
