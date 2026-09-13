<script lang="ts">
	import { resolve } from "$app/paths";
	import { track, trackOnce } from "$lib/analytics";
	import FeatureBento from "$lib/landing/FeatureBento.svelte";
	import HeroSection from "$lib/landing/HeroSection.svelte";
	import ImportDropzone from "$lib/landing/ImportDropzone.svelte";
	import LiveEditor from "$lib/landing/LiveEditor.svelte";
	import { CONTACT_EMAIL, REPO_URL } from "$lib/landing/nav-data";
	import { faqLd, organisationLd, serialise, softwareLd, websiteLd } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, FaqList, RailFrame, RailRow, SplitSection } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { IconBrandGithub, IconMail, IconWriting } from "@tabler/icons-svelte";

	let { data } = $props();

	const faqs = [
		{
			q: "Can I bring my Overleaf project across?",
			a: "Yes. Export the project as a .zip and drop it in. The source stays plain .tex and .bib, and you can export the folder again at any time."
		},
		{
			q: "Does it work offline?",
			a: "Yes. The compiler downloads once, then every build happens in the tab with no network. Your files live in browser storage on your own device."
		},
		{
			q: "Will it handle a 300-page thesis?",
			a: "Yes. Chapters and includes work, and the outline follows them. It compiles on your computer, so your machine is the only limit."
		},
		{
			q: "Does biblatex work? What about biber?",
			a: "BibTeX is built in, so biblatex with backend=bibtex builds a real reference list offline. Biber has no browser build, so it needs the desktop app, and the editor tells you the one line to change."
		},
		{
			q: "How do co-authors work on the same paper?",
			a: "Through Git. Commit and push to GitHub, GitLab, Gitea or a university server. Browsers cannot reach Git directly, so pushes go through a small relay you can host yourself."
		},
		{
			q: "Can a whole department use it?",
			a: "Yes, for free. There are no seats, no licence server and no accounts to create, and it runs on managed machines without admin rights."
		}
	];

	const institutionMailto = `${CONTACT_EMAIL}?subject=${encodeURIComponent("GlyphTeX for our department")}`;
</script>

<Seo
	title="GlyphTeX · A local-first LaTeX editor for academic writing"
	description="GlyphTeX is a free, open source LaTeX editor that compiles in your browser. Projects stay on your device, work offline and keep their history in Git. No account."
	canonical="/"
	jsonld={[
		serialise(organisationLd()),
		serialise(websiteLd()),
		serialise(softwareLd()),
		...[faqLd(faqs)].filter((ld) => ld !== null).map((ld) => serialise(ld))
	]}
/>

<RailFrame>
	<RailRow
		id="top"
		divider={false}
		label="Introduction"
		section="hero"
		class="px-3 pt-28 pb-4 sm:px-6 sm:pt-32 sm:pb-6"
	>
		<HeroSection counts={data.counts} stars={data.stars} />
	</RailRow>

	<RailRow id="try" label="Try the editor" section="try">
		<div class="px-1 py-6 sm:px-4 sm:py-8 lg:px-16 lg:py-10">
			<div class="grid gap-4 lg:grid-cols-2 lg:items-end lg:gap-20">
				<h2 class="text-balance text-heading-lg font-medium text-foreground md:text-display">
					Type in it
					<br />
					<span class="text-primary">before you commit.</span>
				</h2>
				<p class="max-w-xl text-pretty text-body text-muted-foreground md:text-body-lg">
					Not a screenshot: the same editor as the workspace, with completion for
					{data.counts.packages} packages. Edits stay in this tab until you open them in the workspace.
				</p>
			</div>

			<div class="mt-8 flex flex-col gap-3 lg:mt-10">
				<div class="overflow-hidden rounded-2xl border border-border bg-card dark:bg-background">
					<LiveEditor />
				</div>
				<ImportDropzone />
			</div>
		</div>
	</RailRow>

	<RailRow id="features" label="Features" section="features">
		<FeatureBento />
	</RailRow>

	<RailRow id="faq" label="Frequently asked questions" section="faq">
		<SplitSection
			title="Questions worth"
			accent="asking first"
			description="What people check before moving a thesis across."
			sticky
		>
			{#snippet aside()}
				<div class="flex flex-wrap gap-2">
					<Button
						href={institutionMailto}
						onclick={() => track('cta_clicked', { target: 'institution', location: 'faq' })}
					>
						Talk to us about a campus
						<IconMail />
					</Button>
					<Button
						href={resolve('/errors')}
						variant="outline"
						onclick={() => track('cta_clicked', { target: 'errors', location: 'faq' })}
					>
						Fix a LaTeX error
					</Button>
				</div>
			{/snippet}
			<FaqList
				items={faqs}
				variant="cards"
				onopen={(i) => trackOnce(`faq:${i}`, 'faq_expanded', { question: i + 1 })}
			/>
		</SplitSection>
	</RailRow>

	<RailRow label="Get started" section="final_cta">
		<BrandPanel
			size="hero"
			title="Your next paper, written locally."
			body="Free for you and free for the lab. No account either way."
		>
			{#snippet icon()}
				<IconWriting class="size-10" stroke-width={1.5} aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				<Button
					href={resolve('/workspace')}
					variant="ink"
					onclick={() => track('cta_clicked', { target: 'workspace', location: 'final_cta' })}
				>
					Open the workspace
				</Button>
				<Button
					href={REPO_URL}
					target="_blank"
					rel="noopener noreferrer"
					variant="light"
					onclick={() => track('outbound_clicked', { destination: 'github', location: 'final_cta' })}
				>
					Read the source
					<IconBrandGithub />
				</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
