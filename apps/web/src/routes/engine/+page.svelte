<script lang="ts">
	import { resolve } from '$app/paths';
	import { track } from '$lib/analytics';
	import { Container, HeroBackdrop, Section } from '$lib/landing';
	import { REPO_URL } from '$lib/landing/nav-data';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import SiteHeader from '$lib/SiteHeader.svelte';
	import { Button } from '@glyphtex/ui/button';
	import { Reveal } from '@glyphtex/ui/reveal';
	import { SectionHeader } from '@glyphtex/ui/section-header';
	import {
		IconArrowRight,
		IconBook2,
		IconBrandGithub,
		IconCheck,
		IconCloudOff,
		IconCpu,
		IconFileText,
		IconPackage,
		IconRuler,
		IconShieldCheck,
		IconTypography,
		IconX
	} from '@tabler/icons-svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	const heroBackdrop = '/background-section.webp';

	// Every figure here is measured against the artifacts this site ships, not
	// estimated. Re-measure with `pnpm engine:refresh` + scripts/check-size-budget.sh
	// before editing any of them.
	const stats = [
		{ value: '1.07 MB', label: 'Engine, brotli', note: 'the compiler itself' },
		{ value: '~600 ms', label: 'Typical recompile', note: 'two passes, refs resolved' },
		{ value: '1,534', label: 'TeX files bundled', note: 'core plus default packs' },
		{ value: '0', label: 'Network calls to compile', note: 'after the first load' }
	];

	const hardParts = [
		{
			icon: IconCloudOff,
			title: 'Lookups are synchronous, the web is not',
			body: 'TeX asks for a file mid-compile and expects an answer immediately — there is nothing to await inside a font lookup. Fetching pieces on demand forces a permanent connection. GlyphTeX resolves everything before the engine starts, so a compile touches memory and nothing else.'
		},
		{
			icon: IconTypography,
			title: 'TeX has no graceful degradation',
			body: 'A missing font is not a smaller font — it is a hang or a blank page. An early build guessed at absent metrics by matching size digits, and booktabs spun forever while a font-size change silently emitted a 15-byte PDF. A wrong file is strictly worse than an absent one.'
		},
		{
			icon: IconPackage,
			title: 'A file list is not a working package',
			body: 'Shipping siunitx.sty does not mean siunitx compiles. Presence and correctness are different claims, and only one of them is worth making to someone on a deadline.'
		}
	];

	const different = [
		{
			icon: IconCheck,
			title: 'The bundle is proven, not listed',
			body: 'Every package group is verified by compiling a real document that uses it. The build feeds missing files back and loops until each fixture produces a PDF — and refuses to ship if one cannot. Coverage is defined by documents that compile, not by a manifest anyone can typo.'
		},
		{
			icon: IconCloudOff,
			title: 'Offline by construction',
			body: 'The engine, the TeX distribution and the package sets are content-hashed artifacts held in the browser cache. First load downloads them once. After that, compiling on a plane behaves exactly like compiling at a desk, because the code path is identical.'
		},
		{
			icon: IconBook2,
			title: 'Bibliographies actually build',
			body: 'BibTeX is compiled into the engine and runs between passes, so \\bibliography and biblatex with backend=bibtex resolve into a real reference list — offline, in the browser. Citations become references, not [?].'
		},
		{
			icon: IconShieldCheck,
			title: 'It fails honestly',
			body: 'There is no fuzzy font substitution. A file that is missing is reported as missing, mapped to the package set that provides it, and offered as a one-click install. Silence and guesswork are treated as bugs.'
		},
		{
			icon: IconPackage,
			title: 'Packages you add, not a monolith',
			body: 'The core carries what most documents need. Everything else lives in dependency-resolved package sets that install on demand and are keyed by content hash, so an update never serves half of an old set and half of a new one.'
		},
		{
			icon: IconRuler,
			title: 'Size is a build gate, not a hope',
			body: 'The compressed engine and the first-run download are measured on every CI run and enforced against a budget. A change that makes the compiler heavier fails the build instead of quietly reaching your users.'
		}
	];

	const pipeline = [
		{
			step: '01',
			title: 'Mount',
			body: 'Your project and the TeX distribution are placed in one in-memory filesystem. Files a pass writes are readable by the next.'
		},
		{
			step: '02',
			title: 'Typeset',
			body: 'XeTeX runs and writes the .aux, .toc and cross-reference intermediates alongside the page data.'
		},
		{
			step: '03',
			title: 'Bibliography',
			body: 'If the document asks for one, BibTeX reads the .aux and your .bib and writes the formatted .bbl.'
		},
		{
			step: '04',
			title: 'Converge',
			body: 'Passes repeat until the intermediates stop changing — the reason references and citations settle instead of reading “??”.'
		},
		{
			step: '05',
			title: 'Render',
			body: 'xdvipdfmx turns the page data into the PDF, with fonts subset and embedded.'
		}
	];

	// Naming what does not work is part of the pitch: an engine that overstates
	// its reach costs more time than one that draws the line clearly.
	const limits = [
		{
			works: false,
			title: 'Biber',
			body: 'A Perl program with no WebAssembly build. biblatex works with backend=bibtex; on its default backend the workspace tells you the one-line change rather than silently dropping the bibliography.'
		},
		{
			works: false,
			title: 'Shell-escape',
			body: 'Packages that run external programs mid-compile cannot work: WebAssembly has no way to start a subprocess. Nothing in the sandbox can be talked into it.'
		},
		{
			works: true,
			title: 'Everything a normal paper needs',
			body: 'Math, figures, TikZ and pgfplots, tables, beamer, hyperref, microtype, cross-references, and BibTeX bibliographies all compile.'
		}
	];
