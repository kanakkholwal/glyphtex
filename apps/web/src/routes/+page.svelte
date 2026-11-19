<script lang="ts">
	import { resolve } from "$app/paths";
	import { track, trackOnce, viewSection } from "$lib/analytics";
	import Block from "$lib/landing/Block.svelte";
	import DotArt from "$lib/landing/DotArt.svelte";
	import DotField from "$lib/landing/DotField.svelte";
	import { art } from "$lib/landing/art";
	import ImportDropzone from "$lib/landing/ImportDropzone.svelte";
	import TemplateCard from "$lib/landing/TemplateCard.svelte";
	import LiveEditor from "$lib/landing/LiveEditor.svelte";
	import { CONTACT_EMAIL, REPO_URL } from "$lib/landing/nav-data";
	import { faqLd, organisationLd, serialise, softwareLd, websiteLd } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { FaqList, RailFrame, Well } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import {
		IconArrowRight,
		IconArrowUpRight,
		IconBrandGithub,
		IconCheck,
		IconMail
	} from "@tabler/icons-svelte";
	import { Image } from "@glyphtex/ui/image";

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
			a: "Save the project to a server with live editing switched on, invite them by email or link, and edit together with cursors, comments and suggested edits. Without a server, share a .zip or a Git repository. The offline editor on its own is single author."
		},
		{
			q: "Can a whole department use it?",
			a: "Yes, for free. There are no seats or licence keys. For shared projects, organisations and SSO, run the optional server on your own infrastructure."
		}
	];

	const benefits = [
		{
			title: "Drafts stay on your device",
			body: "Projects live in your browser. We never receive a word of them."
		},
		{
			title: "Builds without a connection",
			body: "Download the engine once, then compile on a plane, a train or campus wifi that never works."
		},
		{
			title: "Clone from GitHub or GitLab",
			body: "Paste a repository URL and it opens as a project, right in the browser."
		},
		{
			title: "Files you can take anywhere",
			body: "A project is a folder of .tex, .bib and images. Any TeX install can build it."
		}
	];

	const audiences = [
		{
			who: "Students and researchers",
			line: "Write a thesis or paper without signing up for anything. Start blank, from a template, or from your Overleaf export.",
			art: art.page,
			href: "/workspace",
			cta: "Open the editor"
		},
		{
			who: "Labs and co-authors",
			line: "Edit together with live cursors, leave comments, suggest changes and keep named versions. Sync with GitHub or GitLab when you want to.",
			art: art.people,
			href: "/compare/overleaf",
			cta: "Compare with Overleaf"
		},
		{
			who: "Departments and universities",
			line: "Run the optional server on your own infrastructure with SAML or OIDC single sign-on, SCIM provisioning, sharing policy and an audit log, so student work stays on campus.",
			art: art.campus,
			href: "/for/universities",
			cta: "See the admin controls"
		}
	];

	const switching = [
		"Export your project from Overleaf and drop the .zip here. It compiles in the tab.",
		"Your source stays plain .tex and .bib, so leaving is as easy as arriving.",
		"Comments, version history and Git come along once you add a server."
	];

	const institutionMailto = `${CONTACT_EMAIL}?subject=${encodeURIComponent("GlyphTeX for our department")}`;
	const resolveAny = resolve as (route: string) => string;
</script>

<Seo
	title="Free offline LaTeX editor, an Overleaf alternative · GlyphTeX"
	description="A free, open source LaTeX editor and Overleaf alternative that compiles in your browser. No account, works offline, and your projects never leave your device."
	canonical="/"
	jsonld={[
		serialise(organisationLd()),
		serialise(websiteLd()),
		serialise(softwareLd()),
		...[faqLd(faqs)].filter((ld) => ld !== null).map((ld) => serialise(ld))
	]}
/>

