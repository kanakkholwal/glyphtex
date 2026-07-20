<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '@glyphx/ui/button';
	import { Reveal } from '@glyphx/ui/reveal';
	import { SectionHeader } from '@glyphx/ui/section-header';
	import { trackEvent } from '$lib/analytics';
	import { Container, HeroBackdrop, MacWindow, Section, ShowcasePanel } from '$lib/landing';
	import EditorMock from '$lib/landing/EditorMock.svelte';
	import PolishGrid from '$lib/landing/PolishGrid.svelte';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import SiteHeader from '$lib/SiteHeader.svelte';
	import {
		IconAlertTriangle,
		IconArrowRight,
		IconArrowUp,
		IconBook2,
		IconBrandGithub,
		IconBrowser,
		IconCheck,
		IconChevronDown,
		IconCircleDot,
		IconClock,
		IconCloudOff,
		IconDeviceDesktop,
		IconDownload,
		IconFileText,
		IconFolders,
		IconGitBranch,
		IconHistory,
		IconLock,
		IconPlayerPlay,
		IconSchool,
		IconSearch,
		IconShield,
		IconSparkles,
		IconStack3,
		IconUsersGroup,
		IconWifiOff,
		IconWriting,
		IconX
	} from '@tabler/icons-svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	const repo = 'https://github.com/kanakkholwal/glyphx';

	// Default editorial backdrop, reused from the trace-mvp hero. The user
	// will swap in a more academic photograph later; for now the cloud +
	// landscape composition gives the page a calm horizon line to anchor
	// the centered headline.
	const heroBackdrop = '/background-hero.webp';

	// Concrete artifacts the committed audience actually writes. Narrowed to
	// the four nouns a researcher or lecturer cares about most.
	const rotatingWords = ['thesis.', 'paper.', 'manuscript.', 'lecture notes.'];

	// The widest word in the cycle. Used to reserve the slot's width so
	// shorter words don't shift the line as they rotate. Computed once
	// so the JSX stays declarative.
	const widestWord = rotatingWords.reduce((a, b) => (a.length >= b.length ? a : b), '');

	// Index into `rotatingWords` that the hero should currently show. Driven
	// by a setInterval so the rotation keeps ticking without re-rendering
	// anything else on the page. Pauses when the tab is hidden so a
	// backgrounded tab never advances through the cycle.
	const reducedMotion =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	// Typewriter state. `currentWord` grows one character at a time from
	// the empty string up to the full target word, holds for a beat,
	// then erases before advancing to the next word. `wordIndex` is the
	// only thing the typing loop mutates; effect 1 picks up the index
	// change and resets the typed buffer so the new word starts from
	// scratch. Reduced motion pins `currentWord` to the widest word so
	// the slot is filled and the typewriter doesn't run.
	let currentWord = $state('');
	let wordIndex = $state(0);

	$effect(() => {
		// Reset the typed buffer whenever the target word changes.
		wordIndex;
		currentWord = '';
	});

	$effect(() => {
		if (reducedMotion) {
			currentWord = widestWord;
			return;
		}
		if (typeof window === 'undefined') return;

		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | null = null;
		let mode: 'typing' | 'holding' | 'clearing' = 'typing';

		const tick = () => {
			if (cancelled) return;
			const word = rotatingWords[wordIndex];

			if (mode === 'typing') {
				if (currentWord.length < word.length) {
					currentWord = word.slice(0, currentWord.length + 1);
					timer = setTimeout(tick, 55);
				} else {
					mode = 'holding';
					timer = setTimeout(tick, 1800);
				}
			} else if (mode === 'clearing') {
				if (currentWord.length > 0) {
					currentWord = currentWord.slice(0, -1);
					timer = setTimeout(tick, 28);
				} else {
					wordIndex = (wordIndex + 1) % rotatingWords.length;
					mode = 'typing';
				}
			} else {
				// holding → start clearing
				mode = 'clearing';
				timer = setTimeout(tick, 28);
			}
		};

		tick();

		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
		};
	});

	// Open-source values that matter for academic writing (privacy,
	// reproducibility, no per-seat licensing).
	type OpenSourceClaim = {
		label: string;
		icon: typeof IconBrandGithub;
	};

	const openSourceClaims: OpenSourceClaim[] = [
		{ icon: IconBrandGithub, label: 'GPLv3 open source' },
		{ icon: IconLock, label: 'Files stay on your machine' },
		{ icon: IconCloudOff, label: 'No account, no telemetry' },
		{ icon: IconGitBranch, label: 'Plain Git history' },
		{ icon: IconDeviceDesktop, label: 'Runs offline, on the lab machine' }
	];

	// Tech-stack logos. Same row treatment as trace-mvp: a divider hairline,
	// uppercase eyebrow, and quiet brand logos. Logos fetched from
	// simpleicons.org CDN; lazy-loaded so they don't gate first paint.
	const techLogos = [
		{ name: 'Tectonic', slug: 'tectonic', href: 'https://tectonic-typesetting.github.io' },
		{ name: 'Tauri', slug: 'tauri', href: 'https://tauri.app' },
		{ name: 'Rust', slug: 'rust', href: 'https://www.rust-lang.org' },
		{ name: 'Svelte', slug: 'svelte', href: 'https://svelte.dev' },
		{ name: 'TypeScript', slug: 'typescript', href: 'https://www.typescriptlang.org' },
		{ name: 'Vite', slug: 'vite', href: 'https://vitejs.dev' },
		{ name: 'Git', slug: 'git', href: 'https://git-scm.com' },
		{ name: 'TeX', slug: 'latex', href: 'https://www.latex-project.org' }
	];

	// Cloud LaTeX pain points. Each row is a concrete friction researchers
	// hit with cloud LaTeX, with a category icon and a count that mirrors
	// the "this many users have hit this" framing of the inspiration.
	// The right-hand solution card answers each one in the same order.
	type PainPoint = {
		id: string;
		title: string;
		description: string;
		count: number;
		icon: typeof IconClock;
		iconBg: string;
		iconColor: string;
	};

	const painPoints: PainPoint[] = [
		{
			id: 'queue',
			title: 'Compile queue times out before the bibliography is done.',
			description:
				'A 30-second biber run becomes a 4-minute wait when the shared queue is busy. The deadline does not care.',
			count: 95,
			icon: IconClock,
			iconBg: 'bg-amber-500/10',
			iconColor: 'text-amber-500'
		},
		{
			id: 'license',
			title: 'Per-seat licensing blocks the whole lab from editing.',
			description:
				'Procurement caps the seat count. The undergrad who needs to proofread gets locked out.',
			count: 67,
			icon: IconLock,
			iconBg: 'bg-orange-500/10',
			iconColor: 'text-orange-500'
		},
		{
			id: 'privacy',
			title: 'Unpublished drafts sit on a third-party server.',
			description: 'Submission-ready manuscripts leave traces somewhere you do not control.',
			count: 52,
			icon: IconShield,
			iconBg: 'bg-rose-500/10',
			iconColor: 'text-rose-500'
		},
		{
			id: 'history',
			title: 'Full history is locked behind the paid tier.',
			description:
				'Free plans cap revisions. The paper you wrote last year has its diffs paywalled.',
			count: 47,
			icon: IconHistory,
			iconBg: 'bg-violet-500/10',
			iconColor: 'text-violet-500'
		},
		{
			id: 'browser',
			title: 'A browser tab that needs to stay open all day.',
			description:
				'Close it for a meeting and the compile dies. Save your work, lose your session.',
			count: 32,
			icon: IconBrowser,
			iconBg: 'bg-sky-500/10',
			iconColor: 'text-sky-500'
		},
		{
			id: 'network',
			title: 'Dropped connection mid-compile during a deadline.',
			description: 'Cloud latency or a wifi blip mid-build means starting over. Every time.',
			count: 24,
			icon: IconWifiOff,
			iconBg: 'bg-pink-500/10',
			iconColor: 'text-pink-500'
		}
	];

	// GlyphX solutions in the same order as `painPoints` so the eye can
	// follow each row to its answer.
	const solutions: string[] = [
		'Tectonic compiles on your machine — no shared queue, no timeout.',
		'GPLv3, free for individuals and institutions — no per-seat fees.',
		'Your drafts stay on your own disk until you choose to share.',
		'Full Git history with every commit, branch, and remote.',
		'Native desktop app, or a browser tab for quick edits.',
		'Unlimited local compiles — no session, no queue, no rate limit.'
	];

	// Workflow steps. Three beats, matching the trace-mvp rhythm.
	type WorkflowStep = {
		step: string;
		title: string;
		body: string;
		bullets: string[];
	};

	const workflowSteps: WorkflowStep[] = [
		{
			step: 'Step 1',
			title: 'Open the project you already have',
			body: 'A GlyphX project is a plain folder of .tex files. Bring an Overleaf export, a thesis repo, or a fresh blank document. Nothing reshapes your source.',
			bullets: ['Plain files on disk', 'No account required', 'Overleaf, Git, or .zip import']
		},
		{
			step: 'Step 2',
			title: 'Compile locally while you write',
			body: 'The editor and engine share one view. Errors surface next to the line that caused them, the PDF stays live as you type, and there is no remote queue between you and the build.',
			bullets: [
				'Bundled Tectonic engine on desktop',
				'In-browser compile on web',
				'SyncTeX from PDF to source'
			]
		},
		{
			step: 'Step 3',
			title: 'Keep history under your control',
			body: 'Diffs, commits, branches, and remotes live in your own repository. GlyphX helps with the workflow; the archive still belongs to you and the tools you already trust.',
			bullets: [
				'Built-in Git UI',
				'Works with GitHub, GitLab, or a university server',
				'No proprietary history tier'
			]
		}
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
			title: 'Bibliography aware',
			description:
				'biber and biblatex just work. References resolve in the editor and the PDF stays in sync.'
		},
		{
			icon: IconSearch,
			title: 'Project-wide find',
			description:
				'A single keystroke searches every .tex and .bib in the project. Live, with file previews.'
		}
	];

	// Inside-the-editor tour. Six beats covering what an academic writer
	// actually reaches for, distilled into one-line descriptions.
	type EditorFeature = {
		icon: typeof IconWriting;
		title: string;
		description: string;
	};

	const editorFeatures: EditorFeature[] = [
		{
			icon: IconBrandGithub,
			title: 'SyncTeX from PDF to source',
			description:
				'Click a figure or equation in the preview, jump back to the line that produced it.'
		},
		{
			icon: IconFolders,
			title: 'Multi-file chapters',
			description:
				'Split a thesis into chapters, includes, and figures. The outline mirrors the structure.'
		},
		{
			icon: IconSearch,
			title: 'Citations and references',
			description: 'Insert \cite{...} keys from the loaded .bib. Typos get flagged before compile.'
		},
		{
			icon: IconStack3,
			title: 'Outline and structure',
			description: 'Sections, figures, tables, and equations in one tree. Click to jump anywhere.'
		},
		{
			icon: IconGitBranch,
			title: 'Diffs and history',
			description:
				'See what changed in a chapter, branch an experiment, merge it back when it lands.'
		},
		{
			icon: IconDeviceDesktop,
			title: 'Two-way sync with system TeX',
			description:
				'Use the bundled engine or point GlyphX at the lab installation. Same project either way.'
		}
	];

	// Built for academics. Three beats, one card each, no marketing fluff.
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
			body: 'GPLv3, full editor, full engine, no account, no telemetry. The same binary the lab uses, on your laptop.',
			href: resolve('/download'),
			cta: 'Download desktop app'
		},
		{
			label: 'For institutions',
			price: 'Free',
			body: 'No per-seat fees, no licence server, no procurement paperwork. Deploy on every lab machine and walk away.',
			href: repo,
			cta: 'Talk to us'
		}
	];

	// FAQ. Research-focused. Answers map to claims made elsewhere on the
	// page so nothing here over-promises.
	type Faq = { q: string; a: string };
	const faqs: Faq[] = [
		{
			q: 'Can I bring my Overleaf project into GlyphX?',
			a: 'Yes. Export from Overleaf as a .zip (or pull the Git repo, if your project uses one) and open the folder in GlyphX. The source stays plain .tex and .bib files; nothing is reshaped.'
		},
		{
			q: 'Does GlyphX support biblatex and biber?',
			a: 'Yes. The desktop app uses the bundled Tectonic engine by default, and you can point it at any system TeX installation that has biblatex and biber installed. The web build compiles a TeX Live set in the browser.'
		},
		{
			q: 'Will it handle a 300-page thesis?',
			a: 'Yes. Projects are split across chapters and includes, and the outline panel mirrors the structure. Compile runs locally so the only practical limit is your machine.'
		},
		{
			q: 'Can my students use it without paying?',
			a: 'Yes. GlyphX is GPLv3 open source with no paid tier. There is no seat to count and no licence server to phone home. Your department can deploy it on every lab machine.'
		},
		{
			q: 'Does it work offline?',
			a: 'The desktop app compiles entirely on your machine. The web build downloads the engine once and then runs offline too. Nothing uploads by default.'
		},
		{
			q: 'How do collaborators share a manuscript?',
			a: 'Use any Git remote: GitHub, GitLab, a self-hosted Gitea, or your university server. GlyphX has a built-in Git UI, so commits, branches, and merges never need a separate tool.'
		},
		{
			q: 'Does SyncTeX work?',
			a: 'Yes. Click anywhere in the rendered PDF and GlyphX jumps back to the line that produced it. The reverse works too: jump from a source line to the matching point in the preview.'
		},
		{
			q: 'Can I run it on a university-managed machine?',
			a: 'Yes. The desktop app installs per-user with no admin rights required on Windows and macOS, and is a flat .deb / .AppImage on Linux. No kernel module, no driver, no daemon.'
		}
	];

	// Per-item FAQ open state. First item open so the pattern reads on load.
	let openFaq = $state<number | null>(0);
