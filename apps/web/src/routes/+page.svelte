<script lang="ts">
	import { resolve } from '$app/paths';
	import { track } from '$lib/analytics';
	import {
		Container,
		ContainerTextFlip,
		HeroBackdrop,
		MacWindow,
		Section,
		ShowcasePanel
	} from '$lib/landing';
	import EditorMock from '$lib/landing/EditorMock.svelte';
	import { CONTACT_EMAIL } from '$lib/landing/nav-data';
	import PolishGrid from '$lib/landing/PolishGrid.svelte';
	import { techLogos, type TechLogo } from '$lib/landing/tech-logos';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import SiteHeader from '$lib/SiteHeader.svelte';
	import { Button } from '@glyphtex/ui/button';
	import { Logo } from '@glyphtex/ui/logo';
	import { Reveal } from '@glyphtex/ui/reveal';
	import { SectionHeader } from '@glyphtex/ui/section-header';
	import {
		IconArrowRight,
		IconBook2,
		IconBrandGithub,
		IconBrowser,
		IconCheck,
		IconClock,
		IconCloudOff,
		IconCpu,
		IconDeviceDesktop,
		IconFileText,
		IconFolders,
		IconGitBranch,
		IconHistory,
		IconInfinity,
		IconLicense,
		IconLock,
		IconMail,
		IconMinus,
		IconPackageExport,
		IconPlayerPlay,
		IconPlus,
		IconSchool,
		IconSearch,
		IconServer,
		IconShield,
		IconShieldLock,
		IconStack3,
		IconUserOff,
		IconUsersGroup,
		IconWriting
	} from '@tabler/icons-svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly, slide } from 'svelte/transition';

	const repo = 'https://github.com/kanakkholwal/glyphtex';
	const heroBackdrop = '/background-hero.webp';

	// One label for one destination. The page previously shipped "Try the
	// workspace" and "Open workspace" as two names for the same URL.
	const CTA_LABEL = 'Open the workspace';
	const workspace = resolve('/workspace');

	// Concrete artifacts the committed audience actually writes.
	const rotatingWords = ['thesis.', 'paper.', 'manuscript.', 'lecture notes.'];

	const reducedMotion =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	// The four promises under the hero CTA. These are the page's only statement
	// of them — the values strip below deliberately does not repeat them.
	const heroAssurances = [
		{ icon: IconInfinity, label: 'Free forever' },
		{ icon: IconUserOff, label: 'No account' },
		{ icon: IconBrowser, label: 'Runs in your browser' },
		{ icon: IconLock, label: 'Files stay on your device' }
	];

	// Claims the hero does not already make. Three, not five: "no account" and
	// "files stay on your machine" are above, and saying them twice in 400px of
	// scroll reads as padding rather than emphasis.
	const openSourceClaims = [
		{ icon: IconBrandGithub, label: 'GPLv3 open source' },
		{ icon: IconGitBranch, label: 'Plain .tex under plain Git' },
		{ icon: IconCloudOff, label: 'Compiles with the network off' }
	];

	// Cloud-LaTeX frictions researchers actually hit. Four, not six: the two that
	// were cut ("browser tab open all day", "dropped connection") restated the
	// queue and network points, and the sixth was being masked into
	// unreadability by a decorative fade anyway.
	type PainPoint = { id: string; title: string; description: string; icon: typeof IconClock };

	const painPoints: PainPoint[] = [
		{
			id: 'queue',
			title: 'Compile queue times out before the document is done.',
			description:
				'A 30-second build becomes a 4-minute wait when the shared queue is busy. The deadline does not care.',
			icon: IconClock
		},
		{
			id: 'license',
			title: 'Per-seat licensing blocks the whole lab from editing.',
			description:
				'Procurement caps the seat count. The undergrad who needs to proofread gets locked out.',
			icon: IconLock
		},
		{
			id: 'privacy',
			title: 'Unpublished drafts sit on a third-party server.',
			description: 'Submission-ready manuscripts leave traces somewhere you do not control.',
			icon: IconShield
		},
		{
			id: 'history',
			title: 'Full history is locked behind the paid tier.',
			description:
				'Free plans cap revisions. The paper you wrote last year has its diffs paywalled.',
			icon: IconHistory
		}
	];

	// Plain wording: researchers care that the file compiles, not which engine
	// compiles it. No engine name, no licence acronym, no jargon.
	const solutions = [
		'Compile on your machine, instantly. No queue, no limits.',
		'Free for everyone, forever. No subscriptions, no per-seat fees.',
		'Your drafts stay on your own disk. Every revision is tracked.',
		'Open a browser tab and write. Nothing to install, no account.'
	];

	const polishFeatures = [
		{
			icon: IconWriting,
			title: 'Auto-compile on save',
			description:
				'The PDF rebuilds as you type. You stop writing and the next page is already there.'
		},
		{
			icon: IconStack3,
			title: 'Live preview beside source',
			description:
				'Editor on the left, rendered PDF on the right. Errors land next to the line that caused them.'
		},
		{
			icon: IconFileText,
			title: 'Bibliographies that build',
			description:
				'BibTeX runs inside the engine, so \\bibliography and biblatex resolve into a real reference list offline. Only Biber needs the desktop app.'
		},
		{
			icon: IconSearch,
			title: 'Project-wide find',
			description:
				'A single keystroke searches every .tex and .bib in the project. Live, with file previews.'
		}
	];

	const openSources = [
		{
			icon: IconFileText,
			title: 'Overleaf export',
			description: 'Drag the .zip from Overleaf into GlyphTeX. The folder structure stays intact.'
		},
		{
			icon: IconGitBranch,
			title: 'Git repository',
			description:
				'Point GlyphTeX at an existing repo. Pulls, pushes, and history work as expected.'
		},
		{
			icon: IconFolders,
			title: 'Plain .tex folder',
			description: 'A directory of chapters, figures, and a .bib. Open it and start writing.'
		}
	];

	const trackFeatures = [
		{
			icon: IconGitBranch,
			title: 'Built-in Git UI',
			description: 'Stage, commit, branch, and merge without leaving the editor.'
		},
		{
			icon: IconLock,
			title: 'No proprietary history tier',
			description: 'Every revision, forever. The repository is the source of truth.'
		},
		{
			icon: IconBrandGithub,
			title: 'Works with your remote',
			description: 'GitHub, GitLab, a self-hosted Gitea, or your university server.'
		}
	];

	const commits = [
		{ msg: 'Final revisions · chapter 5', hash: 'c7d8e9f', when: 'today' },
		{ msg: 'Add citation · Smith 2024', hash: 'e4f5a6b', when: '2 days ago' },
		{ msg: 'Draft · conclusion', hash: 'a1b2c3d', when: 'last week' },
		{ msg: 'Fix typo · section 3.2', hash: '9f8e7d6', when: 'last month' }
	];

	const audienceCards = [
		{
			icon: IconBook2,
			title: 'PhD students',
			body: 'Thesis drafts that compile every time. Write on a plane. Submit from your own machine. Keep every revision for the viva defence.'
		},
		{
			icon: IconSchool,
			title: 'Professors and lecturers',
			body: 'Course notes, handouts, and lab manuals that stay versioned across semesters. Hand the source to a TA and they can edit it locally.'
		},
		{
			icon: IconUsersGroup,
			title: 'Research groups',
			body: 'A shared repo, individual commits, and one source of truth for the manuscript. No shared Google Doc with a half-written equation.'
		}
	];

	// Every card answers a question a department head or an IT reviewer actually
	// asks before a tool reaches a lab machine.
	const institutionCards = [
		{
			icon: IconLicense,
			title: 'No licence server, no renewal',
			body: 'GPLv3. Nothing to procure, no seats to reconcile at the end of term, and no renewal that lands mid-semester.'
		},
		{
			icon: IconShieldLock,
			title: 'Nothing leaves the device',
			body: 'Grant applications, unpublished results, and student drafts compile locally. There is no vendor holding the data, so there is no processor to assess.'
		},
		{
			icon: IconDeviceDesktop,
			title: 'Runs on managed machines',
			body: 'The browser workspace needs no install and no admin rights. Lab images stay exactly as IT built them.'
		},
		{
			icon: IconSchool,
			title: 'Ready for a whole cohort',
			body: 'Hand out a template repo and students start writing. No accounts to provision, none to revoke when they graduate.'
		},
		{
			icon: IconPackageExport,
			title: 'Archival by default',
			body: 'Plain .tex and .bib under Git. A thesis submitted this year still opens in ten, with or without GlyphTeX.'
		},
		{
			icon: IconServer,
			title: 'Self-host the moving parts',
			body: 'Point the Git proxy at your own host so pushes stay inside the university network.'
		}
	];

	const institutionStats = [
		{ value: '$0', label: 'per seat, per year' },
		{ value: '0', label: 'accounts to provision' },
		{ value: 'GPLv3', label: 'licence review, once' }
	];

	// Prefilled so the first reply already carries the details we need to answer.
	const institutionMailto = `${CONTACT_EMAIL}?subject=${encodeURIComponent(
		'GlyphTeX for our department'
	)}&body=${encodeURIComponent(
		'Institution:\nDepartment:\nRough number of writers:\nWhat IT needs to sign off on:\n'
	)}`;

	type Faq = { q: string; a: string };
	const faqs: Faq[] = [
		{
			q: 'Can I bring my Overleaf project into GlyphTeX?',
			a: 'Yes. Export from Overleaf as a .zip and drop it into the workspace. The source stays plain .tex and .bib files; nothing is reshaped, and you can export the folder again at any time.'
		},
		{
			q: 'Does GlyphTeX support biblatex and biber?',
			a: 'BibTeX is compiled into the engine, so \\bibliography and \\bibliographystyle build a real bibliography in the browser, offline. biblatex works too, with \\usepackage[backend=bibtex]{biblatex}. Biber is the exception: it is a Perl program with no WebAssembly build, so biblatex left on its default backend needs the desktop app — and the browser tells you which one-line change fixes it rather than rendering every citation as [?]. A manual thebibliography list compiles fine in either.'
		},
		{
			q: 'Will it handle a 300-page thesis?',
			a: 'Yes. Projects split across chapters and includes, and the outline panel mirrors the structure. Compiling happens on your own hardware, so the only practical limit is your machine.'
		},
		{
			q: 'Can my students use it without paying?',
			a: 'Yes. GlyphTeX is GPLv3 open source with no paid tier. There is no seat to count and no licence server to phone home. Your department can deploy it on every lab machine.'
		},
		{
			q: 'Does it work offline?',
			a: 'Yes. The workspace downloads the engine once, then compiles in the tab with no network at all. Your files live in browser storage on your own device; nothing uploads.'
		},
		{
			q: 'How do collaborators share a manuscript?',
			a: 'Through Git. Source control is built into both the desktop app and the browser workspace: stage, commit, browse history, and push to GitHub, GitLab, a self-hosted Gitea, or a university server. Because browsers cannot reach Git servers directly, the workspace relays fetch and push through a proxy you can point at your own host. You can also just export the folder.'
		},
		{
			q: 'Does SyncTeX work?',
			a: 'Yes. Click anywhere in the rendered PDF and GlyphTeX jumps back to the line that produced it. The reverse works too: jump from a source line to the matching point in the preview.'
		},
		{
			q: 'Can I run it on a university-managed machine?',
			a: 'Yes. The workspace is a web page, so there is nothing to install and no admin rights to request. If a managed browser blocks site storage, use a normal window and export your project when you finish.'
		}
	];

	// First item open so the pattern reads on load.
	let openFaq = $state<number | null>(0);
