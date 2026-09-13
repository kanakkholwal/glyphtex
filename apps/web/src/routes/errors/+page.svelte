<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import GuideLauncher from "$lib/landing/GuideLauncher.svelte";
	import { REPO_URL } from "$lib/landing/nav-data";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, RailFrame, RailRow } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { IconBrandGithub, IconLifebuoy } from "@tabler/icons-svelte";

	let { data } = $props();

	// Opens on the error guides when the docs have such a category, otherwise on everything.
	const errorCategory = $derived(
		data.guides.find((g) => g.kind === "docs" && /error|fix/i.test(g.category))?.category ?? "all"
	);
</script>

<Seo
	title="Fix a LaTeX error · GlyphTeX"
	description="Search plain-language fixes for common LaTeX errors: undefined control sequences, missing $ inserted, files not found, bibliographies that will not build."
	canonical="/errors"
/>

<RailFrame>
	<RailRow
		divider={false}
		label="Search LaTeX error guides"
		section="errors_search"
		class="px-3 pt-24 pb-10 sm:px-6 sm:pt-28 sm:pb-14"
	>
		<GuideLauncher guides={data.guides} headingLevel={1} initialCategory={errorCategory} />
	</RailRow>

	<RailRow label="Still stuck" section="errors_cta">
		<BrandPanel
			title="Still stuck on an error?"
			body="Open an issue with the log. Real errors from real documents are how these guides get written."
		>
			{#snippet icon()}
				<IconLifebuoy class="size-10" stroke-width={1.5} aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				<Button
					href="{REPO_URL}/issues/new/choose"
					target="_blank"
					rel="noopener noreferrer"
					variant="ink"
					onclick={() => track('outbound_clicked', { destination: 'github_issues', location: 'errors' })}
				>
					Ask on GitHub
					<IconBrandGithub />
				</Button>
				<Button href={resolve('/docs')} variant="light">Browse all docs</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