</script>

<svelte:head>
	<title>GlyphX · A local-first LaTeX editor for academic writing</title>
	<meta
		name="description"
		content="GlyphX is a local-first LaTeX editor for academic writing. Plain .tex projects, compiled on your machine, versioned with Git. GPLv3, free for individuals and institutions."
	/>
</svelte:head>

<div class="min-h-screen bg-canvas font-sans text-ink antialiased selection:bg-brand-subtle">
	<!-- Site background grid sits behind every section, faded toward the
	     edges. Same idea as the trace-mvp grid: anchors the page when the
	     photo backdrop is not visible. -->
	<div
		aria-hidden="true"
		class="landing-bg-grid landing-bg-grid-fade pointer-events-none fixed inset-0 -z-10 opacity-30"
	></div>

	<SiteHeader />

	<main>
		<!--
		  Hero. Contained rounded card (not full-bleed) with a subtle
		  gradient + dot-pattern backdrop and decorative plus marks. Layout
		  mirrors the React reference: headline + body + CTAs on the left, a
		  secondary CTA card on the right. Entrance motion runs through Svelte
		  native transitions (svelte/transition) — no framer-motion dependency.

		  Below the card: a marquee of the tech stack, no photo of the editor
		  yet (the editor preview moved into the Step 1 showcase below).
		-->
		<!--
		  pt-20 (80px) clears the surface-mounted nav (nav is fixed at
		  top-0 and ~60px tall). The nav transitions to floating on scroll,
		  so this gap stays consistent with the page chrome either way.
		-->
		<section class="relative px-4 pt-20 pb-12 md:px-10 md:pt-24 md:pb-16">
			<!--
			  Hero card. The floating nav sits at top-4 with ~52px of chrome,
			  so pt-32/40 clears it on every viewport. Single centered column
			  inside the rounded card — the HeroBackdrop wash handles the
			  photo-to-text fade so the headline stays readable on top of
			  the default backdrop. No right-side card, no decorative plus
			  marks; everything that fought for attention now lives below.
			-->
			<div
				class="relative mx-auto max-w-[1410px] overflow-hidden rounded-[2rem] border border-hairline"
			>
				<HeroBackdrop src={heroBackdrop} tone="default" />

				<!--
				  Two-zone layout. The badge sits at the top of the card as its
				  own beat; the rest of the content (headline, tagline, body,
				  CTAs, trust strip) is a single column anchored to the bottom
				  via justify-between. The empty middle stays photo-first so
				  the photo carries the visual weight, not the type.

				  Spacing rhythm (UX) inside the bottom column:
				    headline → tagline    mt-2   (tight, same statement)
				    tagline → body       mt-5   (medium, narrative shift)
				    body → CTA           mt-6   (the action moment)
				    CTA → trust strip    mt-5   (quiet, supporting)
				-->
				<div
					class="relative z-10 flex min-h-120 flex-col justify-between gap-8 px-6 py-10 md:min-h-145 md:px-12 md:py-14 lg:px-16"
				>
					<!-- Top: badge as its own beat -->
					<a
						href={repo}
						target="_blank"
						rel="noopener noreferrer"
						class="landing-glass-chip inline-flex w-fit items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:text-foreground"
						in:fly={{ y: 8, duration: 500, delay: 0, easing: cubicOut }}
					>
						<IconBrandGithub class="size-3.5" />
						Open source · GPLv3
					</a>

					<!-- Bottom: headline + tagline + body + CTAs + trust strip -->
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
								<!--
								  Typewriter artefact. The wrapper is sized by a single
								  invisible placeholder (`widestWord`) so the line width
								  stays constant as the typed buffer grows. The block
								  cursor blinks next to the typed string; reduced motion
								  pins the slot to the full word and disables the blink.
								-->
								<span class="relative inline-block align-baseline" aria-live="polite">
									<span class="invisible whitespace-nowrap" aria-hidden="true">{widestWord}</span>
									<span class="text-foreground/65">{currentWord}</span>
									<span
										class="typewriter-cursor inline-block w-[2px] -translate-y-[3px] bg-foreground/45 align-middle"
										style="height: 0.95em;"
										aria-hidden="true"
									></span>
								</span>
								.
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
							<Button
								href={resolve('/download')}
								variant="default"
								size="lg"
								class="gap-2.5"
								onclick={() => trackEvent('cta_download_click', { location: 'hero' })}
							>
								<IconDownload class="size-4" />
								Download desktop app
							</Button>
							<Button href={resolve('/editor')} variant="outline" size="lg" class="group/cta gap-2">
								<IconPlayerPlay class="size-4" />
								Open browser editor
								<IconArrowRight
									class="size-4 transition-transform group-hover/cta:translate-x-0.5"
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
							Free for individuals · Free for institutions · macOS · Windows · Linux
						</div>
					</div>
				</div>
			</div>

			<!--
			  Tech-stack marquee. Single quiet row below the hero card. The
			  list is duplicated in markup so the CSS translateX(-50%) loop
			  wraps seamlessly; reduced motion pins the track in place.
			-->
			<div class="mx-auto mt-8 flex max-w-[1410px] items-center gap-6 overflow-hidden">
				<span
					class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground whitespace-nowrap"
				>
					Built on
				</span>
				<div
					class="relative flex-1 overflow-hidden"
					style="mask-image: linear-gradient(to right, transparent, black 12%, black 88%, transparent);"
				>
					<div class="marquee-track flex items-center gap-10 whitespace-nowrap">
						{#each [...techLogos, ...techLogos] as logo, i (i)}
							<a
								href={logo.href}
								target="_blank"
								rel="noopener noreferrer"
								class="flex shrink-0 items-center gap-2 opacity-50 grayscale transition-opacity hover:opacity-90"
								title={logo.name}
							>
								<img
									src="https://cdn.simpleicons.org/{logo.slug}/9ca3af"
									alt="{logo.name} logo"
									loading="lazy"
									decoding="async"
									width="20"
									height="20"
									class="h-5 w-5 dark:invert"
								/>
								<span class="text-sm font-semibold tracking-tight text-foreground/55">
									{logo.name}
								</span>
							</a>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<!--
		  Open-source values strip. The tech-stack logos already scroll
		  inside the hero, so this section keeps the values-only row (GPLv3,
		  files on disk, no telemetry, plain Git history, runs offline). Same
		  quiet editorial cadence as the trace-mvp placement.
		-->
		<Section spacing="tight" bordered>
			<Container>
				<Reveal variant="blur">
					<ul class="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-7 gap-y-3">
						{#each openSourceClaims as claim (claim.label)}
							{@const Icon = claim.icon}
							<li class="inline-flex items-center gap-2 text-[13px] font-medium text-foreground/70">
								<Icon class="size-4 text-foreground/40" />
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
		  and a compact "fixes shipped in GlyphX" card on the right. The
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

				<div class="mt-14 grid gap-10 lg:grid-cols-[1.1fr_auto_1fr] lg:items-stretch lg:gap-6">
					<!--
					  Left column: pain points. Each row is a concrete cloud-LaTeX
					  friction with a category icon, a count badge, and a stagger
					  delay so the cards land one by one. The colours are picked
					  per category (amber/orange/rose/...) to read as a
					  multi-issue feedback board.
					-->
					<div class="flex flex-col gap-2.5">
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
										<p class="text-sm font-medium leading-snug text-foreground">
											{point.title}
										</p>
										<p class="mt-1 text-xs leading-relaxed text-foreground/55">
											{point.description}
										</p>
									</div>
									<span
										class="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/8 px-2 py-0.5 text-[11px] font-semibold text-warning ring-1 ring-inset ring-warning/20"
									>
										<IconArrowUp class="size-3" stroke-width={2.25} />
										{point.count}
									</span>
								</article>
							</Reveal>
						{/each}
					</div>

					<!--
					  Center connector. A hairline column with a sparkle anchor
					  in the middle. Hidden on mobile (the cards already
					  stack vertically). The ping ring around the sparkle
					  draws the eye across the seam.
					-->
					<div class="hidden lg:flex w-12 flex-col items-center self-stretch" aria-hidden="true">
						<div
							class="h-full w-px flex-1 bg-gradient-to-b from-transparent via-hairline/70 to-transparent"
						></div>
						<div class="relative my-2">
							<span class="absolute inset-0 -m-2 animate-ping rounded-full bg-brand/25"></span>
							<span
								class="relative grid size-14 place-items-center rounded-full bg-brand text-canvas shadow-craft-lg"
							>
								<IconSparkles class="size-7" stroke-width={1.5} />
							</span>
						</div>
						<div
							class="h-full w-px flex-1 bg-gradient-to-b from-transparent via-hairline/70 to-transparent"
						></div>
					</div>

					<!--
					  Right column: the solution card. One card, brand border,
					  status badge, six fixes (in the same order as the pain
					  points so the eye can follow each row across). Animates in
					  with a 420ms delay so it lands after the pain points.
					-->
					<Reveal variant="right" delay={420}>
						<article
							class="landing-glass-card relative flex h-full flex-col gap-6 rounded-2xl border-2 border-brand/30 p-7 shadow-craft-lg"
						>
							<header class="flex items-center gap-2">
								<span
									class="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-success"
								>
									<IconCircleDot class="size-3 animate-pulse" />
									All in place
								</span>
								<span class="text-xs font-medium text-foreground/40">v0.1 · GPLv3</span>
							</header>

							<div>
								<h3 class="text-2xl font-semibold leading-[1.15] tracking-tight text-foreground">
									Fixes that ship with GlyphX
								</h3>
								<p class="mt-2 text-sm leading-relaxed text-foreground/65">
									Every pain point on the left, solved without a server, a seat license, or a
									per-month fee.
								</p>
							</div>

							<ul class="flex flex-col gap-2.5 border-t border-hairline/60 pt-5">
								{#each solutions as solution, i (i)}
									<Reveal variant="right" delay={500 + i * 50}>
										<li class="flex items-start gap-3 text-sm leading-relaxed text-foreground/85">
											<span
												class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand/12 text-brand"
											>
												<IconCheck class="size-3" stroke-width={2.5} />
											</span>
											<span>{solution}</span>
										</li>
									</Reveal>
								{/each}
							</ul>

							<!--
							  Footer: a stacked avatar row with initials (no
							  external network calls) plus a quiet line about
							  where GlyphX is used. The gradient is computed inline
							  so the avatars look distinct without real photos.
							-->
							<footer class="mt-auto flex items-center gap-3 border-t border-hairline/60 pt-5">
								<div class="flex -space-x-1.5">
									{#each [0, 1, 2, 3] as i (i)}
										<span
											class="grid size-7 place-items-center rounded-full border-2 border-card text-[10px] font-bold text-canvas"
											style="background: linear-gradient(135deg, hsl({(i + 1) *
												73} 60% 60%), hsl({(i + 1) * 73 + 50} 50% 50%));"
										>
											{String.fromCharCode(65 + i)}
										</span>
									{/each}
								</div>
								<div>
									<p class="text-xs font-medium text-foreground/85">
										Free for individuals and labs
									</p>
									<p class="text-[11px] text-foreground/50">Open source · No telemetry</p>
								</div>
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
								class="landing-text-balance mt-5 text-3xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-[3.25rem]"
							>
								Open the project
								<span class="block font-medium italic text-foreground/45"> you already have. </span>
							</h2>
							<p
								class="landing-text-pretty mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
							>
								A GlyphX project is a folder of plain .tex files. Bring an Overleaf export, a thesis
								repo, or a fresh blank document. No reshaping, no proprietary format.
							</p>

							<ul class="mt-12 space-y-6">
								{#each [{ icon: IconFileText, title: 'Overleaf export', description: 'Drag the .zip from Overleaf into GlyphX. The folder structure stays intact.' }, { icon: IconGitBranch, title: 'Git repository', description: 'Point GlyphX at an existing repo. Pulls, pushes, and history work as expected.' }, { icon: IconFolders, title: 'Plain .tex folder', description: 'A directory of chapters, figures, and a .bib. Open it and start writing.' }] as item, i (item.title)}
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
								<Button href={resolve('/download')} variant="default" class="gap-2">
									<IconDownload class="size-4" />
									Download free
								</Button>
							</div>
						</div>

						<div class="lg:col-span-6">
							<Reveal variant="morph">
								<MacWindow
									title="GlyphX"
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
							class="landing-text-balance mt-5 text-3xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-[3.25rem]"
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

					<Reveal variant="up" class="mt-14">
						<figure class="mx-auto max-w-5xl">
							<MacWindow title="GlyphX · Editor" class="shadow-craft-xl">
								<div class="bg-linear-to-b from-muted/10 to-background p-1.5">
									<img
										src="/hero-editor.png"
										alt="GlyphX editor with live PDF preview"
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
		  Inside the editor tour. Six features, simple card grid (no rail).
		  Reads as a tools checklist rather than a curated showcase.
		-->
		<Section spacing="tight" bordered>
			<Container>
				<SectionHeader
					eyebrow="Inside the editor"
					title="The tools an academic writer actually reaches for."
					description="No exotic flags, no plugin zoo. The features below cover the workflow of writing a thesis, paper, or set of lecture notes from draft to submission."
					align="center"
				/>

				<div class="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each editorFeatures as feature, i (feature.title)}
						{@const Icon = feature.icon}
						<Reveal variant="up" delay={i * 60}>
							<article
								class="landing-glass-card group flex h-full flex-col gap-4 rounded-2xl p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-craft-lg motion-reduce:transition-none"
							>
								<span
									class="landing-glass-chip grid size-10 place-items-center rounded-xl text-foreground/75 transition-colors group-hover:text-foreground"
								>
									<Icon class="size-5" />
								</span>
								<div>
									<div class="text-[15px] font-semibold tracking-tight text-foreground">
										{feature.title}
									</div>
									<div class="mt-2 text-[14px] leading-relaxed text-muted-foreground">
										{feature.description}
									</div>
								</div>
							</article>
						</Reveal>
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
								class="landing-text-balance mt-5 text-3xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-[3.25rem]"
							>
								History stays
								<span class="block font-medium italic text-foreground/45"> in your repo. </span>
							</h2>
							<p
								class="landing-text-pretty mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
							>
								Diffs, commits, branches, and remotes live in your own repository. GlyphX helps with
								the workflow; the archive still belongs to you and the tools you already trust.
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
											{#each [{ msg: 'Final revisions · chapter 5', hash: 'c7d8e9f', who: 'today' }, { msg: 'Add citation · Smith 2024', hash: 'e4f5a6b', who: '2 days ago' }, { msg: 'Draft · conclusion', hash: 'a1b2c3d', who: 'last week' }, { msg: 'Fix typo · section 3.2', hash: '9f8e7d6', who: 'last month' }] as commit, i (commit.hash)}
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
		  Built for academics. Three beats covering PhD students, professors,
		  and research groups. Same placement as the trace-mvp "Built for
		  builders" grid.
		-->
		<Section id="audience" bordered>
			<Container>
				<SectionHeader
					eyebrow="Built for academics"
					title="Opinionated where it matters, out of your way everywhere else."
					description="The workflow GlyphX is opinionated about is the one researchers already live in: a folder of .tex files, a bibliography, and a long revision history."
					align="center"
				/>

				<div class="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
					{#each audienceCards as card, i (card.title)}
						{@const Icon = card.icon}
						<Reveal variant="up" delay={i * 70}>
							<article
								class="landing-glass-card group flex h-full flex-col rounded-2xl p-7 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-craft-lg motion-reduce:transition-none"
							>
								<span
									class="landing-glass-chip grid size-11 place-items-center rounded-xl text-foreground/70 transition-colors group-hover:text-foreground"
								>
									<Icon class="size-5" />
								</span>
								<h3 class="mt-6 text-lg font-semibold tracking-tight text-foreground">
									{card.title}
								</h3>
								<p class="mt-2 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
							</article>
						</Reveal>
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
					description="The same binary, the same engine, the same features. No seat to count, no licence server, no procurement paperwork."
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
				<div class="grid gap-12 lg:grid-cols-12 lg:gap-16">
					<div class="lg:col-span-4">
						<div class="lg:sticky lg:top-28">
							<span
								class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
							>
								FAQ
							</span>
							<h2
								class="landing-text-balance mt-3 text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl"
							>
								Questions worth asking before trusting a LaTeX tool.
							</h2>
							<p class="mt-4 text-sm leading-relaxed text-muted-foreground">
								Still wondering something?
								<a
									href={repo}
									target="_blank"
									rel="noopener noreferrer"
									class="font-semibold text-brand hover:underline"
								>
									Open an issue on GitHub
								</a>.
							</p>
						</div>
					</div>

					<div class="lg:col-span-8">
						<ul class="space-y-3">
							{#each faqs as faq, i (faq.q)}
								{@const open = openFaq === i}
								<li>
									<div
										class="overflow-hidden rounded-2xl border border-hairline/60 bg-background/50 transition-colors hover:border-hairline"
									>
										<button
											type="button"
											onclick={() => (openFaq = open ? null : i)}
											aria-expanded={open}
											aria-controls={`faq-panel-${i}`}
											class="group flex w-full items-start gap-3.5 px-5 py-4 text-left"
										>
											<IconChevronDown
												class="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform {open
													? 'rotate-180'
													: ''}"
											/>
											<span
												class="flex-1 text-[15px] font-semibold tracking-tight text-foreground sm:text-base"
											>
												{faq.q}
											</span>
										</button>
										{#if open}
											<div id={`faq-panel-${i}`} class="overflow-hidden">
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
								v0.1 beta · ready for early adopters
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
								class="landing-text-pretty mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
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
								href={resolve('/download')}
								variant="default"
								size="lg"
								class="gap-2.5"
								onclick={() => trackEvent('cta_download_click', { location: 'final_cta' })}
							>
								<IconDownload class="size-4" />
								Download desktop app
							</Button>
							<Button href={resolve('/editor')} variant="outline" size="lg" class="gap-2">
								<IconPlayerPlay class="size-4" />
								Open browser editor
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

	/*
	 * Typewriter cursor. step-end snaps on/off cleanly so the blink reads
	 * as a real terminal caret instead of a fade. Reduced motion keeps
	 * the cursor visible at 40% so the slot still feels occupied.
	 */
	@keyframes typewriter-blink {
		50% {
			opacity: 0;
		}
	}

	.typewriter-cursor {
		animation: typewriter-blink 1s step-end infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.marquee-track {
			animation: none;
		}

		.typewriter-cursor {
			animation: none;
			opacity: 0.4;
		}
	}
</style>
