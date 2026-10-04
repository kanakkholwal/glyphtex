<script lang="ts">
	import { resolve } from "$app/paths";
	import { track, trackOnce, viewSection } from "$lib/analytics";
	import ImportDropzone from "$lib/landing/ImportDropzone.svelte";
	import LiveEditor from "$lib/landing/LiveEditor.svelte";
	import { CONTACT_EMAIL, REPO_URL } from "$lib/landing/nav-data";
	import { faqLd, organisationLd, serialise, softwareLd, websiteLd } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { FaqList, RailFrame, Section, Well } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import {
		IconAlertTriangle,
		IconArrowRight,
		IconBrandGithub,
		IconFileZip,
		IconGitBranch,
		IconLock,
		IconMail,
		IconWifiOff
	} from "@tabler/icons-svelte";

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
			a: "Share the project, not a login: export it as a .zip, or keep it in a Git repository and clone it into the browser workspace. There is no live co-editing, and committing and pushing are only in the desktop app, which is an early prototype."
		},
		{
			q: "Can a whole department use it?",
			a: "Yes, for free. There are no seats, no licence server and no accounts to create, and it runs on managed machines without admin rights."
		}
	];

	const reasons: { icon: typeof IconLock; title: string; body: string }[] = [
		{
			icon: IconLock,
			title: "Your drafts stay yours",
			body: "Projects live in your browser on your own device. Nothing is uploaded or stored by us."
		},
		{
			icon: IconWifiOff,
			title: "Compiles with the network off",
			body: "Download the engine once, then write and build on a plane or a train."
		},
		{
			icon: IconGitBranch,
			title: "Open a Git repository",
			body: "Clone a repository from GitHub, GitLab or another Git host into a new project, from the browser."
		},
		{
			icon: IconAlertTriangle,
			title: "Errors point at the line",
			body: "The log is read for you, so each problem links to the file and line that caused it."
		},
		{
			icon: IconFileZip,
			title: "Bring your Overleaf project",
			body: "Drop the exported .zip and keep writing. The source stays plain .tex and .bib."
		},
		{
			icon: IconBrandGithub,
			title: "Built in the open",
			body: "GPLv3. Read the code, report a bug, send a fix."
		}
	];

	// Floors to a round number so the "+" is true; the exact count moves as data is added.
	const floorTo = (n: number, step: number) => Math.floor(n / step) * step;
	const institutionMailto = `${CONTACT_EMAIL}?subject=${encodeURIComponent("GlyphTeX for our department")}`;
	const resolveAny = resolve as (route: string) => string;
</script>

<Seo
	title="GlyphTeX · A local-first LaTeX editor for academic writing"
	description="GlyphTeX is a free, open source LaTeX editor that compiles in your browser. Projects stay on your device, work offline and are never uploaded. No account."
	canonical="/"
	jsonld={[
		serialise(organisationLd()),
		serialise(websiteLd()),
		serialise(softwareLd()),
		...[faqLd(faqs)].filter((ld) => ld !== null).map((ld) => serialise(ld))
	]}
/>

