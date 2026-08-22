<script lang="ts">
	import { Container, Section } from "$lib/landing";
	import { breadcrumbLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import SiteFooter from "$lib/SiteFooter.svelte";
	import SiteHeader from "$lib/SiteHeader.svelte";
	import { Eyebrow } from "@glyphtex/ui/eyebrow";
	import { IconArrowUpRight } from "@tabler/icons-svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const description =
		"Practical LaTeX documentation: fix compile errors, structure a thesis, manage figures and bibliographies, all compiled locally in GlyphTeX.";
	const crumbLd = serialise(
		breadcrumbLd([
			{ name: "Home", url: "/" },
			{ name: "Docs", url: "/docs" }
		])
	);
</script>

<Seo title="GlyphTeX Docs" {description} canonical="/docs" jsonld={[crumbLd]} />

<SiteHeader />

<main id="main">
	<Section spacing="tight" class="pt-32 md:pt-36">
		<Container>
			<Eyebrow variant="muted">Documentation</Eyebrow>
			<h1 class="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
				LaTeX, without the guesswork
			</h1>
			<p class="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{description}</p>
		</Container>
	</Section>

	<Section spacing="none" class="pb-24">
		<Container>
			<div class="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
				{#each data.groups as group (group.category)}
					<div>
						<h2 class="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
							{group.category}
						</h2>
						<ul class="mt-4 space-y-3">
							{#each group.items as item (item.slug)}
								<li>
									<a
										href={item.url}
										class="group flex items-start justify-between gap-3 rounded-xl border border-hairline bg-surface-card p-4 transition-colors hover:border-foreground/25"
									>
										<span>
											<span class="block font-medium text-foreground">{item.title}</span>
											<span class="mt-1 block text-sm leading-relaxed text-muted-foreground">
												{item.description}
											</span>
										</span>
										<IconArrowUpRight
											class="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
											stroke-width={2}
										/>
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		</Container>
	</Section>
</main>

<SiteFooter />
