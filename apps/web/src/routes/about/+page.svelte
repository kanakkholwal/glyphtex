<script lang="ts">
	import { Container, Section } from "$lib/landing";
	import { breadcrumbLd, personLd, serialise } from "$lib/seo/jsonld";
	import { AUTHOR } from "$lib/seo/site";
	import Seo from "$lib/seo/Seo.svelte";
	import SiteFooter from "$lib/SiteFooter.svelte";
	import SiteHeader from "$lib/SiteHeader.svelte";
	import { Button } from "@glyphtex/ui/button";
	import { Eyebrow } from "@glyphtex/ui/eyebrow";
	import {
		IconArrowRight,
		IconBrandGithub,
		IconBrandLinkedin,
		IconBrandX
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

<SiteHeader />

<main id="main">
	<Section spacing="tight" class="pt-32 md:pt-36">
		<Container size="narrow">
			<Eyebrow variant="muted">About the author</Eyebrow>

			<div class="mt-8 flex items-center gap-5">
				<img
					src={AUTHOR.avatar}
					alt={AUTHOR.name}
					width="72"
					height="72"
					class="size-18 rounded-full border border-hairline object-cover"
				/>
				<div>
					<h1 class="text-3xl font-semibold tracking-tight text-foreground">{AUTHOR.name}</h1>
					<p class="mt-1 text-muted-foreground">{AUTHOR.role}</p>
				</div>
			</div>

			<div class="mt-8 space-y-4 text-lg leading-relaxed text-muted-foreground">
				<p>{AUTHOR.bio}</p>
				<p>
					GlyphTeX exists to keep academic writing on the writer's own machine. It compiles LaTeX in
					the browser through a Tectonic engine built to WebAssembly, and in a desktop app for full
					offline work, with no account and nothing uploaded.
				</p>
				<p>
					The articles and documentation here are written from building that toolchain, so the fixes
					and comparisons come from real compiles rather than generic advice.
				</p>
			</div>

			<div class="mt-8 flex flex-wrap gap-3">
				{#each links as link (link.label)}
					<a
						href={link.href}
						target="_blank"
						rel="noopener"
						class="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						<link.icon class="size-4" stroke-width={1.75} />
						{link.label}
					</a>
				{/each}
			</div>

			<div class="mt-10 flex flex-wrap gap-3">
				<Button href="/workspace">
					Open the workspace
					<IconArrowRight class="size-4" stroke-width={2} />
				</Button>
				<Button href="/blog" variant="outline">Read the blog</Button>
			</div>
		</Container>
	</Section>
</main>

<SiteFooter />
