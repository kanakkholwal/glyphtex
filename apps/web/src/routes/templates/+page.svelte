<script lang="ts">
	import { resolve } from "$app/paths";
	import TemplateGallery from "$lib/landing/TemplateGallery.svelte";
	import { REPO_URL } from "$lib/landing/nav-data";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow, SplitSection } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { IconBrandGithub, IconTemplate } from "@tabler/icons-svelte";

	let { data } = $props();

	const authors = $derived(new Set(data.templates.map((t) => t.author)).size);
</script>

<Seo
	title="LaTeX templates that compile offline · GlyphTeX"
	description="Free LaTeX templates for theses, journal articles, CVs, letters, posters, assignments and slides. Each one compiles in GlyphTeX and credits its original author."
	canonical="/templates"
/>

<RailFrame>
	<RailRow divider={false} label="Templates" section="templates_hero">
		<PageHero
			badge={`${data.templates.length} templates`}
			title="Start from a template"
			accent="that already compiles."
			lede="Theses, papers, CVs, letters, posters and slides from the Overleaf community gallery. Every one was compiled with GlyphTeX's own engine before it was listed, and each keeps its author's credit."
		/>
	</RailRow>

	<RailRow id="gallery" label="Template gallery" section="templates_gallery">
		<div class="px-1 pb-6 sm:px-4 lg:px-16">
			<TemplateGallery templates={data.templates} />
		</div>
	</RailRow>

	<RailRow label="Credits" section="templates_credits">
		<SplitSection
			title="Credit where"
			accent="it's due."
			description={`${authors} authors wrote these. Each template is shared under the licence they chose, all of which allow reuse.`}
		>
			<ul class="grid gap-3 sm:grid-cols-3">
				<li class="panel-card flex flex-col gap-1 p-5">
					<h3 class="text-body-lg font-medium text-foreground">Named on every card</h3>
					<p class="text-body text-muted-foreground">
						Author, licence and a link to the original page, before you use it.
					</p>
				</li>
				<li class="panel-card flex flex-col gap-1 p-5">
					<h3 class="text-body-lg font-medium text-foreground">Kept in your project</h3>
					<p class="text-body text-muted-foreground">
						New projects include a TEMPLATE-LICENSE.md, so the credit travels when you share.
					</p>
				</li>
				<li class="panel-card flex flex-col gap-1 p-5">
					<h3 class="text-body-lg font-medium text-foreground">Changes disclosed</h3>
					<p class="text-body text-muted-foreground">
						The only edit is swapping missing images for labelled boxes, and it is noted.
					</p>
				</li>
			</ul>
		</SplitSection>
	</RailRow>

	<RailRow label="Get started" section="templates_cta">
		<BrandPanel
			title="Or start from a blank page."
			body="Every template opens in the workspace, in your browser, with nothing uploaded."
		>
			{#snippet icon()}
				<IconTemplate class="size-10" stroke-width={1.5} aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				<Button href={resolve("/workspace")} variant="ink">Open the workspace</Button>
				<Button
					href="{REPO_URL}/blob/main/packages/ui/src/lib/project-templates/ATTRIBUTION.md"
					target="_blank"
					rel="noopener noreferrer"
					variant="light"
				>
					Full attribution list
					<IconBrandGithub />
				</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
