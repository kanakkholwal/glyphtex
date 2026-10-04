<script lang="ts">
	import { resolve } from "$app/paths";
	import TemplateGallery from "$lib/landing/TemplateGallery.svelte";
	import { REPO_URL } from "$lib/landing/nav-data";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow, Section } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { IconBrandGithub, IconTemplate } from "@tabler/icons-svelte";

	let { data } = $props();

	const sourced = $derived(data.templates.filter((t) => t.origin === "overleaf"));
	const authors = $derived(new Set(sourced.map((t) => t.author)).size);

	const credits = [
		{
			title: "Named on every card",
			body: "Author, licence and a link to the original page, before you use it."
		},
		{
			title: "Kept in your project",
			body: "New projects include a TEMPLATE-LICENSE.md, so the credit travels when you share."
		},
		{
			title: "Changes disclosed",
			body: "The only change to a sourced template is swapping missing images for labelled boxes, and it is noted."
		}
	];
</script>

<Seo
	title="LaTeX templates that compile offline · GlyphTeX"
	description="Free LaTeX templates for theses, journal articles, CVs, letters, posters and slides. Each one compiles offline in GlyphTeX and credits its author."
	canonical="/templates"
/>

<RailFrame>
	<RailRow divider={false} label="Templates" section="templates_hero">
		<PageHero
			badge={`${data.templates.length} templates`}
			title="Start from a template"
			accent="that already compiles."
			lede="Theses, papers, CVs, letters, posters and slides. Some come from the Overleaf community gallery with their author's credit; the rest were written for GlyphTeX and are free to use. Every one compiled offline before it was listed."
		/>
	</RailRow>

	<Section id="gallery" number={1} title="all templates." section="templates_gallery">
		<TemplateGallery templates={data.templates} />
	</Section>

	<Section
		id="credits"
		number={2}
		title="credit where it's due."
		description={`${authors} community authors wrote ${sourced.length} of these, shared under licences that allow reuse. The rest were written for GlyphTeX and dedicated to the public domain.`}
		section="templates_credits"
	>
		<ul class="grid gap-x-10 sm:grid-cols-3">
			{#each credits as c (c.title)}
				<li class="border-t border-dashed border-border py-5">
					<h3 class="text-sm font-medium text-foreground">{c.title}</h3>
					<p class="mt-1 text-sm text-pretty text-muted-foreground">{c.body}</p>
				</li>
			{/each}
		</ul>
	</Section>

	<RailRow label="Get started" section="templates_cta">
		<BrandPanel
			title="Or start from a blank page."
			body="Every template opens in the workspace, in your browser, with nothing uploaded."
		>
			{#snippet icon()}
				<IconTemplate aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				<Button href={resolve("/workspace")} variant="dark">Open the workspace</Button>
				<Button
					href="{REPO_URL}/blob/main/packages/ui/src/lib/project-templates/ATTRIBUTION.md"
					target="_blank"
					rel="noopener noreferrer"
					variant="outline"
				>
					Full attribution list
					<IconBrandGithub />
				</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