<RailFrame>
	<section
		id="top"
		aria-labelledby="hero-title"
		class="relative flex flex-col items-center overflow-hidden px-5 pt-16 pb-14 text-center sm:px-6 lg:px-10 lg:pt-24"
		{@attach viewSection('hero')}
	>
		<DotField seed={7} cols={16} rows={26} class="absolute top-6 left-0 hidden w-44 xl:block" />
		<DotField seed={21} cols={16} rows={26} flip class="absolute top-32 right-0 hidden w-44 xl:block" />
		<a
			href={resolve('/compare/overleaf')}
			class="rise relative inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground"
			onclick={() => track('cta_clicked', { target: 'compare', location: 'hero_badge' })}
		>
			Live co-editing, comments and Git sync are here
			<IconArrowRight class="size-3.5" aria-hidden="true" />
		</a>
		<h1
			id="hero-title"
			class="rise display relative mt-5 max-w-3xl text-5xl text-foreground sm:text-6xl"
			style:--i={1}
		>
			Write LaTeX <span class="text-accent-ink">on your machine.</span>
		</h1>
		<p
			class="rise relative mt-6 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg"
			style:--i={2}
		>
			Your document compiles right in the tab: offline if you like, no account, no upload. Bring
			your Overleaf project and carry on.
		</p>
		<div class="rise relative mt-8 flex flex-wrap items-center justify-center gap-2" style:--i={3}>
			<Button
				href={resolve('/workspace')}
				variant="dark"
				size="lg"
				class="rounded-full px-5"
				onclick={() => track('cta_clicked', { target: 'workspace', location: 'hero' })}
			>
				Open the editor
				<IconArrowRight />
			</Button>
			<Button
				href={resolve('/templates')}
				variant="outline"
				size="lg"
				class="rounded-full px-5"
				onclick={() => track('cta_clicked', { target: 'templates', location: 'hero' })}
			>
				Start from a template
			</Button>
		</div>
		<p class="rise relative mt-4 text-xs text-muted-foreground" style:--i={4}>
			Free and open source, GPLv3.
		</p>

		<div class="rise relative mt-14 w-full max-w-5xl text-left" style:--i={5}>
			<Well>
				<Image
					src="/img/product-editor.png"
					alt="The GlyphTeX editor with an IEEE paper's LaTeX source on the left and the compiled PDF on the right"
					width={1440}
					height={900}
					layout="fullWidth"
					priority
					class="block h-auto w-full"
				/>
			</Well>
		</div>
	</section>

	<Block
		id="import"
		title="Drop in"
		accent="what you have."
		description="An Overleaf export, a folder or a few .tex files. It compiles in your tab, and nothing gets uploaded."
		section="import"
	>
		<ImportDropzone />
	</Block>

	<Block
		id="why"
		title="Your computer"
		accent="does the work."
		description="The compiler runs in your browser, so builds never queue behind anyone and your drafts never leave your machine."
		section="features"
	>
		<div id="try" class="mx-auto max-w-5xl scroll-mt-24">
			<Well>
				<LiveEditor />
				{#snippet footer()}
					<p class="text-xs text-muted-foreground">
						Try it: this is the workspace editor, completing {data.counts.packages} packages.
					</p>
				{/snippet}
			</Well>
		</div>
		<dl class="mx-auto mt-14 grid max-w-5xl gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
			{#each benefits as b (b.title)}
				<div class="border-t border-border pt-5">
					<dt class="text-base font-medium text-foreground">{b.title}</dt>
					<dd class="mt-2 text-sm text-pretty text-muted-foreground">{b.body}</dd>
				</div>
			{/each}
		</dl>
	</Block>

	<Block
		id="audiences"
		title="Alone, with co-authors,"
		accent="or across a campus."
		description="Start solo. Add co-authors and admin controls when you need them."
		section="audiences"
	>
		<ul class="grid gap-3 lg:grid-cols-3">
			{#each audiences as a (a.who)}
				<li class="min-w-0">
					<Well class="h-full" bodyClass="flex h-full flex-col p-6">
						<DotArt rows={[...a.art]} class="mb-6 h-24 w-auto self-start" />
						<h3 class="text-xl font-medium text-foreground">{a.who}</h3>
						<p class="mt-3 text-sm text-pretty text-muted-foreground">{a.line}</p>
						<div class="mt-auto pt-8">
							<Button
								href={resolveAny(a.href)}
								variant="outline"
								size="sm"
								class="rounded-full text-accent-ink"
								onclick={() => track('cta_clicked', { target: a.href, location: 'audiences' })}
							>
								{a.cta}
								<IconArrowUpRight />
							</Button>
						</div>
					</Well>
				</li>
			{/each}
		</ul>
	</Block>

	<Block
		id="templates"
		title="Start from"
		accent="a template."
		description={`${data.counts.templates} starting points, from IEEE papers to CVs. Each one compiles before you change a word.`}
		section="templates"
	>
		{#snippet action()}
			<Button href={resolve('/templates')} variant="dark" class="rounded-full px-5">
				Browse all
				<IconArrowRight />
			</Button>
		{/snippet}
		<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each data.featured as t (t.id)}
				<li class="min-w-0">
					<TemplateCard template={t} location="home" />
				</li>
			{/each}
		</ul>
	</Block>

	<Block id="switch" title="Coming from" accent="Overleaf?" section="switch">
		<Well bodyClass="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
			<ul class="flex flex-col gap-3">
				{#each switching as s (s)}
					<li class="flex gap-3 text-base text-foreground">
						<IconCheck class="mt-1 size-4 shrink-0 text-accent-ink" aria-hidden="true" />
						{s}
					</li>
				{/each}
			</ul>
			<div class="flex flex-wrap gap-2">
				<Button
					href={resolve('/compare/overleaf')}
					variant="dark"
					size="lg"
					class="rounded-full px-5"
					onclick={() => track('cta_clicked', { target: 'compare', location: 'switch' })}
				>
					Compare side by side
					<IconArrowRight />
				</Button>
			</div>
		</Well>
	</Block>

	<Block id="faq" title="What people ask" accent="before they move." section="faq">
		{#snippet action()}
			<Button
				href={resolve('/errors')}
				variant="ghost"
				size="sm"
				class="rounded-full"
				onclick={() => track('cta_clicked', { target: 'errors', location: 'faq' })}
			>
				Fix a LaTeX error
				<IconArrowRight />
			</Button>
		{/snippet}
		<FaqList
			items={faqs}
			onopen={(i) => trackOnce(`faq:${i}`, 'faq_expanded', { question: i + 1 })}
		/>
	</Block>

	<section id="start" aria-label="Start writing" class="px-5 pb-20 sm:px-6 lg:px-10" {@attach viewSection('final_cta')}>
		<Well bodyClass="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
			<div>
				<p class="display text-3xl text-foreground sm:text-4xl">Start your next paper here.</p>
				<p class="mt-3 max-w-md text-sm text-muted-foreground">
					Free for you, free for your lab.
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<Button
					href={resolve('/workspace')}
					variant="dark"
					size="lg"
					class="rounded-full px-5"
					onclick={() => track('cta_clicked', { target: 'workspace', location: 'final_cta' })}
				>
					Open the editor
				</Button>
				<Button
					href={institutionMailto}
					variant="outline"
					size="lg"
					class="rounded-full px-5"
					onclick={() => track('cta_clicked', { target: 'institution', location: 'final_cta' })}
				>
					<IconMail />
					Talk to us about a campus
				</Button>
				<Button
					href={REPO_URL}
					target="_blank"
					rel="noopener noreferrer"
					variant="ghost"
					size="lg"
					class="rounded-full"
					onclick={() => track('outbound_clicked', { destination: 'github', location: 'final_cta' })}
				>
					<IconBrandGithub />
					Source
				</Button>
			</div>
		</Well>
	</section>
</RailFrame>
