<script lang="ts">
	import { resolve } from '$app/paths';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import SiteHeader from '$lib/SiteHeader.svelte';
	import { trackEvent } from '$lib/analytics';
	import { Button } from '@glyphx/ui/button';
	import { Card } from '@glyphx/ui/card';
	import { Reveal } from '@glyphx/ui/reveal';
	import {
		IconArrowLeft,
		IconArrowRight,
		IconBolt,
		IconBrandGithub,
		IconCheck,
		IconChevronDown,
		IconCloudOff,
		IconColumns,
		IconDeviceFloppy,
		IconFileImport,
		IconFileText,
		IconFileZip,
		IconFolderCode,
		IconFolderOpen,
		IconGitBranch,
		IconLock,
		IconPlayerPlay,
		IconQuote,
		IconWriting,
		IconX
	} from '@tabler/icons-svelte';

	let heroImgOk = $state(true);
	let deckScroller = $state<HTMLDivElement | null>(null);

	function scrollDeck(direction: -1 | 1) {
		deckScroller?.scrollBy({ left: direction * 340, behavior: 'smooth' });
	}

	const repo = 'https://github.com/kanakkholwal/glyphx';

	// Decorative dot-pattern SVGs (vendored locally so they render offline).
	const patternLeft = '/decor/pattern-left.svg';
	const patternRight = '/decor/pattern-right.svg';
	const patternTall = '/decor/pattern-tall.svg';

	type ImportSource = {
		icon: typeof IconBolt;
		label: string;
	};

	type StartCard = {
		eyebrow: string;
		title: string;
		subtitle: string;
		cta: string;
		href: string;
		items: string[];
		highlight?: boolean;
	};

	type FeatureDeckCard = {
		icon: typeof IconBolt;
		title: string;
		runsLabel: string;
		runsValue: string;
		replaces: string[];
		body: string;
	};

	type WorkflowStep = {
		step: string;
		title: string;
		body: string;
		accent: string;
		bullets: string[];
	};

	type CompareRow = {
		label: string;
		glyph: boolean | string;
		overleaf: boolean | string;
		desktop: boolean | string;
	};

	const importSources: ImportSource[] = [
		{ icon: IconFileImport, label: 'Overleaf export' },
		{ icon: IconGitBranch, label: 'Git repository' },
		{ icon: IconFolderCode, label: 'Plain .tex folder' },
		{ icon: IconFileZip, label: '.zip archive' }
	];

	const featureDeck: FeatureDeckCard[] = [
		{
			icon: IconBolt,
			title: 'Local compile',
			runsLabel: 'Engine:',
			runsValue: 'Tectonic + System TeX',
			replaces: ["Overleaf's cloud queue"],
			body: 'Compile where your files live. Tectonic ships in the desktop app and the web build compiles in-browser — no server round-trip and no shared queue between you and your PDF.'
		},
		{
			icon: IconColumns,
			title: 'Live preview',
			runsLabel: 'View:',
			runsValue: 'Editor + PDF, side by side',
			replaces: ['The manual refresh loop'],
			body: 'Source and rendered output share one surface. Errors surface next to the line that caused them, and the preview stays live as you type instead of waiting on a rebuild.'
		},
		{
			icon: IconGitBranch,
			title: 'Version history',
			runsLabel: 'Built in:',
			runsValue: 'Full Git UI',
			replaces: ['A separate Git client'],
			body: 'Diffs, commits, branches, and remotes without leaving the editor. The history lives in your own repository — not behind a paid history tier or a proprietary sync log.'
		},
		{
			icon: IconCloudOff,
			title: 'Offline & private',
			runsLabel: 'Network:',
			runsValue: 'Optional, never required',
			replaces: ['Always-on sync'],
			body: 'Nothing uploads by default. Write on a plane, keep drafts on your own disk, and push to a remote only when you choose to. Your source of truth stays on your machine.'
		}
	];

	const startCards: StartCard[] = [
		{
			eyebrow: 'Desktop',
			title: 'Download directly',
			subtitle: 'Bundled local compile and the full private workflow',
			cta: 'Download GlyphX',
			href: resolve('/download'),
			items: [
				'Bundled Tectonic engine',
				'Git, diff, and history in the app',
				'Projects stay as normal folders on disk',
				'Fast offline writing and preview'
			]
		},
		{
			eyebrow: 'Browser',
			title: 'Start instantly',
			subtitle: 'The same interface, with in-browser compile for quick access',
			cta: 'Open browser editor',
			href: resolve('/editor'),
			items: [
				'No install to test the workflow',
				'Shared UI with the desktop app',
				'Good for quick edits and demos',
				'Move to native when you want the deepest setup'
			],
			highlight: true
		}
	];

	const workflowSteps: WorkflowStep[] = [
		{
			step: 'Step 1',
			title: 'Open the project you already have',
			body: 'GlyphX treats a paper as a normal folder, not a cloud artifact. Bring in an Overleaf export, a thesis repo, or a fresh blank project.',
			accent: 'signal-cyan',
			bullets: ['Plain files on disk', 'No account required', 'Import without reshaping']
		},
		{
			step: 'Step 2',
			title: 'Compile locally while you write',
			body: 'The editor and engine share one view. Errors surface next to the work, previews stay live, and there is no network round-trip for every compile.',
			accent: 'signal-blue',
			bullets: ['Bundled engine on desktop', 'In-browser compile on web', 'Fast feedback loops']
		},
		{
			step: 'Step 3',
			title: 'Keep history under your control',
			body: 'Diffs, commits, and remotes remain yours. GlyphX helps with the workflow, but the repository still belongs to you and the tools you already trust.',
			accent: 'signal-lime',
			bullets: ['Built-in Git UI', 'No locked history tiers', 'Works with your remote']
		}
	];

	const compareRows: CompareRow[] = [
		{ label: 'Runs fully offline', glyph: true, overleaf: false, desktop: true },
		{ label: 'Nothing uploaded by default', glyph: true, overleaf: false, desktop: true },
		{ label: 'Real LaTeX project folders', glyph: true, overleaf: true, desktop: true },
		{ label: 'Built-in preview and editor in one app', glyph: true, overleaf: true, desktop: false },
		{ label: 'Git workflows without extra tooling', glyph: true, overleaf: 'Paid', desktop: 'External app' },
		{ label: 'No compile queue or shared server timeout', glyph: true, overleaf: 'Cloud limit', desktop: true }
	];

	const faqs = [
		{
			q: 'Is GlyphX just a prettier shell around LaTeX?',
			a: 'No. The goal is to keep standard LaTeX while fixing the workflow around it: local compile, integrated preview, built-in Git, and a shared desktop and web interface.'
		},
		{
			q: 'Do I need a TeX distribution installed first?',
			a: 'Not for the core path. The desktop app can use the bundled engine, and the web app compiles in the browser. If you prefer a system installation, GlyphX can use that too.'
		},
		{
			q: 'Where are my projects stored?',
			a: 'On your machine as normal files and folders. That is the default architecture, not an export option.'
		},
		{
			q: 'Can I move projects in from Overleaf or an existing repo?',
			a: 'Yes. GlyphX works with ordinary LaTeX project folders, so importing an existing codebase is the normal flow.'
		},
		{
			q: 'Why keep both web and desktop?',
			a: 'The web build gives you instant access and in-browser compile. The desktop app gives you the deepest local workflow. Both share the same UI so the product feels coherent instead of split.'
		}
	];
