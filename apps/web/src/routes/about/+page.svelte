<script lang="ts">
	import { resolve } from "$app/paths";
	import { breadcrumbLd, personLd, serialise } from "$lib/seo/jsonld";
	import { AUTHOR } from "$lib/seo/site";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow, SplitSection } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import {
		IconBrandGithub,
		IconBrandLinkedin,
		IconBrandX,
		IconWriting
	} from "@tabler/icons-svelte";

	const links = [
		{ icon: IconBrandGithub, href: AUTHOR.sameAs[0], label: "GitHub" },
		{ icon: IconBrandX, href: AUTHOR.sameAs[1], label: "X" },
		{ icon: IconBrandLinkedin, href: AUTHOR.sameAs[2], label: "LinkedIn" }
	];

	const description =
		"Kanak Kholwal builds local-first writing tools, including GlyphTeX and the Tectonic WebAssembly engine that compiles LaTeX in the browser.";

	const jsonld = [
		serialise(personLd()),
		serialise(
			breadcrumbLd([
				{ name: "Home", url: "/" },
				{ name: "About", url: "/about" }
			])
		)
	];
</script>

<Seo title="About {AUTHOR.name}" {description} canonical="/about" {jsonld} />

<RailFrame>
	<RailRow divider={false} label="About the author">
		<PageHero badge="About the author" title={AUTHOR.name} accent={AUTHOR.role} lede={AUTHOR.bio}>
			{#snippet actions()}
				{#each links as link (link.label)}
					<Button href={link.href} target="_blank" rel="noopener noreferrer" variant="outline">
						<link.icon aria-hidden="true" />
						{link.label}
					</Button>
				{/each}
			{/snippet}
		</PageHero>
	</RailRow>

	<RailRow label="Why GlyphTeX exists">
		<SplitSection
			title="Why GlyphTeX"
			accent="exists"
			description="Academic writing should stay on the writer's own machine."
		>
			<div class="panel-card flex flex-col gap-5 p-6 sm:flex-row sm:p-8">
				<!-- SVG avatar: @unpic/svelte is for raster images. -->
				<img
					src={AUTHOR.avatar}
					alt=""
					width="72"
					height="72"
					class="size-18 shrink-0 rounded-full border border-border object-cover"
				/>
				<div class="flex max-w-2xl flex-col gap-4 text-pretty text-body text-muted-foreground md:text-body-lg">
					<p>
						GlyphTeX compiles LaTeX in the browser through a Tectonic engine built to WebAssembly.
						Once the engine is downloaded it works offline, with no account and nothing uploaded.
						A desktop app exists as an early prototype and is not maintained yet.
					</p>
					<p>
						The articles and documentation here are written from building that toolchain, so the
						fixes and comparisons come from real compiles rather than generic advice.
					</p>
				</div>
			</div>
		</SplitSection>
	</RailRow>

	<RailRow label="Next step">
		<BrandPanel
			title="Write your next paper locally."
			body="Free, open source, and no account to create."
		>
			{#snippet icon()}
				<IconWriting class="size-10" stroke-width={1.5} aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				<Button href={resolve('/workspace')} variant="ink">Open the workspace</Button>
				<Button href={resolve('/blog')} variant="light">Read the blog</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
