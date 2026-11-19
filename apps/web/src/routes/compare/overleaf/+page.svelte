<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import ImportDropzone from "$lib/landing/ImportDropzone.svelte";
	import { breadcrumbLd, faqLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, FaqList, PageHero, RailFrame, RailRow, Section } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { IconArrowRight, IconCheck, IconMinus, IconSwitchHorizontal } from "@tabler/icons-svelte";

	type Mark = "yes" | "partial" | "no";
	type Cell = { mark: Mark; text: string };
	type Row = { feature: string; glyph: Cell; overleaf: Cell };

	const rows: Row[] = [
		{
			feature: "Where it compiles",
			glyph: { mark: "yes", text: "In your browser tab, or with the free glyphtex CLI" },
			overleaf: { mark: "partial", text: "On Overleaf's servers" }
		},
		{
			feature: "Needs an account",
			glyph: { mark: "yes", text: "No, the editor works without one" },
			overleaf: { mark: "no", text: "Yes" }
		},
		{
			feature: "Works offline",
			glyph: { mark: "yes", text: "Yes, after one engine download" },
			overleaf: { mark: "no", text: "No" }
		},
		{
			feature: "Where your files live",
			glyph: { mark: "yes", text: "On your device; server sync is optional" },
			overleaf: { mark: "partial", text: "On Overleaf's servers" }
		},
		{
			feature: "Real-time co-editing",
			glyph: { mark: "partial", text: "Yes, on servers with live editing switched on" },
			overleaf: { mark: "yes", text: "Yes" }
		},
		{
			feature: "Comments and suggested edits",
			glyph: { mark: "yes", text: "Yes, on cloud projects" },
			overleaf: { mark: "yes", text: "Yes" }
		},
		{
			feature: "Version history",
			glyph: { mark: "yes", text: "Named versions, diffs and restore on cloud projects" },
			overleaf: { mark: "yes", text: "Yes" }
		},
		{
			feature: "Git",
			glyph: { mark: "yes", text: "GitHub, GitLab and Bitbucket from cloud projects" },
			overleaf: { mark: "partial", text: "Depends on the plan" }
		},
		{
			feature: "Organisation controls",
			glyph: {
				mark: "yes",
				text: "SAML and OIDC single sign-on, SCIM, roles, sharing policy and an audit log with CSV export, on a server you run"
			},
			overleaf: { mark: "yes", text: "Institutional plans" }
		},
		{
			feature: "Self-hosting",
			glyph: { mark: "yes", text: "Cloudflare or Docker, the server is AGPL" },
			overleaf: { mark: "yes", text: "Community Edition and Server Pro" }
		},
		{
			feature: "Full TeX Live and Biber",
			glyph: {
				mark: "partial",
				text: "Bundled packages that keep growing; BibTeX yes, Biber not in the browser"
			},
			overleaf: { mark: "yes", text: "Yes" }
		},
		{
			feature: "AI assistance",
			glyph: { mark: "no", text: "Not yet" },
			overleaf: { mark: "partial", text: "Depends on the plan" }
		}
	];

	const reasons = [
		{
			title: "Privacy by default",
			body: "A draft never leaves your machine unless you save it to a server yourself. That is easy to explain to a supervisor or an ethics board."
		},
		{
			title: "Nothing to log in to",
			body: "Open the page and write. Co-authors and students need an account only when you want to share or sync."
		},
		{
			title: "A server you can run",
			body: "A department can host the optional server on its own infrastructure, with SSO and provisioning, and keep every project in-house."
		},
		{
			title: "Plain files, always",
			body: "A project is a folder of .tex, .bib and images. Export it and it compiles in any TeX install, so you are never locked in."
		}
	];

	const behind = [
		"TeX coverage is by bundled package. Most papers build, but a rare package can be missing, and the editor says which.",
		"Biber needs a full TeX install, so biblatex projects must use backend=bibtex in the browser.",
		"Live co-editing needs a server with it enabled. The offline editor alone is single author.",
		"No AI writing tools yet. They are planned as opt in, reviewable edits, not a default."
	];

	const faqs = [
		{
			q: "Can I move an Overleaf project to GlyphTeX?",
			a: "Yes. Download the project as a .zip from Overleaf, drop it into GlyphTeX, and compile. The files stay plain .tex and .bib, so you can export them again at any time."
		},
		{
			q: "Is GlyphTeX a full replacement for Overleaf?",
			a: "For many papers and theses, yes. Where it differs is listed on this page: package coverage, Biber in the browser, and live editing that needs a server. Check your own project before you commit a deadline to it."
		},
		{
			q: "Is there a free GlyphTeX?",
			a: "The editor is free and open source, and accounts and sync cost nothing at this stage. The server is optional and self-hostable."
		},
		{
			q: "Can my whole department use it?",
			a: "Yes. There are no seats or licence keys. For shared projects, sign-in, organisations and SSO, run the optional server and point your users at it."
		}
	];

	const jsonld = [
		serialise(
			breadcrumbLd([
				{ name: "Home", url: "/" },
				{ name: "GlyphTeX vs Overleaf", url: "/compare/overleaf" }
			])
		),
		...[faqLd(faqs)].filter((ld) => ld !== null).map((ld) => serialise(ld))
	];

	const label: Record<Mark, string> = { yes: "Yes", partial: "Partly", no: "No" };