</script>

<svelte:head>
	<title>How GlyphTeX works: a real TeX engine in your browser</title>
	<meta
		name="description"
		content="GlyphTeX compiles LaTeX in the browser with Tectonic's XeTeX and BibTeX built to WebAssembly — offline, with a bundle proven by compiling real documents rather than listing files."
	/>
</svelte:head>

<div class="bg-canvas text-ink selection:bg-brand-subtle min-h-screen font-sans antialiased">
	<div
		aria-hidden="true"
		class="landing-bg-grid landing-bg-grid-fade pointer-events-none fixed inset-0 -z-10 opacity-30"
	></div>

	<SiteHeader />

	<main>
		<!-- Hero: same full-bleed shape as the home page so the two read as one site. -->
		<section class="relative min-h-dvh w-full overflow-hidden">
			<HeroBackdrop src={heroBackdrop} tone="default" wash="left" />

			<div
				class="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col justify-center px-6 pt-28 pb-16 lg:px-10"
			>
				<span
					class="text-foreground/70 mb-8 inline-flex w-fit items-center gap-2 self-start text-[11px] font-semibold tracking-[0.18em] uppercase"
					in:fly={{ y: 8, duration: 500, easing: cubicOut }}
				>
					<span class="bg-brand size-1.5 rounded-full"></span>
					How it works
				</span>

				<div class="flex max-w-3xl flex-col items-start text-left">
					<h1
						class="landing-text-balance text-foreground text-[2.5rem] leading-[1.05] font-bold tracking-[-0.025em] sm:text-5xl md:text-[3.25rem]"
						in:fly={{ y: 12, duration: 600, delay: 80, easing: cubicOut }}
					>
						A real TeX engine, not an approximation of one.
						<span
							class="text-foreground/65 mt-3 block font-serif text-xl font-medium italic sm:text-2xl md:text-3xl"
							style="line-height: 1.15;"
						>
							Compiled to WebAssembly, running entirely on your machine.
						</span>
					</h1>

					<p
						class="landing-text-pretty text-foreground/85 mt-6 max-w-2xl text-base leading-relaxed font-medium sm:text-lg"
						in:fly={{ y: 12, duration: 600, delay: 160, easing: cubicOut }}
					>
						GlyphTeX runs Tectonic's XeTeX, xdvipdfmx and BibTeX in the browser. Not a subset, not a
						renderer that handles the common cases — the same engine lineage a journal expects, with
						the TeX distribution bundled alongside it.
					</p>

					<div
						class="mt-9 flex flex-col gap-3 sm:flex-row"
						in:fly={{ y: 12, duration: 600, delay: 240, easing: cubicOut }}
					>
						<Button
							size="lg"
							href={resolve('/workspace')}
							onclick={() => track('engine_cta_workspace')}
						>
							Open the workspace
							<IconArrowRight class="size-4" />
						</Button>
						<Button size="lg" variant="outline" href={REPO_URL} target="_blank" rel="noreferrer">
							<IconBrandGithub class="size-4" />
							Read the source
						</Button>
					</div>
				</div>

				<!-- Measured, not rounded for effect. -->
				<div
					class="border-hairline mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border md:grid-cols-4"
					in:fly={{ y: 16, duration: 700, delay: 320, easing: cubicOut }}
				>
					{#each stats as stat (stat.label)}
						<div class="bg-surface-card/80 flex flex-col gap-1 p-5 backdrop-blur-sm">
							<span class="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
								{stat.value}
							</span>
							<span class="text-foreground/80 text-xs font-medium">{stat.label}</span>
							<span class="text-muted-foreground text-xs">{stat.note}</span>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<Section bordered>
			<Container>
				<Reveal variant="up">
					<SectionHeader
						eyebrow="Why this is hard"
						title="Browser LaTeX usually breaks in the same three places."
						description="Each one is a property of TeX itself, not a missing feature. Knowing which they are is most of the work."
						align="center"
					/>
				</Reveal>

				<div class="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
					{#each hardParts as part, i (part.title)}
						<Reveal variant="up" delay={80 + i * 80}>
							<article
								class="border-hairline bg-surface-card hover:bg-surface-soft flex h-full flex-col gap-4 rounded-3xl border p-8 transition-colors motion-reduce:transition-none"
							>
								<div
									class="border-hairline bg-surface-soft text-foreground/70 flex size-10 items-center justify-center rounded-xl border"
								>
									<part.icon class="size-5" />
								</div>
								<h3 class="text-foreground text-lg font-semibold tracking-tight">{part.title}</h3>
								<p class="text-muted-foreground text-sm leading-relaxed">{part.body}</p>
							</article>
						</Reveal>
					{/each}
				</div>
			</Container>
		</Section>

		<Section bordered>
			<Container>
				<Reveal variant="up">
					<SectionHeader
						eyebrow="What we did differently"
						title="The engine is the easy half. The distribution around it is the work."
						description="Plenty of projects have built a TeX engine to WebAssembly. The part that decides whether your document compiles is everything shipped with it."
						align="center"
					/>
				</Reveal>

				<div class="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
					{#each different as item, i (item.title)}
						<Reveal variant="up" delay={60 + i * 60}>
							<article
								class="border-hairline bg-surface-card hover:bg-surface-soft flex h-full flex-col gap-4 rounded-3xl border p-8 transition-colors motion-reduce:transition-none"
							>
								<div class="flex items-center gap-3">
									<div
										class="border-hairline bg-surface-soft text-brand flex size-10 items-center justify-center rounded-xl border"
									>
										<item.icon class="size-5" />
									</div>
									<h3 class="text-foreground text-lg font-semibold tracking-tight">{item.title}</h3>
								</div>
								<p class="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
							</article>
						</Reveal>
					{/each}
				</div>
			</Container>
		</Section>

		<Section bordered>
			<Container>
				<Reveal variant="up">
					<SectionHeader
						eyebrow="Inside a compile"
						title="What happens when you press Compile."
						description="The same sequence a local latexmk run performs — in memory, on your machine, with nothing leaving it."
						align="center"
					/>
				</Reveal>

				<ol class="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
					{#each pipeline as item, i (item.step)}
						<Reveal variant="up" delay={60 + i * 70}>
							<li
								class="border-hairline bg-surface-card hover:bg-surface-soft flex h-full flex-col gap-3 rounded-3xl border p-6 transition-colors motion-reduce:transition-none"
							>
								<span
									class="text-brand font-mono text-xs font-semibold tracking-[0.18em] tabular-nums"
								>
									{item.step}
								</span>
								<h3 class="text-foreground text-base font-semibold tracking-tight">{item.title}</h3>
								<p class="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
							</li>
						</Reveal>
					{/each}
				</ol>

				<Reveal variant="up" delay={420}>
					<p class="text-muted-foreground mt-8 text-center text-sm">
						Passes repeat only while something is still changing, so a settled document recompiles
						in two passes rather than a fixed three.
					</p>
				</Reveal>
			</Container>
		</Section>

		<Section bordered>
			<Container size="narrow">
				<Reveal variant="up">
					<SectionHeader
						eyebrow="Where the line is"
						title="What works, and what cannot."
						description="Two things genuinely do not work in a browser. Naming them is cheaper than letting you discover them at midnight."
						align="center"
					/>
				</Reveal>

				<div class="mt-12 flex flex-col gap-3">
					{#each limits as limit, i (limit.title)}
						<Reveal variant="up" delay={80 + i * 80}>
							<div
								class="border-hairline bg-surface-card flex items-start gap-4 rounded-2xl border p-6"
							>
								<div
									class={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
										limit.works ? 'bg-brand/10 text-brand' : 'bg-muted text-muted-foreground'
									}`}
								>
									{#if limit.works}
										<IconCheck class="size-4" />
									{:else}
										<IconX class="size-4" />
									{/if}
								</div>
								<div class="flex flex-col gap-1.5">
									<h3 class="text-foreground text-base font-semibold tracking-tight">
										{limit.title}
									</h3>
									<p class="text-muted-foreground text-sm leading-relaxed">{limit.body}</p>
								</div>
							</div>
						</Reveal>
					{/each}
				</div>
			</Container>
		</Section>

		<Section>
			<Container size="narrow">
				<div class="flex flex-col items-center text-center">
					<Reveal variant="up">
						<div
							class="border-hairline bg-surface-soft text-foreground/70 mb-8 flex size-12 items-center justify-center rounded-2xl border"
						>
							<IconCpu class="size-6" />
						</div>
					</Reveal>
					<Reveal variant="up" delay={80}>
						<h2
							class="landing-text-balance text-foreground text-3xl leading-[1.05] font-semibold tracking-tight sm:text-4xl"
						>
							Open a document and watch it compile.
						</h2>
					</Reveal>
					<Reveal variant="up" delay={140}>
						<p
							class="landing-text-pretty text-muted-foreground mt-5 max-w-xl text-base leading-relaxed sm:text-lg"
						>
							No account, no queue, no upload. The compiler downloads once and then belongs to your
							browser.
						</p>
					</Reveal>
					<Reveal variant="up" delay={200}>
						<div class="mt-9 flex flex-col gap-3 sm:flex-row">
							<Button
								size="lg"
								href={resolve('/workspace')}
								onclick={() => track('engine_cta_workspace_footer')}
							>
								Open the workspace
								<IconArrowRight class="size-4" />
							</Button>
							<Button size="lg" variant="outline" href={resolve('/')}>
								<IconFileText class="size-4" />
								Back to the overview
							</Button>
						</div>
					</Reveal>
				</div>
			</Container>
		</Section>
	</main>

	<SiteFooter />
</div>
