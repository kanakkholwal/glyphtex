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
	import PolishGrid from '$lib/landing/PolishGrid.svelte';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import SiteHeader from '$lib/SiteHeader.svelte';
	import { Button } from '@glyphtex/ui/button';
	import { Logo } from '@glyphtex/ui/logo';
	import { Reveal } from '@glyphtex/ui/reveal';
	import { SectionHeader } from '@glyphtex/ui/section-header';
	import {
		IconArrowRight,
		IconBolt,
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
		IconLayout,
		IconLock,
		IconMinus,
		IconPlayerPlay,
		IconPlus,
		IconSchool,
		IconSearch,
		IconShield,
		IconStack3,
		IconUsersGroup,
		IconWifiOff,
		IconWriting
	} from '@tabler/icons-svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly, slide } from 'svelte/transition';

	const repo = 'https://github.com/kanakkholwal/glyphtex';

	const heroBackdrop = '/background-hero.webp';

	// Concrete artifacts the committed audience actually writes. Narrowed to
	// the four nouns a researcher or lecturer cares about most.
	const rotatingWords = ['thesis.', 'paper.', 'manuscript.', 'lecture notes.'];

	// Drives the FAQ accordion's slide duration.
	const reducedMotion =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	// Open-source values that matter for academic writing (privacy,
	// reproducibility, no per-seat licensing).
	type OpenSourceClaim = {
		label: string;
		icon: typeof IconBrandGithub;
	};

	const openSourceClaims: OpenSourceClaim[] = [
		{ icon: IconBrandGithub, label: 'GPLv3 open source' },
		{ icon: IconLock, label: 'Files stay on your machine' },
		{ icon: IconCloudOff, label: 'No account, works fully offline' },
		{ icon: IconGitBranch, label: 'Plain Git history' },
		{ icon: IconDeviceDesktop, label: 'Runs offline, on the lab machine' }
	];

	// Tech-stack logos. Same row treatment as trace-mvp: a divider hairline,
	// uppercase eyebrow, and quiet brand logos. Logos fetched from
	// simpleicons.org CDN; lazy-loaded so they don't gate first paint.
	const techLogos = [
		{ name: 'Tauri', slug: 'tauri', href: 'https://tauri.app' },
		{ name: 'Rust', slug: 'rust', href: 'https://www.rust-lang.org' },
		{ name: 'Svelte', slug: 'svelte', href: 'https://svelte.dev' },
		{ name: 'TypeScript', slug: 'typescript', href: 'https://www.typescriptlang.org' },
		{ name: 'Vite', slug: 'vite', href: 'https://vitejs.dev' },
		{ name: 'Git', slug: 'git', href: 'https://git-scm.com' },
		{ name: 'TeX', slug: 'latex', href: 'https://www.latex-project.org' }
	];

	// Concrete frictions researchers hit with cloud LaTeX. The right-hand
	// solution card answers each one in the same order.
	type PainPoint = {
		id: string;
		title: string;
		description: string;
		icon: typeof IconClock;
		iconBg: string;
		iconColor: string;
	};

	const painPoints: PainPoint[] = [
		{
			id: 'queue',
			title: 'Compile queue times out before the document is done.',
			description:
				'A 30-second build becomes a 4-minute wait when the shared queue is busy. The deadline does not care.',
			icon: IconClock,
			iconBg: 'bg-amber-500/10',
			iconColor: 'text-amber-500'
		},
		{
			id: 'license',
			title: 'Per-seat licensing blocks the whole lab from editing.',
			description:
				'Procurement caps the seat count. The undergrad who needs to proofread gets locked out.',
			icon: IconLock,
			iconBg: 'bg-orange-500/10',
			iconColor: 'text-orange-500'
		},
		{
			id: 'privacy',
			title: 'Unpublished drafts sit on a third-party server.',
			description: 'Submission-ready manuscripts leave traces somewhere you do not control.',
			icon: IconShield,
			iconBg: 'bg-rose-500/10',
			iconColor: 'text-rose-500'
		},
		{
			id: 'history',
			title: 'Full history is locked behind the paid tier.',
			description:
				'Free plans cap revisions. The paper you wrote last year has its diffs paywalled.',
			icon: IconHistory,
			iconBg: 'bg-violet-500/10',
			iconColor: 'text-violet-500'
		},
		{
			id: 'browser',
			title: 'A browser tab that needs to stay open all day.',
			description:
				'Close it for a meeting and the compile dies. Save your work, lose your session.',
			icon: IconBrowser,
			iconBg: 'bg-sky-500/10',
			iconColor: 'text-sky-500'
		},
		{
			id: 'network',
			title: 'Dropped connection mid-compile during a deadline.',
			description: 'Cloud latency or a wifi blip mid-build means starting over. Every time.',
			icon: IconWifiOff,
			iconBg: 'bg-pink-500/10',
			iconColor: 'text-pink-500'
		}
	];

	// GlyphTeX solutions. Consolidated to four answers (the pain points on
	// the left are still six, since the friction list is the point; the
	// solution card just needs to land the main beats). Plain wording:
	// researchers care that the file compiles, not which engine compiles
	// it. No tech jargon, no em dashes.
	const solutions: string[] = [
		'Compile on your machine, instantly. No queue, no limits.',
		'Free for everyone, forever. No subscriptions, no per-seat fees.',
		'Your drafts stay on your own disk. Every revision is tracked.',
		'Open a browser tab and write. Nothing to install, no account.'
	];

	// PolishGrid features. The "applied automatically" beat that tells
	// visitors the loop runs without manual rebuilds.
	type PolishFeature = {
		icon: typeof IconWriting;
		title: string;
		description: string;
	};

	const polishFeatures: PolishFeature[] = [
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

	// How-it-works section data. Three showcase cards that fan out above
	// the step grid (compile / preview / history), then three step cards
	// below. Plain wording, no engine names, no jargon.
	type ShowcaseTile = {
		label: string;
		icon: typeof IconBolt;
		bg: string;
		color: string;
		rotate: number;
		offset: number;
	};

	const showcaseTiles: ShowcaseTile[] = [
		{
			label: 'Compile',
			icon: IconBolt,
			bg: 'bg-amber-500/10',
			color: 'text-amber-500',
			rotate: -12,
			offset: -130
		},
		{
			label: 'Live preview',
			icon: IconLayout,
			bg: 'bg-brand/15',
			color: 'text-brand',
			rotate: 0,
			offset: 0
		},
		{
			label: 'History',
			icon: IconGitBranch,
			bg: 'bg-violet-500/10',
			color: 'text-violet-500',
			rotate: 10,
			offset: 130
		}
	];

	type HowStep = { step: string; title: string; body: string };

	const howSteps: HowStep[] = [
		{
			step: '01',
			title: 'Open your project.',
			body: 'Drag a .tex folder in. Overleaf export, Git repo, or a fresh blank document. Nothing reshapes your source.'
		},
		{
			step: '02',
			title: 'Write and compile locally.',
			body: 'The PDF updates as you type. Errors land next to the line that caused them. No queue, no waiting.'
		},
		{
			step: '03',
			title: 'Track in Git, share when ready.',
			body: 'Every revision is committed. Push to GitHub, GitLab, or your university server when the draft is done.'
		}
	];

	// Built for academics. Three personas (PhD student, professor, research
	// group) plus the supporting tile data for the fanned showcase row
	// above the cards. Same layout as the How-it-works section: fan of
	// dummy-avatar tiles, heading, three hover-border cards.
	type AudienceCard = {
		icon: typeof IconBook2;
		title: string;
		body: string;
	};

	const audienceCards: AudienceCard[] = [
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

	// Fanned audience tiles that sit above the cards. Each tile is a
	// large dummy avatar (inline SVG silhouette) with a role label and
	// a per-persona hue so the row reads as three distinct people.
	type AudienceTile = {
		role: string;
		hue: number;
		sat: number;
		offset: number;
		rotate: number;
	};

	const audienceTiles: AudienceTile[] = [
		{ role: 'PhD student', hue: 215, sat: 55, offset: -130, rotate: -10 },
		{ role: 'Professor', hue: 280, sat: 45, offset: 0, rotate: 0 },
		{ role: 'Research group', hue: 145, sat: 45, offset: 130, rotate: 10 }
	];

	// Two-card pricing teaser: free for individuals, free for institutions.
	type TierCard = {
		label: string;
		price: string;
		body: string;
		href: string;
		cta: string;
	};

	const tiers: TierCard[] = [
		{
			label: 'For individuals',
			price: 'Free',
			body: 'GPLv3, full editor, full engine, no account. Your documents never leave your device. Open it in the browser and start writing.',
			href: resolve('/workspace'),
			cta: 'Try the workspace'
		},
		{
			label: 'For institutions',
			price: 'Free',
			body: 'No per-seat fees, no licence server, no procurement paperwork. GPLv3, so the licence review is a short one.',
			href: `${repo}/blob/main/LICENSE`,
			cta: 'Read the licence'
		}
	];

	// FAQ. Research-focused. Answers map to claims made elsewhere on the
	// page so nothing here over-promises.
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

	// Per-item FAQ open state. First item open so the pattern reads on load.
	let openFaq = $state<number | null>(0);
</script>

<svelte:head>
	<title>GlyphTeX · A local-first LaTeX editor for academic writing</title>
	<link rel="preconnect" href="https://cdn.simpleicons.org" crossorigin="anonymous" />
	<meta
		name="description"
		content="GlyphTeX is a local-first LaTeX editor for academic writing. Plain .tex projects, compiled on your machine, versioned with Git. GPLv3, free for individuals and institutions."
	/>
</svelte:head>

{#snippet techLogo(logo: (typeof techLogos)[number], duplicate = false)}
	<a
		href={logo.href}
		target="_blank"
		rel="noopener noreferrer"
		class="text-foreground/55 hover:text-foreground flex shrink-0 items-center gap-2.5 opacity-60 grayscale transition-[opacity,filter,color] duration-200 hover:opacity-100 hover:grayscale-0"
		title={logo.name}
		aria-hidden={duplicate ? 'true' : undefined}
		tabindex={duplicate ? -1 : undefined}
	>
		<img
			src="https://cdn.simpleicons.org/{logo.slug}/9ca3af"
			alt={duplicate ? '' : `${logo.name} logo`}
			loading="lazy"
			decoding="async"
			width="20"
			height="20"
			class="h-5 w-5 dark:invert"
		/>
		<span class="text-sm font-semibold tracking-tight">{logo.name}</span>
	</a>
{/snippet}

<div class="min-h-screen bg-canvas font-sans text-ink antialiased selection:bg-brand-subtle">
	<div
		aria-hidden="true"
		class="landing-bg-grid landing-bg-grid-fade pointer-events-none fixed inset-0 -z-10 opacity-30"
	></div>

	<SiteHeader />

	<main>
		<section class="relative min-h-dvh w-full overflow-hidden">
			<HeroBackdrop src={heroBackdrop} tone="default" wash="left" />

			<div
				class="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col justify-center px-6 pt-28 pb-16 lg:px-10"
			>
				<a
					href={repo}
					target="_blank"
					rel="noopener noreferrer"
					class="landing-glass-chip mb-8 inline-flex w-fit items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:text-foreground"
					in:fly={{ y: 8, duration: 500, delay: 0, easing: cubicOut }}
				>
					<IconBrandGithub class="size-3.5" />
					Open source · GPLv3
				</a>

				<div class="flex max-w-2xl flex-col items-start text-left">
					<h1
						class="landing-text-balance text-[2.5rem] font-bold leading-[1.05] tracking-[-0.025em] text-foreground sm:text-5xl md:text-[3rem]"
						in:fly={{ y: 12, duration: 600, delay: 80, easing: cubicOut }}
					>
						LaTeX, on your machine.
						<span
							class="mt-2 block font-serif text-xl font-medium italic text-foreground/65 sm:text-2xl md:text-3xl"
							style="line-height: 1.15;"
						>
							Write your
							<ContainerTextFlip words={rotatingWords} interval={2600} />
						</span>
					</h1>

					<p
						class="landing-text-pretty mt-5 max-w-xl text-base font-medium leading-relaxed text-foreground/85 sm:text-lg"
						in:fly={{ y: 12, duration: 600, delay: 160, easing: cubicOut }}
					>
						A local-first LaTeX editor for academic writing. Open a thesis, a paper, or a set of
						lecture notes. Compile on your machine. Track every revision in Git.
					</p>

					<div
						class="mt-6 flex flex-col items-start gap-3 sm:flex-row"
						in:fly={{ y: 12, duration: 600, delay: 240, easing: cubicOut }}
					>
						<!-- Desktop download is hidden until the app is no longer a prototype.
							     Restore this button (and the /download nav entry) at release. -->
						<Button
							href={resolve('/workspace')}
							variant="default"
							size="lg"
							class="group/cta gap-2.5"
							onclick={() => track('cta_workspace_click', { location: 'hero' })}
						>
							<IconPlayerPlay class="size-4" />
							Try the workspace
							<IconArrowRight class="size-4 transition-transform group-hover/cta:translate-x-0.5" />
						</Button>
						<Button
							href={resolve('/engine')}
							variant="outline"
							size="lg"
							class="group/engine gap-2.5"
							onclick={() => track('cta_engine_click', { location: 'hero' })}
						>
							<IconCpu class="size-4" />
							How the engine works
							<IconArrowRight
								class="size-4 transition-transform group-hover/engine:translate-x-0.5"
							/>
						</Button>
					</div>

					<div
						class="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium tracking-wide text-foreground/70"
						in:fly={{ y: 8, duration: 500, delay: 320, easing: cubicOut }}
					>
						<span class="relative flex size-1.5">
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60 opacity-70"
							></span>
							<span class="relative inline-flex size-1.5 rounded-full bg-brand"></span>
						</span>
						Free · No account · Runs in your browser · Files stay on your device
					</div>
				</div>
			</div>
		</section>

		<!--
		  Tech-stack marquee. The track holds two copies of the list so the CSS
		  translateX(-50%) loop wraps seamlessly; the second copy is hidden from
		  assistive tech and the tab order so the links aren't announced twice.
		-->
		<!-- No border-b: the next Section's `bordered` border-t draws this seam. -->
		<section class="relative px-4 py-12 md:px-10">
			<div class="mx-auto max-w-7xl">
				<p
					class="text-muted-foreground mb-6 text-center text-[11px] font-semibold tracking-[0.18em] uppercase"
				>
					Built on
				</p>
				<div
					class="marquee-mask group relative overflow-hidden"
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
			</div>
		</section>

		<!--
		  Open-source values strip. The tech-stack logos already scroll
		  inside the hero, so this section keeps the values-only row (GPLv3,
		  files on disk, no account, plain Git history, runs offline). Same
		  quiet editorial cadence as the trace-mvp placement.
		-->
		<Section spacing="tight" bordered>
			<Container>
				<Reveal variant="blur">
					<!-- Hairline separators keep this from reading as a second loose
					     logo row directly under the marquee. -->
					<ul class="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-4">
						{#each openSourceClaims as claim, i (claim.label)}
							{@const Icon = claim.icon}
							<li
								class="text-foreground/75 inline-flex items-center gap-2 text-[13px] font-medium {i >
								0
									? 'before:bg-hairline before:mr-6 before:hidden before:h-4 before:w-px before:content-[""] sm:before:block'
									: ''}"
							>
								<Icon class="text-foreground/45 size-4 shrink-0" stroke-width={1.75} />
								{claim.label}
							</li>
						{/each}
					</ul>
				</Reveal>
			</Container>
		</Section>

		<!--
		  Why-not section. Inspired by the feedback-board layout: a column
		  of pain points on the left (the cloud-LaTeX friction researchers
		  hit), a vertical connector with a sparkle anchor in the middle,
		  and a compact "fixes shipped in GlyphTeX" card on the right. The
		  two sides animate independently so the eye crosses the connector.
		-->
		<Section id="why" bordered>
			<Container size="wide">
				<SectionHeader
					eyebrow="Why not cloud LaTeX"
					title="What you're up against."
					description="The job of writing a paper is not the job of waiting on a remote compile queue, hunting for a license seat, or trusting a third-party server with an unpublished draft."
					align="center"
				/>

				<div class="mt-14 grid gap-10 lg:grid-cols-[1.1fr_auto_1fr] lg:items-center lg:gap-20">
					<!--
					  Left column: pain points. Each row is a concrete cloud-LaTeX
					  friction with a category icon, a count badge, and a stagger
					  delay so the cards land one by one. The colours are picked
					  per category (amber/orange/rose/...) to read as a
					  multi-issue feedback board.

					  A vertical mask fades the bottom of the stack into the
					  background so the list never ends with a hard edge against
					  the next section. Purely visual; the cards remain fully
					  clickable.
					-->
					<div
						class="flex flex-col gap-2.5"
						style="mask-image: linear-gradient(to bottom, black 0%, black 78%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 0%, black 78%, transparent 100%);"
					>
						{#each painPoints as point, i (point.id)}
							<Reveal variant="left" delay={i * 70}>
								<article
									class="landing-glass-card group flex items-start gap-3.5 rounded-xl border border-hairline/50 p-4 transition-[border-color,box-shadow] duration-300 hover:border-hairline hover:shadow-craft-sm motion-reduce:transition-none"
								>
									<span
										class="grid size-9 shrink-0 place-items-center rounded-lg {point.iconBg} {point.iconColor}"
									>
										<point.icon class="size-4" stroke-width={1.75} />
									</span>
									<div class="min-w-0 flex-1">
										<p class="text-foreground text-sm leading-snug font-medium">
											{point.title}
										</p>
										<p class="text-foreground/55 mt-1 text-xs leading-relaxed">
											{point.description}
										</p>
									</div>
								</article>
							</Reveal>
						{/each}
					</div>

					<!--
					  Center connector. A hairline column with the GlyphTeX logo
					  as the anchor. Hidden on mobile (the cards already
					  stack vertically). The ping ring around the logo draws
					  the eye across the seam.
					-->
					<div class="hidden lg:flex w-14 flex-col items-center self-stretch" aria-hidden="true">
						<div
							class="h-full w-px flex-1 bg-gradient-to-b from-transparent via-hairline/70 to-transparent"
						></div>
						<div class="relative my-2">
							<span class="absolute inset-0 -m-3 animate-ping rounded-2xl bg-brand/25"></span>
							<span
								class="relative grid size-16 place-items-center rounded-2xl bg-canvas shadow-craft-lg ring-1 ring-hairline"
							>
								<Logo size="md" text={false} badge={false} tone="gradient" />
							</span>
						</div>
						<div
							class="h-full w-px flex-1 bg-gradient-to-b from-transparent via-hairline/70 to-transparent"
						></div>
					</div>

					<!--
					  Right column: the solution card. Compact, neutral chrome
					  (no brand fill, no thick border) so the eye reads the pain
					  points first and the solutions as a quiet answer. Four
					  consolidated fixes, neutral check glyphs, dummy avatars at
					  the footer. Animates in with a 420ms delay.

					  Wording stays plain: researchers care that the file
					  compiles, not which engine compiles it. No engine name,
					  no licence acronym, no jargon.
					-->
					<Reveal variant="right" delay={420}>
						<article
							class="landing-glass-card relative flex flex-col gap-4 rounded-2xl border border-hairline/70 p-6 shadow-craft-sm"
						>
							<header class="flex items-center gap-2">
								<span
									class="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/70"
								>
									<span class="size-1.5 rounded-full bg-success"></span>
									All in place
								</span>
							</header>

							<h3 class="text-xl font-semibold leading-[1.2] tracking-tight text-foreground">
								Fixes that ship with GlyphTeX
							</h3>

							<ul class="flex flex-col gap-2 pt-1">
								{#each solutions as solution, i (i)}
									<Reveal variant="right" delay={500 + i * 50}>
										<li
											class="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-foreground/85"
										>
											<span
												class="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-foreground/10 text-foreground/70"
											>
												<IconCheck class="size-2.5" stroke-width={3} />
											</span>
											<span>{solution}</span>
										</li>
									</Reveal>
								{/each}
							</ul>

							<footer class="border-hairline/60 mt-auto flex items-center gap-2.5 border-t pt-4">
								<span
									class="bg-foreground/5 text-foreground/70 grid size-7 shrink-0 place-items-center rounded-full"
								>
									<IconBrandGithub class="size-3.5" />
								</span>
								<p class="text-[12px] text-foreground/65">
									<span class="text-foreground/85 font-medium">Read it before you trust it</span>
									<br class="sm:hidden" />
									<span class="text-foreground/55"> GPLv3 · No account · Runs offline</span>
								</p>
							</footer>
						</article>
					</Reveal>
				</div>
			</Container>
		</Section>

		<!--
		  Step 1. Open the project you already have. Editor mock in a
		  MacWindow shows a faux file tree + source pane.
		-->
		<Section id="features" spacing="tight" bordered>
			<Container size="wide">
				<ShowcasePanel tone="neutral">
					<div class="grid items-center gap-16 lg:grid-cols-12 lg:gap-24">
						<div class="lg:col-span-6">
							<span
								class="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70"
							>
								<span class="size-1.5 rounded-full bg-brand"></span>
								Step 1 · Open
							</span>
							<h2
								class="landing-text-balance mt-5 text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-5xl"
							>
								Open the project
								<span class="block font-medium italic text-foreground/45"> you already have. </span>
							</h2>
							<p
								class="landing-text-pretty mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
							>
								A GlyphTeX project is a folder of plain .tex files. Bring an Overleaf export, a
								thesis repo, or a fresh blank document. No reshaping, no proprietary format.
							</p>

							<ul class="mt-12 space-y-6">
								{#each [{ icon: IconFileText, title: 'Overleaf export', description: 'Drag the .zip from Overleaf into GlyphTeX. The folder structure stays intact.' }, { icon: IconGitBranch, title: 'Git repository', description: 'Point GlyphTeX at an existing repo. Pulls, pushes, and history work as expected.' }, { icon: IconFolders, title: 'Plain .tex folder', description: 'A directory of chapters, figures, and a .bib. Open it and start writing.' }] as item, i (item.title)}
									{@const Icon = item.icon}
									<Reveal as="li" variant="left" delay={i * 70} class="flex items-start gap-4">
										<span
											class="landing-glass-chip mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl text-foreground/70"
										>
											<Icon class="size-5" />
										</span>
										<span class="pt-1">
											<span class="block text-[15px] font-semibold tracking-tight text-foreground"
												>{item.title}</span
											>
											<span class="mt-2 block text-[14px] leading-relaxed text-muted-foreground"
												>{item.description}</span
											>
										</span>
									</Reveal>
								{/each}
							</ul>

							<div class="mt-12 flex items-center gap-3">
								<Button href={resolve('/workspace')} variant="default" class="gap-2">
									<IconPlayerPlay class="size-4" />
									Try the workspace
								</Button>
							</div>
						</div>

						<div class="lg:col-span-6">
							<Reveal variant="morph">
								<MacWindow
									title="GlyphTeX"
									class="transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-craft-lg"
								>
									<EditorMock />
								</MacWindow>
							</Reveal>
						</div>
					</div>
				</ShowcasePanel>
			</Container>
		</Section>

		<!--
		  Step 2. Compile locally while you write. PolishGrid cycles the
		  "applied automatically" affordances, matching the trace-mvp rhythm.
		-->
		<Section id="workflow" spacing="tight" bordered>
			<Container size="wide">
				<ShowcasePanel tone="neutral">
					<div class="mx-auto flex max-w-3xl flex-col items-center text-center">
						<span
							class="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70"
						>
							<span class="size-1.5 rounded-full bg-brand"></span>
							Step 2 · Compile
						</span>
						<h2
							class="landing-text-balance mt-5 text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-5xl"
						>
							The engine runs
							<span class="block font-medium italic text-foreground/45"> while you write. </span>
						</h2>
						<p
							class="landing-text-pretty mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
						>
							Tectonic compiles your project on every save. The PDF stays live, the bibliography
							stays in sync, and there is no remote queue between you and the build.
						</p>
					</div>

					<PolishGrid features={polishFeatures} />
					<!-- hidden till proper screenshot -->
					<Reveal variant="up" class="mt-14 hidden">
						<figure class="mx-auto max-w-5xl">
							<MacWindow title="GlyphTeX · Editor" class="shadow-craft-xl">
								<div class="bg-linear-to-b from-muted/10 to-background p-1.5">
									<img
										src="/hero-editor.png"
										alt="GlyphTeX editor with live PDF preview"
										width="1920"
										height="1080"
										loading="lazy"
										decoding="async"
										class="block aspect-video w-full rounded-xl object-cover ring-1 ring-hairline"
									/>
								</div>
							</MacWindow>
							<figcaption
								class="mt-5 text-center text-[12.5px] leading-relaxed text-muted-foreground"
							>
								Source on the left, rendered PDF on the right, errors next to the line that caused
								them.
							</figcaption>
						</figure>
					</Reveal>
				</ShowcasePanel>
			</Container>
		</Section>

		<!--
		  How it works. Inspired by the React reference: three fanned
		  showcase tiles above (compile / live preview / history) that
		  enter with a staggered slide, then three step cards below with
		  an animated border that draws in on hover. Replaces the older
		  "Inside the editor" tour section so the workflow reads as one
		  focused beat instead of three.
		-->
		<Section id="how" spacing="tight" bordered>
			<Container size="wide">
				<!--
				  Row 1: three fanned tiles. Static positioning + inline
				  rotate transforms (not framer-motion). Each tile enters
				  with a staggered fly from the bottom; the rotations stay
				  applied during + after the animation because they live in
				  a static `style` attribute.
				-->
				<div class="relative mx-auto flex h-64 items-center justify-center" aria-hidden="true">
					{#each showcaseTiles as tile, i (tile.label)}
						<div
							in:fly={{
								y: 30,
								x: (i - 1) * 40,
								duration: 700,
								delay: 80 + i * 120,
								easing: cubicOut
							}}
							class="landing-glass-card absolute flex h-48 w-48 flex-col items-center justify-center gap-3 rounded-3xl shadow-craft-md"
							style="transform: translateX({tile.offset}px) rotate({tile.rotate}deg);"
						>
							<span class="grid size-12 place-items-center rounded-2xl {tile.bg} {tile.color}">
								<tile.icon class="size-6" stroke-width={1.5} />
							</span>
							<span class="text-sm font-semibold tracking-tight text-foreground">
								{tile.label}
							</span>
						</div>
					{/each}
				</div>

				<!-- Row 2: centered heading. -->
				<div class="mt-12 text-center">
					<Reveal variant="up" delay={420}>
						<span
							class="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70"
						>
							<span class="size-1.5 rounded-full bg-brand"></span>
							How it works
						</span>
					</Reveal>
					<Reveal variant="up" delay={470}>
						<h2
							class="landing-text-balance mt-5 text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-5xl"
						>
							Three steps. No queue. No ceremony.
						</h2>
					</Reveal>
					<Reveal variant="up" delay={520}>
						<p
							class="landing-text-pretty mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
						>
							Open your project, write locally, track every revision. Same LaTeX, just yours.
						</p>
					</Reveal>
				</div>

				<!--
				  Row 3: three step cards. The animated border is an SVG
				  rect with `pathLength="1"` so the dashoffset transition
				  works regardless of the card's actual perimeter. The badge
				  swaps from neutral to brand on hover, matching the border
				  reveal.
				-->
				<div class="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
					{#each howSteps as item, i (item.step)}
						<div
							in:fly={{
								y: 20,
								duration: 600,
								delay: 600 + i * 80,
								easing: cubicOut
							}}
							class="how-step group relative flex min-h-64 flex-col gap-5 rounded-3xl border border-hairline bg-surface-card p-8 transition-colors hover:bg-surface-soft motion-reduce:transition-none"
						>
							<svg
								class="how-step-border-svg pointer-events-none absolute inset-0 size-full overflow-visible"
								aria-hidden="true"
							>
								<rect
									x="1"
									y="1"
									width="calc(100% - 2px)"
									height="calc(100% - 2px)"
									rx="24"
									fill="none"
									stroke="var(--brand)"
									stroke-width="2"
									pathLength="1"
									class="how-step-border"
								/>
							</svg>

							<div class="relative z-10">
								<div
									class="how-step-badge grid size-10 place-items-center rounded-full bg-foreground/5 text-[13px] font-semibold tracking-tight text-foreground/70 transition-colors duration-300"
								>
									{item.step}
								</div>
								<h3 class="mt-6 text-xl font-bold leading-tight tracking-tight text-foreground">
									{item.title}
								</h3>
								<p class="mt-3 text-sm leading-relaxed text-foreground/70">
									{item.body}
								</p>
							</div>
						</div>
					{/each}
				</div>
			</Container>
		</Section>

		<!--
		  Step 3. Track history under your control. Mock of a commit log so
		  the section reads as "this is what you'll actually see", not a
		  generic Git pitch.
		-->
		<Section id="track" spacing="tight" bordered>
			<Container size="wide">
				<ShowcasePanel tone="neutral">
					<div class="grid items-start gap-14 lg:grid-cols-12 lg:gap-20">
						<div class="lg:col-span-5">
							<span
								class="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70"
							>
								<span class="size-1.5 rounded-full bg-brand"></span>
								Step 3 · Track
							</span>
							<h2
								class="landing-text-balance mt-5 text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-5xl"
							>
								History stays
								<span class="block font-medium italic text-foreground/45"> in your repo. </span>
							</h2>
							<p
								class="landing-text-pretty mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
							>
								Diffs, commits, branches, and remotes live in your own repository. GlyphTeX helps
								with the workflow; the archive still belongs to you and the tools you already trust.
							</p>

							<ul class="mt-10 space-y-5">
								{#each [{ icon: IconGitBranch, title: 'Built-in Git UI', description: 'Stage, commit, branch, and merge without leaving the editor.' }, { icon: IconLock, title: 'No proprietary history tier', description: 'Every revision, forever. The repository is the source of truth.' }, { icon: IconBrandGithub, title: 'Works with your remote', description: 'GitHub, GitLab, a self-hosted Gitea, or your university server.' }] as item, i (item.title)}
									{@const Icon = item.icon}
									<Reveal as="li" variant="left" delay={i * 70} class="flex items-start gap-4">
										<span
											class="landing-glass-chip mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl text-foreground/70"
										>
											<Icon class="size-5" />
										</span>
										<span class="pt-1">
											<span class="block text-[15px] font-semibold tracking-tight text-foreground"
												>{item.title}</span
											>
											<span class="mt-2 block text-[14px] leading-relaxed text-muted-foreground"
												>{item.description}</span
											>
										</span>
									</Reveal>
								{/each}
							</ul>
						</div>

						<div class="lg:col-span-7">
							<Reveal variant="morph">
								<div
									class="landing-glass-card relative overflow-hidden rounded-2xl p-7 shadow-craft-lg sm:p-9"
								>
									<div class="relative">
										<span
											class="landing-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80"
										>
											<IconGitBranch class="size-3 text-foreground/70" />
											thesis · history
										</span>

										<h3 class="mt-6 text-2xl font-semibold tracking-tight text-foreground">
											Every commit is a sentence you can roll back to.
										</h3>
										<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
											Same Git you would use from the command line. The editor just makes the common
											cases a click away.
										</p>

										<!--
										  Mock of the commit log. Three real-shaped commits for a
										  thesis workflow: fix typos, add citation, draft chapter.
										  Loops nothing; this is a static visual aid, not a live feed.
										-->
										<div class="mt-7 flex flex-col gap-3">
											{#each [{ msg: 'Final revisions · chapter 5', hash: 'c7d8e9f', who: 'today' }, { msg: 'Add citation · Smith 2024', hash: 'e4f5a6b', who: '2 days ago' }, { msg: 'Draft · conclusion', hash: 'a1b2c3d', who: 'last week' }, { msg: 'Fix typo · section 3.2', hash: '9f8e7d6', who: 'last month' }] as commit (commit.hash)}
												<div
													class="flex items-center gap-3 rounded-lg border border-hairline/60 bg-background/70 px-3.5 py-2.5"
												>
													<span class="size-2 rounded-full bg-success"></span>
													<div class="min-w-0 flex-1">
														<div class="truncate text-sm font-medium text-foreground">
															{commit.msg}
														</div>
														<div class="mt-0.5 font-mono text-[10px] text-muted-foreground">
															{commit.hash} · {commit.who}
														</div>
													</div>
													<span
														class="rounded-md border border-hairline/60 bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
													>
														main
													</span>
												</div>
											{/each}
										</div>
									</div>
								</div>
							</Reveal>
						</div>
					</div>
				</ShowcasePanel>
			</Container>
		</Section>

		<!--
		  Built for academics. Same three-row layout as How-it-works:
		  fanned persona tiles at the top (dummy-avatar silhouettes, no
		  third-party API), heading, three hover-border cards below.
		  Reuses the `.how-step` + `.how-step-border` + `.how-step-badge`
		  styles already in the page <style> block.
		-->
		<Section id="audience" bordered>
			<Container size="wide">
				<!--
				  Row 1: three fanned persona tiles. Static positioning +
				  inline rotate transforms. Each tile enters with a staggered
				  fly, the rotations stay applied via the static style attr.
				-->
				<div class="relative mx-auto flex h-64 items-center justify-center" aria-hidden="true">
					{#each audienceTiles as tile, i (tile.role)}
						<div
							in:fly={{
								y: 30,
								x: (i - 1) * 40,
								duration: 700,
								delay: 80 + i * 120,
								easing: cubicOut
							}}
							class="landing-glass-card absolute flex h-48 w-48 flex-col items-center justify-center gap-3 rounded-3xl shadow-craft-md"
							style="transform: translateX({tile.offset}px) rotate({tile.rotate}deg);"
						>
							<span
								class="grid size-16 place-items-center overflow-hidden rounded-full ring-2 ring-card"
								style="background-color: hsl({tile.hue} {tile.sat}% 58%);"
							>
								<svg viewBox="0 0 40 40" class="size-full" aria-hidden="true">
									<circle cx="20" cy="15" r="5.5" fill="rgba(255,255,255,0.95)" />
									<path
										d="M 5 40 C 5 28 12 23 20 23 C 28 23 35 28 35 40 Z"
										fill="rgba(255,255,255,0.95)"
									/>
								</svg>
							</span>
							<span class="text-sm font-semibold tracking-tight text-foreground">
								{tile.role}
							</span>
						</div>
					{/each}
				</div>

				<!-- Row 2: centered heading. -->
				<div class="mt-12 text-center">
					<Reveal variant="up" delay={420}>
						<span
							class="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70"
						>
							<span class="size-1.5 rounded-full bg-brand"></span>
							Built for academics
						</span>
					</Reveal>
					<Reveal variant="up" delay={470}>
						<h2
							class="landing-text-balance mt-5 text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-5xl"
						>
							Opinionated where it matters, out of your way everywhere else.
						</h2>
					</Reveal>
					<Reveal variant="up" delay={520}>
						<p
							class="landing-text-pretty mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
						>
							The workflow GlyphTeX is opinionated about is the one researchers already live in: a
							folder of .tex files, a bibliography, and a long revision history.
						</p>
					</Reveal>
				</div>

				<!--
				  Row 3: three persona cards. Same hover-border + badge-fill
				  animation as the How-it-works cards, reusing `.how-step` +
				  `.how-step-border` + `.how-step-badge` classes.
				-->
				<div class="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
					{#each audienceCards as card, i (card.title)}
						{@const Icon = card.icon}
						<div
							in:fly={{
								y: 20,
								duration: 600,
								delay: 600 + i * 80,
								easing: cubicOut
							}}
							class="how-step group relative flex min-h-64 flex-col gap-5 rounded-3xl border border-hairline bg-surface-card p-8 transition-colors hover:bg-surface-soft motion-reduce:transition-none"
						>
							<svg
								class="how-step-border-svg pointer-events-none absolute inset-0 size-full overflow-visible"
								aria-hidden="true"
							>
								<rect
									x="1"
									y="1"
									width="calc(100% - 2px)"
									height="calc(100% - 2px)"
									rx="24"
									fill="none"
									stroke="var(--brand)"
									stroke-width="2"
									pathLength="1"
									class="how-step-border"
								/>
							</svg>

							<div class="relative z-10">
								<div
									class="how-step-badge grid size-10 place-items-center rounded-full bg-foreground/5 text-foreground/70 transition-colors duration-300"
								>
									<Icon class="size-5" stroke-width={1.75} />
								</div>
								<h3 class="mt-6 text-xl font-bold leading-tight tracking-tight text-foreground">
									{card.title}
								</h3>
								<p class="mt-3 text-sm leading-relaxed text-foreground/70">{card.body}</p>
							</div>
						</div>
					{/each}
				</div>
			</Container>
		</Section>

		<!--
		  Institutions callout. Two-card row: free for individuals, free for
		  institutions. Same placement as the trace-mvp pricing teaser.
		-->
		<Section id="compare" bordered>
			<Container>
				<SectionHeader
					eyebrow="For the lab"
					title="Free for individuals. Free for the institution."
					description="The same editor and the same engine either way. No seat to count, no licence server, no procurement paperwork."
					align="center"
				/>

				<div class="mt-14 grid gap-4 md:grid-cols-2">
					{#each tiers as tier, i (tier.label)}
						<Reveal variant={i === 0 ? 'left' : 'right'} delay={i * 80}>
							<article
								class="landing-glass-card flex h-full flex-col rounded-2xl p-8 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-craft-lg motion-reduce:transition-none"
							>
								<span
									class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
								>
									{tier.label}
								</span>
								<div class="mt-2 flex items-baseline gap-2">
									<span class="text-4xl font-semibold tracking-tight text-foreground"
										>{tier.price}</span
									>
									<span class="text-sm text-muted-foreground">forever</span>
								</div>
								<p class="mt-3 text-sm leading-relaxed text-muted-foreground">{tier.body}</p>
								<div class="mt-7">
									<Button href={tier.href} variant={i === 0 ? 'default' : 'outline'} class="gap-2">
										{tier.cta}
										<IconArrowRight class="size-4" />
									</Button>
								</div>
							</article>
						</Reveal>
					{/each}
				</div>
			</Container>
		</Section>

		<!--
		  FAQ. Two-column on desktop: sticky title on the left, one-open
		  accordion on the right. Answers only restate claims already made
		  above, so the section never introduces a promise the product
		  doesn't keep.
		-->
		<Section id="faq" bordered>
			<Container>
				<!-- 5/7 rather than 4/8: at col-span-4 the heading broke onto four lines
				     against a half-empty answer column. -->
				<div class="grid gap-12 lg:grid-cols-12 lg:gap-14">
					<div class="lg:col-span-5">
						<div class="lg:sticky lg:top-28">
							<span
								class="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-foreground/70 uppercase"
							>
								<span class="bg-brand size-1.5 rounded-full"></span>
								FAQ
							</span>
							<h2
								class="landing-text-balance mt-5 max-w-sm text-3xl leading-[1.08] font-semibold tracking-tight text-foreground sm:text-4xl"
							>
								Questions worth asking first.
							</h2>
							<p class="text-muted-foreground mt-4 max-w-sm text-sm leading-relaxed text-pretty">
								Everything here restates a claim made further up the page, so nothing in the answers
								is a promise the editor doesn't already keep.
							</p>
							<a
								href="{repo}/issues"
								target="_blank"
								rel="noopener noreferrer"
								class="text-brand group/faq mt-5 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
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
									<!--
									  Accordion card ported from the trace-mvp reference:
									  Plus/Minus icons swap with state, open state fills
									  the card with a subtle bg, body slides open via
									  `svelte/transition` `slide` (reduced motion gets 0ms).
									-->
									<div
										class="overflow-hidden rounded-2xl border transition-colors duration-200 {open
											? 'border-hairline bg-foreground/3'
											: 'border-hairline/60 bg-background/50 hover:border-hairline'}"
									>
										<button
											type="button"
											onclick={() => (openFaq = open ? null : i)}
											aria-expanded={open}
											aria-controls={`faq-panel-${i}`}
											class="group flex w-full items-start gap-3.5 px-5 py-4 text-left"
										>
											<span aria-hidden="true" class="mt-0.5 shrink-0 text-muted-foreground">
												{#if open}
													<IconMinus class="size-4" />
												{:else}
													<IconPlus class="size-4" />
												{/if}
											</span>
											<span
												class="flex-1 text-[15px] font-semibold tracking-tight text-foreground sm:text-base"
											>
												{faq.q}
											</span>
										</button>
										{#if open}
											<div
												id={`faq-panel-${i}`}
												transition:slide={{ duration: reducedMotion ? 0 : 220, easing: cubicOut }}
												class="overflow-hidden"
											>
												<p class="pb-5 pl-12 pr-5 text-sm leading-relaxed text-muted-foreground">
													{faq.a}
												</p>
											</div>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</Container>
		</Section>

		<!--
		  Final CTA. Two CTAs side by side, honest copy. Matches the
		  trace-mvp rhythm of "ready when you are".
		-->
		<Section id="cta" spacing="tight" bordered>
			<Container size="wide">
				<ShowcasePanel tone="neutral" padding="loose">
					<div class="mx-auto flex max-w-3xl flex-col items-center text-center">
						<Reveal variant="scale">
							<div
								class="landing-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80"
							>
								<span class="size-1.5 rounded-full bg-foreground/40"></span>
								ready for early adopters
							</div>
						</Reveal>

						<Reveal variant="up" delay={70}>
							<h2
								class="landing-text-balance mt-7 text-4xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-[4rem]"
							>
								Your next paper, written locally.
								<span class="block font-medium italic text-foreground/40">
									No queue, no license.
								</span>
							</h2>
						</Reveal>

						<Reveal variant="up" delay={140}>
							<p
								class="landing-text-pretty mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
							>
								Open a thesis in 30 seconds. Compile on your machine. Version it in Git. Free for
								individuals, free for the lab.
							</p>
						</Reveal>

						<Reveal
							variant="up"
							delay={210}
							class="mt-10 flex flex-wrap items-center justify-center gap-3"
						>
							<Button
								href={resolve('/workspace')}
								variant="default"
								size="lg"
								class="gap-2.5"
								onclick={() => track('cta_workspace_click', { location: 'final_cta' })}
							>
								<IconPlayerPlay class="size-4" />
								Try the workspace
							</Button>
						</Reveal>

						<Reveal variant="up" delay={280} class="mt-6 flex justify-center">
							<a
								href={repo}
								target="_blank"
								rel="noopener noreferrer"
								class="group/cta inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
							>
								Or read the source on GitHub
								<IconArrowRight
									class="size-3.5 transition-transform group-hover/cta:translate-x-0.5"
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
	 * Marquee for the trust-logos row below the hero card. We duplicate
	 * the logo list in markup so the track can translate by exactly half
	 * its width (50%) and wrap seamlessly without a JS tween. Reduced
	 * motion pins the track to its start so the logos still read as a
	 * strip but don't slide.
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
		will-change: transform;
	}

	/* Otherwise a logo slides out from under the cursor before it can be clicked. */
	.marquee-mask:hover .marquee-track,
	.marquee-mask:focus-within .marquee-track {
		animation-play-state: paused;
	}

	/*
	 * How-it-works step cards. The animated border uses an SVG rect with
	 * `pathLength="1"` so the dashoffset transition works regardless of
	 * the card's actual perimeter. The badge fills from neutral to brand
	 * on the same hover so the card reads as one beat.
	 */
	.how-step-border {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		opacity: 0;
		transition:
			stroke-dashoffset 0.7s ease-out,
			opacity 0.25s ease-out;
	}

	.how-step:hover .how-step-border {
		stroke-dashoffset: 0;
		opacity: 1;
	}

	.how-step:hover .how-step-badge {
		background-color: var(--brand);
		color: var(--canvas);
	}

	@media (prefers-reduced-motion: reduce) {
		.marquee-track {
			animation: none;
		}

		.how-step-border {
			transition: none;
			stroke-dashoffset: 0;
			opacity: 0.6;
		}
	}
</style>