</script>

<Seo
	title="GlyphTeX vs Overleaf: an honest comparison"
	description="Compare GlyphTeX and Overleaf: offline compiling, privacy, collaboration, Git, SSO and self-hosting, including where GlyphTeX is still behind."
	canonical="/compare/overleaf"
	{jsonld}
/>

{#snippet mark(cell: Cell)}
	<span class="flex items-start gap-2">
		<span
			class="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
			class:bg-foreground={cell.mark === "yes"}
			class:text-background={cell.mark === "yes"}
		>
			{#if cell.mark === "yes"}
				<IconCheck class="size-3" aria-hidden="true" />
			{:else if cell.mark === "partial"}
				<IconMinus class="size-3" aria-hidden="true" />
			{/if}
			<span class="sr-only">{label[cell.mark]}</span>
		</span>
		<span class="text-pretty text-foreground">{cell.text}</span>
	</span>
{/snippet}

<RailFrame>
	<RailRow divider={false} label="Comparison">
		<PageHero
			badge="compare"
			title="GlyphTeX or Overleaf,"
			accent="side by side."
			lede="Overleaf is mature and does collaboration very well. GlyphTeX keeps your writing on your own machine, and adds sharing and sync only when you ask for them. Here is where each one stands."
		>
			{#snippet actions()}
				<Button
					href={resolve('/workspace')}
					size="lg"
					onclick={() => track('cta_clicked', { target: 'workspace', location: 'compare_hero' })}
				>
					Open the editor
					<IconArrowRight />
				</Button>
				<Button href="#table" variant="outline" size="lg">See the table</Button>
			{/snippet}
		</PageHero>
	</RailRow>

	<Section
		id="table"
		number={1}
		title="feature by feature."
		description="Overleaf entries reflect its public documentation and change with its plans, so check them before you decide."
		section="compare_table"
	>
		<div class="overflow-x-auto">
			<table class="w-full border-collapse text-left text-sm max-sm:block">
				<caption class="sr-only">GlyphTeX compared with Overleaf</caption>
				<thead class="max-sm:sr-only">
					<tr class="border-b border-border font-mono text-xs text-muted-foreground">
						<th scope="col" class="w-1/4 py-3 pr-4 font-normal">Feature</th>
						<th scope="col" class="w-[37.5%] py-3 pr-4 font-normal text-accent-ink">GlyphTeX</th>
						<th scope="col" class="w-[37.5%] py-3 font-normal">Overleaf</th>
					</tr>
				</thead>
				<tbody class="max-sm:block">
					{#each rows as r (r.feature)}
						<tr class="border-b border-dashed border-border align-top max-sm:block max-sm:py-4">
							<th scope="row" class="py-4 pr-4 font-medium text-foreground max-sm:block max-sm:pt-0 max-sm:pb-2">{r.feature}</th>
							<td data-label="GlyphTeX" class="py-4 pr-4 max-sm:block max-sm:py-1 max-sm:before:mb-0.5 max-sm:before:block max-sm:before:font-mono max-sm:before:text-xs max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]">{@render mark(r.glyph)}</td>
							<td data-label="Overleaf" class="py-4 max-sm:block max-sm:py-1 max-sm:before:mb-0.5 max-sm:before:block max-sm:before:font-mono max-sm:before:text-xs max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]">{@render mark(r.overleaf)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Section>

	<Section
		id="reasons"
		number={2}
		title="why people switch."
		description="The things GlyphTeX was built around."
		section="compare_reasons"
	>
		<ul class="grid gap-x-10 sm:grid-cols-2">
			{#each reasons as r (r.title)}
				<li class="border-t border-dashed border-border py-5">
					<h3 class="text-sm font-medium text-foreground">{r.title}</h3>
					<p class="mt-1 text-sm text-pretty text-muted-foreground">{r.body}</p>
				</li>
			{/each}
		</ul>
	</Section>

	<Section
		id="behind"
		number={3}
		title="where it is behind."
		description="Worth knowing before you move a deadline project."
		section="compare_behind"
	>
		<ul class="flex flex-col">
			{#each behind as b (b)}
				<li class="border-t border-dashed border-border py-4 text-sm text-pretty text-muted-foreground">
					{b}
				</li>
			{/each}
		</ul>
	</Section>

	<Section
		id="try"
		number={4}
		title="try your own project."
		description="Drop an Overleaf .zip. It compiles here, in the tab, and nothing is uploaded."
		section="compare_try"
	>
		<ImportDropzone />
	</Section>

	<Section id="faq" number={5} title="questions." section="compare_faq">
		<FaqList items={faqs} />
	</Section>

	<RailRow label="Next step">
		<BrandPanel
			title="Keep the paper on your machine."
			body="Free, open source, and no account to create."
		>
			{#snippet icon()}
				<IconSwitchHorizontal aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				<Button
					href={resolve('/workspace')}
					variant="dark"
					onclick={() => track('cta_clicked', { target: 'workspace', location: 'compare_final' })}
				>
					Open the editor
				</Button>
				<Button href={resolve('/developers/self-hosting')} variant="outline">Self-hosting guide</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