</script>

<svelte:head>
	<title>GlyphTeX · A local-first LaTeX editor for academic writing</title>
	<meta
		name="description"
		content="GlyphTeX is a local-first LaTeX editor for academic writing. Plain .tex projects, compiled on your machine, versioned with Git. GPLv3, free for individuals and institutions."
	/>
	<!-- The hero photo is the LCP element and is painted from CSS, so the browser
	     cannot discover it during preload scanning without this hint. -->
	<link rel="preload" as="image" href={heroBackdrop} fetchpriority="high" />
</svelte:head>

{#snippet techLogo(logo: TechLogo, duplicate = false)}
	<a
		href={logo.href}
		target="_blank"
		rel="noopener noreferrer"
		class="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-2.5 transition-colors duration-200"
		aria-hidden={duplicate ? 'true' : undefined}
		tabindex={duplicate ? -1 : undefined}
	>
		<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
			<path d={logo.path} />
		</svg>
		<span class="text-sm font-semibold tracking-tight">{logo.name}</span>
	</a>
{/snippet}

{#snippet featureList(items: typeof openSources)}
	<ul class="mt-10 space-y-6">
		{#each items as item, i (item.title)}
			{@const Icon = item.icon}
			<Reveal as="li" variant="left" delay={i * 60} class="flex items-start gap-4">
				<span
					class="landing-card mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl text-brand"
				>
					<Icon class="size-5" stroke-width={1.75} />
				</span>
				<span class="pt-1">
					<span class="block text-md font-semibold tracking-tight text-foreground"
						>{item.title}</span
					>
					<span class="mt-1.5 block text-sm leading-relaxed text-muted-foreground"
						>{item.description}</span
					>
				</span>
			</Reveal>
		{/each}
	</ul>
{/snippet}

<div class="min-h-screen bg-canvas font-sans text-ink antialiased selection:bg-brand-subtle">
	<div
		aria-hidden="true"
		class="landing-bg-grid landing-bg-grid-fade pointer-events-none fixed inset-0 -z-10 opacity-30"
	></div>

	<SiteHeader />

	<main id="main">
		<!--
		  Hero. One primary action; the engine link is a quiet text link rather than
		  a second lg button, so the page has a single obvious next step.
		-->
		<section class="relative w-full overflow-hidden">
			<HeroBackdrop src={heroBackdrop} tone="default" wash="left" />

			<div
				class="relative z-10 mx-auto flex min-h-[min(100dvh,52rem)] max-w-7xl flex-col justify-center px-6 pt-32 pb-20 lg:px-10"
			>
				<a
					href={repo}
					target="_blank"
					rel="noopener noreferrer"
					class="mb-8 inline-flex w-fit items-center gap-1.5 self-start rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/15"
					in:fly={{ y: 8, duration: 400, delay: 0, easing: cubicOut }}
				>
					<IconBrandGithub class="size-3.5" />
					Open source · GPLv3
				</a>

				<div class="flex max-w-2xl flex-col items-start text-left">
					<h1
						class="landing-display"
						in:fly={{ y: 10, duration: 450, delay: 60, easing: cubicOut }}
					>
						LaTeX, on your machine.
						<span class="landing-title-em mt-3 text-[0.5em] leading-tight">
							Write your
							<ContainerTextFlip words={rotatingWords} interval={2600} tone="brand" />
						</span>
					</h1>

					<p
						class="landing-text-pretty mt-6 max-w-xl text-base leading-relaxed text-foreground/85 sm:text-lg"
						in:fly={{ y: 10, duration: 450, delay: 120, easing: cubicOut }}
					>
						A local-first LaTeX editor for academic writing. Open a thesis, a paper, or a set of
						lecture notes. Compile on your machine. Track every revision in Git.
					</p>

					<div
						class="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
						in:fly={{ y: 10, duration: 450, delay: 180, easing: cubicOut }}
					>
						<!-- Desktop download is hidden until the app is no longer a prototype.
						     Restore this button (and the /download nav entry) at release. -->
						<Button
							href={workspace}
							variant="brand"
							size="lg"
							class="group/cta gap-2.5"
							onclick={() => track('cta_workspace_click', { location: 'hero' })}
						>
							<IconPlayerPlay class="size-4" />
							{CTA_LABEL}
							<IconArrowRight class="size-4 transition-transform group-hover/cta:translate-x-0.5" />
						</Button>
						<a
							href={resolve('/engine')}
							class="group/engine inline-flex items-center gap-2 text-sm font-semibold text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
							onclick={() => track('cta_engine_click', { location: 'hero' })}
						>
							<IconCpu class="size-4 text-brand" />
							How the engine works
							<IconArrowRight
								class="size-3.5 transition-transform group-hover/engine:translate-x-0.5"
							/>
						</a>
					</div>

					<ul
						class="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-xs font-medium text-foreground/80"
						in:fly={{ y: 8, duration: 400, delay: 240, easing: cubicOut }}
					>
						{#each heroAssurances as item (item.label)}
							{@const Icon = item.icon}
							<li class="inline-flex items-center gap-1.5">
								<Icon class="text-brand size-3.5 shrink-0" stroke-width={2} />
								{item.label}
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</section>

		<!--
		  Trust strip. The marquee and the old values row were two separate bands
		  saying adjacent things; they are one band now. The logo track holds two
		  copies of the list so translateX(-50%) wraps seamlessly, and the second
		  copy is hidden from assistive tech and the tab order.
		-->
		<Section spacing="tight" bordered>
			<Container size="wide">
				<p class="landing-eyebrow mb-8 justify-center text-muted-foreground">Built on</p>

				<div
					class="marquee-mask relative overflow-hidden"
					style="mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);"
				>
					<div class="marquee-track flex w-max items-center gap-12 whitespace-nowrap">
						{#each techLogos as logo (logo.slug)}
							{@render techLogo(logo)}
						{/each}
						{#each techLogos as logo (`dup-${logo.slug}`)}
							{@render techLogo(logo, true)}
						{/each}
					</div>
				</div>

				<Reveal variant="up">
					<ul
						class="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-hairline pt-8"
					>
						{#each openSourceClaims as claim (claim.label)}
							{@const Icon = claim.icon}
							<li class="text-foreground/80 inline-flex items-center gap-2 text-sm font-medium">
								<Icon class="text-brand size-4 shrink-0" stroke-width={1.75} />
								{claim.label}
							</li>
						{/each}
					</ul>
				</Reveal>
			</Container>
		</Section>

		<!--
		  Why not cloud LaTeX. Pain points on the left, the answer on the right,
		  a hairline connector between them. The icon chips are one neutral
		  treatment: the previous six hardcoded hues (amber/orange/rose/violet/
		  sky/pink) encoded nothing and collapsed into one colour under
		  deuteranopia.
		-->
		<Section id="why" bordered>
			<Container size="wide">
				<Reveal variant="up">
					<SectionHeader
						eyebrow="Why not cloud LaTeX"
						title="What you're up against."
						description="The job of writing a paper is not the job of waiting on a remote compile queue, hunting for a license seat, or trusting a third-party server with an unpublished draft."
						align="center"
					/>
				</Reveal>

				<div class="mt-14 grid gap-10 lg:grid-cols-[1.1fr_auto_1fr] lg:items-center lg:gap-16">
					<ul class="flex flex-col gap-3">
						{#each painPoints as point, i (point.id)}
							{@const Icon = point.icon}
							<Reveal as="li" variant="left" delay={i * 60}>
								<article
									class="landing-card landing-card-hover flex items-start gap-3.5 rounded-xl p-4"
								>
									<span
										class="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground/5 text-muted-foreground"
									>
										<Icon class="size-4" stroke-width={1.75} />
									</span>
									<div class="min-w-0 flex-1">
										<p class="text-foreground text-sm leading-snug font-medium">{point.title}</p>
										<p class="text-muted-foreground mt-1 text-xs leading-relaxed">
											{point.description}
										</p>
									</div>
								</article>
							</Reveal>
						{/each}
					</ul>

					<!-- Centre connector. The logo anchors the seam; the old version wrapped
					     it in an infinite `animate-ping` ring that was not gated behind
					     prefers-reduced-motion. -->
					<div class="hidden w-14 flex-col items-center self-stretch lg:flex" aria-hidden="true">
						<div
							class="h-full w-px flex-1 bg-linear-to-b from-transparent via-hairline to-transparent"
						></div>
						<span
							class="my-2 grid size-16 place-items-center rounded-2xl bg-surface-card shadow-craft-lg ring-1 ring-hairline"
						>
							<Logo size="md" text={false} badge={false} tone="gradient" />
						</span>
						<div
							class="h-full w-px flex-1 bg-linear-to-b from-transparent via-hairline to-transparent"
						></div>
					</div>

					<Reveal variant="right" delay={120}>
						<article class="landing-card flex flex-col gap-4 rounded-2xl p-6">
							<header class="flex items-center gap-2">
								<span
									class="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-0.5 text-xs font-semibold tracking-wider uppercase text-muted-foreground"
								>
									<span class="size-1.5 rounded-full bg-success"></span>
									All in place
								</span>
							</header>

							<h3 class="landing-card-title">Fixes that ship with GlyphTeX</h3>

							<ul class="flex flex-col gap-2.5 pt-1">
								{#each solutions as solution (solution)}
									<li class="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/85">
										<span
											class="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand/12 text-brand"
										>
											<IconCheck class="size-2.5" stroke-width={3} />
										</span>
										<span>{solution}</span>
									</li>
								{/each}
							</ul>

							<footer class="mt-auto flex items-center gap-2.5 border-t border-hairline pt-4">
								<span
									class="bg-foreground/5 text-muted-foreground grid size-7 shrink-0 place-items-center rounded-full"
								>
									<IconBrandGithub class="size-3.5" />
								</span>
								<p class="text-xs text-muted-foreground">
									<span class="text-foreground font-medium">Read it before you trust it</span><br />
									GPLv3 · No account · Runs offline
								</p>
							</footer>
						</article>
					</Reveal>
				</div>
			</Container>
		</Section>

		<!--
		  The workflow, in three beats: open, compile, track. The page used to run
		  these three showcases AND a separate "How it works / three steps" section
		  that restated them as text cards — one of the two duplicate fanned-tile
		  layouts. That section is gone; these three are the workflow.
		-->
		<Section id="open" spacing="tight" bordered>
			<Container size="wide">
				<ShowcasePanel tone="neutral">
					<div class="grid items-center gap-16 lg:grid-cols-12 lg:gap-24">
						<div class="lg:col-span-6">
							<Reveal variant="up">
								<SectionHeader
									eyebrow="Step 1 · Open"
									title="Open the project"
									emphasis="you already have."
									description="A GlyphTeX project is a folder of plain .tex files. Bring an Overleaf export, a thesis repo, or a fresh blank document. No reshaping, no proprietary format."
								/>
							</Reveal>

							{@render featureList(openSources)}

							<div class="mt-10">
								<Button href={workspace} variant="brand" class="gap-2">
									<IconPlayerPlay class="size-4" />
									{CTA_LABEL}
								</Button>
							</div>
						</div>

						<div class="lg:col-span-6">
							<Reveal variant="morph">
								<MacWindow title="GlyphTeX">
									<EditorMock />
								</MacWindow>
							</Reveal>
						</div>
					</div>
				</ShowcasePanel>
			</Container>
		</Section>

		<Section id="compile" spacing="tight" bordered>
			<Container size="wide">
				<ShowcasePanel tone="neutral">
					<Reveal variant="up">
						<SectionHeader
							eyebrow="Step 2 · Compile"
							title="The engine runs"
							emphasis="while you write."
							description="Tectonic compiles your project on every save. The PDF stays live, the bibliography stays in sync, and there is no remote queue between you and the build."
							align="center"
						/>
					</Reveal>

					<PolishGrid features={polishFeatures} />
				</ShowcasePanel>
			</Container>
		</Section>

		<Section id="track" spacing="tight" bordered>
			<Container size="wide">
				<ShowcasePanel tone="neutral">
					<div class="grid items-start gap-14 lg:grid-cols-12 lg:gap-20">
						<div class="lg:col-span-5">
							<Reveal variant="up">
								<SectionHeader
									eyebrow="Step 3 · Track"
									title="History stays"
									emphasis="in your repo."
									description="Diffs, commits, branches, and remotes live in your own repository. GlyphTeX helps with the workflow; the archive still belongs to you and the tools you already trust."
								/>
							</Reveal>

							{@render featureList(trackFeatures)}
						</div>

						<div class="lg:col-span-7">
							<Reveal variant="morph">
								<div class="landing-card overflow-hidden rounded-2xl p-7 sm:p-9">
									<span
										class="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-soft px-3 py-1.5 text-xs font-semibold tracking-[0.16em] uppercase text-muted-foreground"
									>
										<IconGitBranch class="size-3" />
										thesis · history
									</span>

									<h3 class="landing-card-title mt-6 text-2xl">
										Every commit is a sentence you can roll back to.
									</h3>
									<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
										Same Git you would use from the command line. The editor just makes the common
										cases a click away.
									</p>

									<!-- Static visual aid, not a live feed. -->
									<ul class="mt-7 flex flex-col gap-3">
										{#each commits as commit (commit.hash)}
											<li
												class="flex items-center gap-3 rounded-lg border border-hairline bg-surface-soft px-3.5 py-2.5"
											>
												<span class="size-2 shrink-0 rounded-full bg-success"></span>
												<div class="min-w-0 flex-1">
													<div class="truncate text-sm font-medium text-foreground">
														{commit.msg}
													</div>
													<div class="mt-0.5 font-mono text-xs text-muted-foreground">
														{commit.hash} · {commit.when}
													</div>
												</div>
												<span
													class="rounded-md border border-hairline bg-surface-card px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
												>
													main
												</span>
											</li>
										{/each}
									</ul>
								</div>
							</Reveal>
						</div>
					</div>
				</ShowcasePanel>
			</Container>
		</Section>

		<!--
		  Built for academics. The fanned dummy-avatar tiles are gone: they were a
		  second copy of the How-it-works layout, and three invented silhouettes
		  were carrying no information.
		-->
		<Section id="audience" bordered>
			<Container size="wide">
				<Reveal variant="up">
					<SectionHeader
						eyebrow="Built for academics"
						title="Opinionated where it matters,"
						emphasis="out of your way everywhere else."
						description="The workflow GlyphTeX is opinionated about is the one researchers already live in: a folder of .tex files, a bibliography, and a long revision history."
						align="center"
					/>
				</Reveal>

				<ul class="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
					{#each audienceCards as card, i (card.title)}
						{@const Icon = card.icon}
						<Reveal as="li" variant="up" delay={i * 70} class="h-full">
							<article class="landing-card landing-card-hover flex h-full flex-col rounded-3xl p-8">
								<span class="grid size-11 place-items-center rounded-2xl bg-brand/10 text-brand">
									<Icon class="size-5" stroke-width={1.75} />
								</span>
								<h3 class="landing-card-title mt-6">{card.title}</h3>
								<p class="mt-3 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
							</article>
						</Reveal>
					{/each}
				</ul>
			</Container>
		</Section>

		<!--
		  Institutions. This absorbs the old `#compare` band, which sat directly
		  underneath making the identical "free for individuals, free for the
		  institution" argument with two more cards.
		-->
		<Section id="institutions" spacing="tight" bordered>
			<Container size="wide">
				<ShowcasePanel tone="neutral">
					<div class="grid gap-14 lg:grid-cols-12 lg:gap-16">
						<div class="lg:col-span-5">
							<Reveal variant="up">
								<SectionHeader
									eyebrow="For universities and institutes"
									title="Give the whole department LaTeX."
									emphasis="Pay nothing for it."
									description="One department, one faculty, or every lab machine on campus. There is no seat count, no licence server to run, and no contract to renew. The editor your students use for a thesis is the one they keep after they graduate."
								/>
							</Reveal>

							<Reveal variant="up" delay={80}>
								<dl class="mt-10 grid grid-cols-3 gap-4">
									{#each institutionStats as stat (stat.label)}
										<div class="border-l border-brand/25 pl-4">
											<dt class="text-brand text-2xl font-semibold tracking-tight">
												{stat.value}
											</dt>
											<dd class="text-muted-foreground mt-1 text-xs leading-snug">
												{stat.label}
											</dd>
										</div>
									{/each}
								</dl>
							</Reveal>

							<Reveal variant="up" delay={140} class="mt-10 flex flex-wrap items-center gap-3">
								<Button
									href={institutionMailto}
									variant="brand"
									size="lg"
									class="group/inst gap-2.5"
									onclick={() => track('cta_institution_click', { location: 'institutions' })}
								>
									<IconMail class="size-4" />
									Talk to us about your campus
									<IconArrowRight
										class="size-4 transition-transform group-hover/inst:translate-x-0.5"
									/>
								</Button>
								<Button
									href="{repo}/blob/main/LICENSE"
									target="_blank"
									rel="noopener noreferrer"
									variant="outline"
									size="lg"
									class="gap-2.5"
								>
									<IconLicense class="size-4 text-brand" />
									Read the licence
								</Button>
							</Reveal>

							<Reveal variant="up" delay={200}>
								<p class="text-muted-foreground mt-5 max-w-md text-xs leading-relaxed">
									Tell us the department, the rough number of writers, and what your IT team needs
									to sign off on. Pilots usually start with one lab.
								</p>
							</Reveal>
						</div>

						<div class="lg:col-span-7">
							<ul class="grid gap-3 sm:grid-cols-2">
								{#each institutionCards as card, i (card.title)}
									{@const Icon = card.icon}
									<Reveal as="li" variant="up" delay={i * 50} class="h-full">
										<article class="landing-card landing-card-hover h-full rounded-2xl p-5">
											<span
												class="bg-brand/10 text-brand grid size-9 place-items-center rounded-lg"
											>
												<Icon class="size-4.5" stroke-width={1.75} />
											</span>
											<h3 class="mt-4 text-md font-semibold tracking-tight text-foreground">
												{card.title}
											</h3>
											<p class="text-muted-foreground mt-2 text-sm leading-relaxed">
												{card.body}
											</p>
										</article>
									</Reveal>
								{/each}
							</ul>
						</div>
					</div>
				</ShowcasePanel>
			</Container>
		</Section>

		<Section id="faq" bordered>
			<Container>
				<!-- 5/7 rather than 4/8: at col-span-4 the heading broke onto four lines
				     against a half-empty answer column. -->
				<div class="grid gap-12 lg:grid-cols-12 lg:gap-14">
					<div class="lg:col-span-5">
						<div class="lg:sticky lg:top-28">
							<Reveal variant="up">
								<SectionHeader
									eyebrow="FAQ"
									title="Questions worth asking first."
									description="Everything here restates a claim made further up the page, so nothing in the answers is a promise the editor doesn't already keep."
								/>
							</Reveal>
							<a
								href="{repo}/issues"
								target="_blank"
								rel="noopener noreferrer"
								class="text-brand group/faq mt-6 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
							>
								<IconBrandGithub class="size-4" />
								Ask something else
								<IconArrowRight
									class="size-3.5 transition-transform group-hover/faq:translate-x-0.5"
								/>
							</a>
						</div>
					</div>

					<div class="lg:col-span-7">
						<ul class="space-y-3">
							{#each faqs as faq, i (faq.q)}
								{@const open = openFaq === i}
								<li>
									<div
										class="overflow-hidden rounded-2xl border transition-colors duration-200 {open
											? 'border-hairline bg-surface-card'
											: 'border-hairline bg-surface-card/50 hover:bg-surface-card'}"
									>
										<button
											type="button"
											id={`faq-trigger-${i}`}
											onclick={() => (openFaq = open ? null : i)}
											aria-expanded={open}
											aria-controls={`faq-panel-${i}`}
											class="flex w-full items-start gap-3.5 px-5 py-4 text-left"
										>
											<span aria-hidden="true" class="mt-0.5 shrink-0 text-muted-foreground">
												{#if open}
													<IconMinus class="size-4" />
												{:else}
													<IconPlus class="size-4" />
												{/if}
											</span>
											<span class="flex-1 text-md font-semibold tracking-tight text-foreground">
												{faq.q}
											</span>
										</button>
										<!-- The panel element always exists: `aria-controls` above must
										     resolve to a real node even while the answer is collapsed. A
										     `region` needs an accessible name, so it borrows the question. -->
										<div
											id={`faq-panel-${i}`}
											role="region"
											aria-labelledby={`faq-trigger-${i}`}
											class="overflow-hidden"
										>
											{#if open}
												<p
													transition:slide={{ duration: reducedMotion ? 0 : 200, easing: cubicOut }}
													class="pb-5 pl-12 pr-5 text-sm leading-relaxed text-muted-foreground"
												>
													{faq.a}
												</p>
											{/if}
										</div>
									</div>
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</Container>
		</Section>

		<!--
		  Closing CTA. Set at section-title size, not larger than the H1 — the
		  previous version closed at 64px against a 48px hero headline.
		-->
		<Section id="cta" spacing="tight" bordered>
			<Container size="wide">
				<ShowcasePanel tone="neutral" padding="loose">
					<div class="mx-auto flex max-w-3xl flex-col items-center text-center">
						<Reveal variant="up">
							<SectionHeader
								eyebrow="Ready for early adopters"
								title="Your next paper, written locally."
								emphasis="No queue, no license."
								description="Open a thesis in 30 seconds. Compile on your machine. Version it in Git. Free for individuals, free for the lab."
								align="center"
							/>
						</Reveal>

						<Reveal variant="up" delay={80} class="mt-10">
							<Button
								href={workspace}
								variant="brand"
								size="lg"
								class="group/final gap-2.5"
								onclick={() => track('cta_workspace_click', { location: 'final_cta' })}
							>
								<IconPlayerPlay class="size-4" />
								{CTA_LABEL}
								<IconArrowRight
									class="size-4 transition-transform group-hover/final:translate-x-0.5"
								/>
							</Button>
						</Reveal>

						<Reveal variant="up" delay={140} class="mt-6">
							<a
								href={repo}
								target="_blank"
								rel="noopener noreferrer"
								class="group/src inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
							>
								Or read the source on GitHub
								<IconArrowRight
									class="size-3.5 transition-transform group-hover/src:translate-x-0.5"
								/>
							</a>
						</Reveal>
					</div>
				</ShowcasePanel>
			</Container>
		</Section>
	</main>

	<SiteFooter />
</div>

<style>
	/*
	 * Trust-logo marquee. The list is duplicated in markup so the track can
	 * translate by exactly half its width and wrap without a JS tween.
	 */
	@keyframes hero-marquee {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-50%);
		}
	}

	.marquee-track {
		animation: hero-marquee 38s linear infinite;
	}

	/* Otherwise a logo slides out from under the cursor before it can be clicked. */
	.marquee-mask:hover .marquee-track,
	.marquee-mask:focus-within .marquee-track {
		animation-play-state: paused;
	}

	@media (prefers-reduced-motion: reduce) {
		.marquee-track {
			animation: none;
		}
	}
</style>