{#snippet stat(value: string, label: string)}
	<div class="flex items-baseline gap-1.5">
		<dd class="text-foreground tabular-nums">{value}</dd>
		<dt>{label}</dt>
	</div>
{/snippet}

<RailFrame>
	<section
		id="top"
		aria-labelledby="hero-title"
		class="px-5 pt-14 pb-12 sm:px-6 lg:px-10 lg:pt-20"
		{@attach viewSection('hero')}
	>
		<p class="rise font-mono text-xs text-muted-foreground">Free and open source · GPLv3</p>
		<h1
			id="hero-title"
			class="rise pixel mt-4 max-w-3xl text-4xl text-balance text-foreground sm:text-6xl"
			style:--i={1}
		>
			Write LaTeX on your machine.
		</h1>
		<p
			class="rise mt-5 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg"
			style:--i={2}
		>
			A LaTeX editor that compiles in this tab. Projects stay on your device, work offline and are
			never uploaded. No account.
		</p>
		<div class="rise mt-8 flex flex-wrap items-center gap-2" style:--i={3}>
			<Button
				href={resolve('/workspace')}
				variant="default"
				size="lg"
				onclick={() => track('cta_clicked', { target: 'workspace', location: 'hero' })}
			>
				Open the editor
				<IconArrowRight />
			</Button>
			<Button
				href={resolve('/templates')}
				variant="outline"
				size="lg"
				onclick={() => track('cta_clicked', { target: 'templates', location: 'hero' })}
			>
				Start from a template
			</Button>
		</div>
		<dl
			class="rise mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground"
			style:--i={4}
		>
			{@render stat(`${floorTo(data.counts.commands, 50)}+`, 'commands documented')}
			{@render stat(String(data.counts.packages), 'packages completed')}
			{@render stat(String(data.counts.templates), 'templates')}
			{@render stat(String(data.counts.guides), 'guides')}
		</dl>

		<div id="try" class="rise mt-12 flex scroll-mt-20 flex-col gap-3" style:--i={5}>
			<Well>
				<LiveEditor />
				{#snippet footer()}
					<p class="text-xs text-muted-foreground">
						Not a screenshot: the workspace editor, completing {data.counts.packages} packages.
					</p>
				{/snippet}
			</Well>
			<ImportDropzone />
		</div>
	</section>

	<Section
		id="why"
		number={1}
		title="why local."
		description="What changes when the compiler runs on your computer instead of a server."
		section="features"
	>
		<ul class="grid gap-x-10 sm:grid-cols-2">
			{#each reasons as r (r.title)}
				<li class="flex gap-4 border-t border-dashed border-border py-5">
					<span
						class="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground"
						aria-hidden="true"
					>
						<r.icon class="size-4.5" />
					</span>
					<div class="min-w-0">
						<h3 class="text-sm font-medium text-foreground">{r.title}</h3>
						<p class="mt-1 text-sm text-pretty text-muted-foreground">{r.body}</p>
					</div>
				</li>
			{/each}
		</ul>
	</Section>

	<Section
		id="templates"
		number={2}
		title="templates."
		description={`${data.counts.templates} starter documents that compile as they are. Pick one and the project opens with it.`}
		section="templates"
	>
		{#snippet action()}
			<Button href={resolve('/templates')} variant="outline" size="sm">
				Browse all
				<IconArrowRight />
			</Button>
		{/snippet}
		<ul class="group/list grid gap-x-10 sm:grid-cols-2">
			{#each data.templateCategories as c (c.id)}
				<li>
					<a
						href={resolveAny(`/templates#${c.id}`)}
						class="flex items-center justify-between gap-4 border-t border-dashed border-border py-3 text-sm transition-opacity duration-(--duration-fast) group-hover/list:opacity-50 hover:opacity-100! focus-visible:opacity-100!"
					>
						<span class="font-medium text-foreground">{c.label}</span>
						<span class="font-mono text-xs text-muted-foreground tabular-nums">{c.count}</span>
					</a>
				</li>
			{/each}
		</ul>
	</Section>

	<Section
		id="faq"
		number={3}
		title="questions."
		description="What people check before moving a thesis across."
		section="faq"
	>
		{#snippet action()}
			<Button
				href={resolve('/errors')}
				variant="ghost"
				size="sm"
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
	</Section>

	<Section id="start" title="start writing." section="final_cta">
		<Well bodyClass="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
			<div>
				<p class="text-lg font-medium text-foreground">Your next paper, written locally.</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Free for you and free for the lab. No account either way.
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<Button
					href={resolve('/workspace')}
					variant="dark"
					onclick={() => track('cta_clicked', { target: 'workspace', location: 'final_cta' })}
				>
					Open the editor
				</Button>
				<Button
					href={institutionMailto}
					variant="outline"
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
					onclick={() => track('outbound_clicked', { destination: 'github', location: 'final_cta' })}
				>
					<IconBrandGithub />
					Source
				</Button>
			</div>
		</Well>
	</Section>
</RailFrame>