</script>

<svelte:head>
	<title>GlyphX | Local-first LaTeX, redesigned around how writing actually works</title>
	<meta
		name="description"
		content="GlyphX is a local-first LaTeX editor with side-by-side preview, local compile, and built-in Git. Keep your drafts private and your workflow fast."
	/>
</svelte:head>

<div class="min-h-screen bg-canvas font-sans text-ink antialiased selection:bg-brand-subtle">
	<SiteHeader />

	<main>
		<section class="landing-shell landing-hero border-b border-hairline">
			<div class="landing-hero__wash"></div>
			<div class="mx-auto max-w-7xl px-6 lg:px-10 pb-18 pt-18 sm:pb-24 sm:pt-24">
				<Reveal variant="up" class="relative mx-auto flex max-w-5xl flex-col items-center text-center">
					<a
						href={repo}
						target="_blank"
						rel="noopener noreferrer"
						class="landing-trust-mark transition-colors hover:bg-surface-soft"
					>
						<IconBrandGithub class="size-4" />
						Open source · runs on your machine
					</a>

					<h1 class="mt-16 max-w-4xl text-balance text-[2.15rem] font-medium leading-[1.04] tracking-[-0.045em] text-ink sm:text-[3rem] lg:text-[3.5rem]">
						Turn scattered LaTeX workflows into
					</h1>
					<div class="landing-hero-word mt-4">GLYPHX</div>

					<p class="mt-10 max-w-[34rem] text-balance text-[1.05rem] leading-[1.55] text-ink-body sm:text-[1.2rem]">
						A local-first editor that keeps writing, preview, compile, and version history in one
						calm workspace instead of spread across a browser tab, sync loop, and side tools.
					</p>

					<div class="mt-11 flex flex-col items-center gap-4 sm:flex-row">
						<Button
							href={resolve('/download')}
							variant="default"
							size="pill"
							onclick={() => trackEvent('cta_download_click', { location: 'hero_redesign_v3' })}
						>
							Download desktop app
						</Button>
						<Button href={resolve('/editor')} variant="landing_ghost" size="pill">
							<IconPlayerPlay class="size-4 text-brand" />
							Open browser editor
						</Button>
					</div>

					<div class="mt-16 flex items-center gap-4 text-sm leading-6 text-ink-body">
						<span>Built for private writing you can rely on</span>
						<div class="landing-trust-mark">
							<IconLock class="size-4" />
							Local-first
						</div>
					</div>

					<img src={patternLeft} alt="" aria-hidden="true" class="landing-corner-image landing-corner-image--left" />
					<img src={patternRight} alt="" aria-hidden="true" class="landing-corner-image landing-corner-image--right" />
				</Reveal>
			</div>
		</section>

		<section class="landing-shell border-b border-hairline bg-surface-card">
			<div class="border-b border-hairline">
				<div class="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-7 lg:flex-row lg:items-center lg:justify-center lg:px-10">
					<p class="text-center text-[0.96rem] leading-[1.3] text-ink">
						Bring the projects
						<br />
						you already have
					</p>
					<div class="landing-tool-strip flex-wrap">
						{#each importSources as source}
							<span class="landing-import-item">
								<source.icon class="size-4" />
								{source.label}
							</span>
						{/each}
						<span class="text-sm font-medium tracking-[-0.01em] text-ink-muted">no reformatting</span>
					</div>
				</div>
			</div>

			<div class="mx-auto max-w-7xl px-6 lg:px-10 py-16 sm:py-20">
				<Reveal variant="up">
					<div class="flex items-end justify-between gap-6 px-4">
						<h2 class="landing-section-title max-w-3xl">
							One workspace for the whole
							<em>writing loop</em>
						</h2>
						<div class="hidden items-center gap-3 lg:flex">
							<button
								type="button"
								class="landing-arrow-button"
								aria-label="Scroll cards left"
								onclick={() => scrollDeck(-1)}
							>
								<IconArrowLeft class="size-5" />
							</button>
							<button
								type="button"
								class="landing-arrow-button"
								aria-label="Scroll cards right"
								onclick={() => scrollDeck(1)}
							>
								<IconArrowRight class="size-5" />
							</button>
						</div>
					</div>
				</Reveal>

				<div bind:this={deckScroller} class="mt-10 overflow-x-auto no-scrollbar mx-4">
					<div class="landing-feature-deck">
						{#each featureDeck as card, index}
							<Reveal variant="up" delay={index * 60}>
								<Card tone="editorial" class="landing-feature-card">
									<div class="landing-feature-card__badge">
										<card.icon class="size-5 text-ink" />
									</div>
									<h3 class="text-[1.18rem] font-medium leading-[1.15] tracking-[-0.035em] text-ink">
										{card.title}
									</h3>
									<div class="space-y-4 text-[0.97rem] text-ink-body">
										<div class="grid grid-cols-[4.6rem_1fr] gap-2">
											<span class="text-ink-muted">{card.runsLabel}</span>
											<span>{card.runsValue}</span>
										</div>
										<div class="grid grid-cols-[4.6rem_1fr] gap-2">
											<span class="text-ink-muted">Replaces:</span>
											<div class="flex flex-wrap items-center gap-2">
												{#each card.replaces as item}
													<span class="rounded-full border border-hairline bg-surface-soft px-2.5 py-1 text-[0.82rem] text-ink-body">
														{item}
													</span>
												{/each}
											</div>
										</div>
									</div>
									<p class="mt-auto text-[0.98rem] leading-[1.75] text-ink-muted">
										{card.body}
									</p>
								</Card>
							</Reveal>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<section class="landing-shell border-b border-hairline">
			<div class="mx-auto max-w-7xl px-6 lg:px-10 py-18 sm:py-24">
				<div class="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
					<Reveal variant="up">
						<p class="landing-section-label">Inside the workspace</p>
						<h2 class="landing-section-title mt-4 max-w-xl">
							The editor you'll actually <em>write in</em>
						</h2>
						<p class="mt-6 max-w-xl text-lg leading-8 text-ink-body">
							Source on the left, live PDF on the right, and everything — compile, errors, and
							history — a keystroke away. No jumping between a browser tab, a sync loop, and a
							pile of side tools just to see your paper.
						</p>
						<div class="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
							<Card tone="soft" size="sm" class="landing-mini-stat">
								<span class="landing-mini-stat__value">Private</span>
								<span class="landing-mini-stat__label">Drafts stay on your machine by default</span>
							</Card>
							<Card tone="soft" size="sm" class="landing-mini-stat">
								<span class="landing-mini-stat__value">Real</span>
								<span class="landing-mini-stat__label">Standard .tex projects, not a custom format</span>
							</Card>
							<Card tone="soft" size="sm" class="landing-mini-stat">
								<span class="landing-mini-stat__value">Shared</span>
								<span class="landing-mini-stat__label">One UI across desktop and web</span>
							</Card>
						</div>
					</Reveal>

					<Reveal variant="scale" delay={100}>
						<div class="landing-editor-stage">
							<div class="landing-browser">
								<div class="landing-browser__bar">
									<div class="landing-browser__traffic">
										<span></span>
										<span></span>
										<span></span>
									</div>
									<div class="landing-browser__title">glyphx / thesis.tex</div>
								</div>

								<div class="landing-browser__body">
									{#if heroImgOk}
										<img
											src="/hero-editor.png"
											alt="GlyphX editor preview"
											class="block w-full"
											onerror={() => (heroImgOk = false)}
										/>
									{:else}
										<div class="grid h-full gap-px bg-hairline md:grid-cols-[0.9fr_1.1fr]">
											<div class="bg-surface-card p-6 font-mono text-[13px] leading-7 text-ink-muted">
												<div class="text-signal-blue">\documentclass&#123;article&#125;</div>
												<div class="text-signal-cyan">\usepackage&#123;amsmath,graphicx&#125;</div>
												<div class="mt-5 text-ink">\begin&#123;document&#125;</div>
												<div class="mt-3">
													The local-first editor keeps the paper, preview, and history in one place.
												</div>
												<div class="mt-3 text-signal-lime">\end&#123;document&#125;</div>
											</div>
											<div class="bg-canvas p-8">
												<div class="mx-auto max-w-md rounded-[1.5rem] border border-hairline bg-surface-card px-8 py-10 shadow-craft-lg">
													<p class="text-center font-serif text-3xl italic text-ink">
														Local-first typesetting
													</p>
													<p class="mt-8 text-sm leading-7 text-ink-body">
														Write once in standard LaTeX. Keep the source on your disk. Compile fast,
														review visually, and stay in control of project history.
													</p>
													<div class="mt-8 space-y-2 text-sm text-ink-muted">
														<div class="flex items-center gap-2">
															<IconCheck class="size-4 text-signal-cyan" />
															Side-by-side preview
														</div>
														<div class="flex items-center gap-2">
															<IconCheck class="size-4 text-signal-blue" />
															Local compile
														</div>
														<div class="flex items-center gap-2">
															<IconCheck class="size-4 text-signal-lime" />
															Private project folders
														</div>
													</div>
												</div>
											</div>
										</div>
									{/if}
								</div>
							</div>
						</div>
					</Reveal>
				</div>
			</div>
		</section>

		<section id="features" class="landing-shell border-b border-hairline">
			<div class="mx-auto max-w-7xl px-6 lg:px-10 py-20 sm:py-28">
				<Reveal variant="up" class="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
					<div class="max-w-3xl">
						<p class="landing-section-label">How you start</p>
						<h2 class="landing-section-title mt-4 max-w-3xl">
							Two entry points, one shared <em>GlyphX</em>
						</h2>
					</div>
					<p class="max-w-xl text-base leading-7 text-ink-body sm:text-lg">
						Same interface, same projects, same shortcuts on both. Start in the browser in
						seconds, or install the desktop app for the bundled engine and the full offline
						workflow.
					</p>
				</Reveal>

				<div class="mt-14 grid gap-5 lg:grid-cols-2">
					{#each startCards as card, index}
						<Reveal variant="up" delay={index * 60}>
							<Card
								tone={card.highlight ? 'soft' : 'editorial'}
								class={`landing-start-card ${card.highlight ? 'landing-start-card--highlight' : ''}`}
							>
								<div class="landing-start-card__top">
									<p class="text-[2rem] font-medium tracking-[-0.04em] text-ink">{card.eyebrow}</p>
									<div>
										<h3 class="mt-6 text-balance text-[2.35rem] font-medium leading-none tracking-[-0.05em] text-ink sm:text-[3rem]">
											{card.title}
										</h3>
										<p class="mt-3 text-lg leading-7 text-ink-muted">{card.subtitle}</p>
									</div>
								</div>

								<Button href={card.href} variant={card.highlight ? 'default' : 'landing_soft'} size="pill" class="mt-1 w-full">
									{card.cta}
								</Button>

								<div class="landing-start-card__divider"></div>

								<div>
									<p class="text-lg font-medium tracking-[-0.02em] text-ink">
										{card.highlight
											? 'Best when you want instant access:'
											: 'Best when you want the full local setup:'}
									</p>
									<ul class="mt-5 space-y-4">
										{#each card.items as item}
											<li class="flex items-start gap-3 text-lg leading-7 text-ink-body">
												<IconCheck class="mt-1 size-4 shrink-0 text-ink" />
												<span>{item}</span>
											</li>
										{/each}
									</ul>
								</div>
							</Card>
						</Reveal>
					{/each}
				</div>
			</div>
		</section>

		<section id="workflow" class="landing-shell border-b border-hairline bg-surface-soft/35">
			<div class="mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:px-10">
				<Reveal variant="up" class="mx-auto max-w-4xl text-center">
					<p class="landing-section-label justify-center">How it works</p>
					<h2 class="landing-section-title mt-4">
						From scattered tools to one
						<em>private writing cockpit</em>
					</h2>
				</Reveal>

				<div class="mt-16 grid gap-5 lg:grid-cols-3">
					{#each workflowSteps as step, index}
						<Reveal variant="up" delay={index * 70}>
							<article class="landing-workflow-card">
								<div class="landing-workflow-card__visual">
									{#if index === 0}
										<!-- Step 1 — a real project is just a folder of files -->
										<div class="absolute inset-0 flex flex-col gap-2 p-5 font-mono text-[0.75rem] leading-none">
											<div class="flex items-center gap-2 text-ink">
												<IconFolderOpen class="size-4 text-signal-cyan" />
												thesis/
											</div>
											<div class="ml-3.5 flex items-center gap-2 rounded-md bg-signal-cyan-soft px-2 py-1.5 text-ink">
												<IconFileText class="size-3.5 text-signal-cyan" />
												main.tex
											</div>
											<div class="ml-3.5 flex items-center gap-2 px-2 py-1 text-ink-body">
												<IconFileText class="size-3.5 text-ink-muted" />
												references.bib
											</div>
											<div class="ml-3.5 flex items-center gap-2 px-2 py-1 text-ink-body">
												<IconFolderCode class="size-3.5 text-ink-muted" />
												chapters/
											</div>
											<div class="ml-8 flex items-center gap-2 px-2 text-ink-muted">
												<IconFileText class="size-3.5" />
												intro.tex
											</div>
										</div>
									{:else if index === 1}
										<!-- Step 2 — source and preview share one surface -->
										<div class="absolute inset-0 grid grid-cols-2 gap-px bg-hairline">
											<div class="bg-surface-card p-3.5 font-mono text-[0.62rem] leading-[1.7]">
												<div class="text-signal-blue">\section&#123;Intro&#125;</div>
												<div class="text-ink-body">A local-first</div>
												<div class="text-ink-body">workflow.</div>
												<div class="mt-1 text-signal-blue">\begin&#123;equation&#125;</div>
												<div class="text-ink">E = mc^2</div>
												<div class="text-signal-blue">\end&#123;equation&#125;</div>
											</div>
											<div class="bg-canvas p-3">
												<div class="flex h-full flex-col gap-1.5 rounded-lg border border-hairline bg-surface-card p-3">
													<div class="h-2 w-1/2 rounded bg-ink/70"></div>
													<div class="mt-1 h-1.5 w-full rounded bg-ink/15"></div>
													<div class="h-1.5 w-11/12 rounded bg-ink/15"></div>
													<div class="my-1.5 h-6 w-2/3 self-center rounded bg-signal-blue/20"></div>
													<div class="h-1.5 w-full rounded bg-ink/15"></div>
													<div class="h-1.5 w-4/5 rounded bg-ink/15"></div>
												</div>
											</div>
										</div>
									{:else}
										<!-- Step 3 — history stays in your own repo -->
										<div class="absolute inset-0 flex flex-col justify-center p-6">
											<div class="relative flex flex-col gap-4">
												<span class="absolute bottom-2 left-[0.4rem] top-2 w-px bg-hairline"></span>
												{#each [['Final revisions', 'c7d8e9f'], ['Fix bibliography', 'e4f5a6b'], ['Draft chapter 3', 'a1b2c3d']] as [msg, hash] (hash)}
													<div class="relative flex items-center gap-3">
														<span class="z-10 size-[0.85rem] rounded-full border-2 border-surface-card bg-signal-lime"></span>
														<div>
															<div class="text-[0.76rem] leading-tight text-ink">{msg}</div>
															<div class="font-mono text-[0.64rem] text-ink-muted">{hash}</div>
														</div>
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</div>
								<p class="text-sm font-medium uppercase tracking-[0.22em] text-ink-muted">{step.step}</p>
								<h3 class="mt-4 text-2xl font-medium tracking-[-0.03em] text-ink">{step.title}</h3>
								<p class="mt-4 text-base leading-7 text-ink-body">{step.body}</p>
								<ul class="mt-6 space-y-2">
									{#each step.bullets as bullet}
										<li class="flex items-center gap-2 text-sm text-ink-muted">
											<IconCheck class="size-4 text-brand" />
											{bullet}
										</li>
									{/each}
								</ul>
							</article>
						</Reveal>
					{/each}
				</div>
			</div>
		</section>

		<section id="compare" class="landing-shell border-b border-hairline">
			<div class="mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:px-10">
				<Reveal variant="up" class="mx-auto mb-14 max-w-3xl text-center">
					<p class="landing-section-label justify-center">The honest comparison</p>
					<h2 class="landing-section-title mt-4">
						Your files, your machine, <em>your call</em>
					</h2>
				</Reveal>

				<div class="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
					<Reveal variant="up">
						<div class="landing-contrast-panel flex flex-col">
							<div class="landing-contrast-panel__header">
								<IconQuote class="size-4 text-brand" />
								Typical cloud-LaTeX friction
							</div>

							<div class="space-y-4 p-6 text-sm leading-7 text-ink-body">
								<div class="landing-contrast-line">
									<IconCloudOff class="mt-0.5 size-4 shrink-0 text-destructive" />
									Compile depends on a remote session and network health.
								</div>
								<div class="landing-contrast-line">
									<IconWriting class="mt-0.5 size-4 shrink-0 text-warning" />
									Writing, preview, file management, and Git live in separate tools.
								</div>
								<div class="landing-contrast-line">
									<IconDeviceFloppy class="mt-0.5 size-4 shrink-0 text-destructive" />
									Your default source of truth is someone else's infrastructure.
								</div>
							</div>

							<div class="mt-auto flex items-start gap-3 border-t border-hairline bg-brand-subtle/30 px-6 py-5">
								<span class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-subtle">
									<IconCheck class="size-3.5 text-brand" />
								</span>
								<div>
									<p class="text-sm font-medium text-ink">The GlyphX approach</p>
									<p class="mt-1 text-sm leading-7 text-ink-muted">
										Keep the project local, compile where the files live, and make the interface
										feel more like a focused writing instrument than a browser utility.
									</p>
								</div>
							</div>
						</div>
					</Reveal>

					<Reveal variant="up" delay={80}>
						<div class="overflow-hidden rounded-[2rem] border border-hairline bg-surface-card shadow-craft-lg">
							<div class="grid grid-cols-[1.7fr_1fr_1fr_1fr] border-b border-hairline bg-surface-soft px-6 py-4 text-sm font-medium">
								<div class="text-ink-muted">Capability</div>
								<div class="flex items-center justify-center gap-1.5 font-semibold text-brand">
									<span class="size-1.5 rounded-full bg-brand"></span>
									GlyphX
								</div>
								<div class="text-center text-ink-muted">Overleaf</div>
								<div class="text-center text-ink-muted">Classic desktop</div>
							</div>

							{#each compareRows as row}
								<div class="grid grid-cols-[1.7fr_1fr_1fr_1fr] items-center border-b border-hairline px-6 py-4 text-sm transition-colors last:border-b-0 hover:bg-surface-soft/40">
									<div class="pr-6 text-ink">{row.label}</div>

									<div class="flex justify-center">
										{#if row.glyph === true}
											<span class="grid size-6 place-items-center rounded-full bg-brand-subtle">
												<IconCheck class="size-3.5 text-brand" />
											</span>
										{:else}
											<span class="text-xs font-medium text-brand">{row.glyph}</span>
										{/if}
									</div>

									<div class="flex justify-center text-center">
										{#if row.overleaf === true}
											<IconCheck class="size-4 text-ink-muted" />
										{:else if row.overleaf === false}
											<IconX class="size-4 text-ink-muted/50" />
										{:else}
											<span class="text-xs text-ink-muted">{row.overleaf}</span>
										{/if}
									</div>

									<div class="flex justify-center text-center">
										{#if row.desktop === true}
											<IconCheck class="size-4 text-ink-muted" />
										{:else if row.desktop === false}
											<IconX class="size-4 text-ink-muted/50" />
										{:else}
											<span class="text-xs text-ink-muted">{row.desktop}</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</Reveal>
				</div>
			</div>
		</section>

		<section id="faq" class="landing-shell border-b border-hairline bg-surface-soft/25">
			<div class="mx-auto max-w-4xl px-6 py-20 sm:py-28 lg:px-10">
				<Reveal variant="up" class="text-center">
					<p class="landing-section-label justify-center">FAQ</p>
					<h2 class="landing-section-title mt-4">
						Questions worth asking before trusting a LaTeX tool
					</h2>
				</Reveal>

				<div class="mt-14 flex flex-col gap-px overflow-hidden rounded-[2rem] border border-hairline bg-hairline">
					{#each faqs as item, index}
						<Reveal variant="up" delay={index * 45} class="bg-surface-card p-6 sm:p-8">
							<details class="group">
								<summary class="flex cursor-pointer items-center justify-between gap-6 font-medium text-ink [&::-webkit-details-marker]:hidden">
									<span class="text-lg tracking-[-0.02em]">{item.q}</span>
									<IconChevronDown class="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
								</summary>
								<p class="mt-5 max-w-3xl text-base leading-7 text-ink-body">{item.a}</p>
							</details>
						</Reveal>
					{/each}
				</div>
			</div>
		</section>

		<section class="landing-shell">
			<div class="mx-auto max-w-6xl px-6 py-20 sm:py-28 lg:px-10">
				<Reveal variant="scale">
					<div class="landing-cta-panel">
						<img src={patternTall} alt="" aria-hidden="true" class="landing-cta-pattern landing-cta-pattern--left" />
						<img src={patternTall} alt="" aria-hidden="true" class="landing-cta-pattern landing-cta-pattern--right" />

						<p class="landing-section-label justify-center">Ready when you are</p>
						<h2 class="landing-section-title mt-4 max-w-4xl">
							Keep your writing <em>local, fast, and yours</em>
						</h2>
						<p class="mt-6 max-w-2xl text-lg leading-8 text-ink-body">
							Open a project in the browser right now, or download the desktop app for bundled
							compile and offline Git. No account, no upload, no lock-in.
						</p>
						<div class="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
							<Button href={resolve('/download')} variant="landing_soft" size="pill">
								Download GlyphX
								<IconArrowRight class="size-4" />
							</Button>
							<Button href={resolve('/editor')} variant="landing_ghost" size="pill">
								Open editor
							</Button>
						</div>
					</div>
				</Reveal>
			</div>
		</section>
	</main>

	<SiteFooter />
</div>
