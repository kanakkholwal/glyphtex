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
		IconBrandGithub,
		IconBrandNpm,
		IconCheck,
		IconCpu,
		IconFileText,
		IconX
	} from '@tabler/icons-svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	const heroBackdrop = '/background-section.webp';

	// Measured against the artifacts this site ships, not estimated. Re-measure
	// with `pnpm engine:refresh` and scripts/check-size-budget.sh before editing.
	const stats = [
		{ value: '1.07 MB', label: 'Engine, brotli' },
		{ value: '~600 ms', label: 'Typical recompile' },
		{ value: '1,534', label: 'TeX files bundled' },
		{ value: '0', label: 'Network calls to compile' }
	];

	// Each entry is a real bug from the build log, kept short on purpose. The
	// symptom is what we saw; the cause is what it actually was.
	const buildLog = [
		{
			symptom: 'booktabs hung forever on an eight line document',
			cause:
				'The font fallback guessed by matching size digits and handed XeTeX a Type1 outline where it asked for metrics.',
			fix: 'Deleted the fallback. A missing file now reports itself.'
		},
		{
			symptom: '{\\Large ...} produced a valid 15 byte PDF with no page',
			cause:
				'Same fallback, different failure mode. The exit code was still zero, so nothing looked wrong.',
			fix: 'Compile status is now derived from the output, not the return value.'
		},
		{
			symptom: 'siunitx was in the bundle and still did not work',
			cause:
				'Shipping a .sty file says nothing about its dependency closure. We were listing files and calling it coverage.',
			fix: 'The bundle build compiles a real document per package group and loops on what it reports missing.'
		},
		{
			symptom: 'ec-lmss8.tfm not loadable, then rm-lmss8.tfm, then lmsans9-regular.otf',
			cause:
				'Latin Modern ships under nine encoding prefixes. Every glob we wrote caught some of them.',
			fix: 'Took the whole family. Costs a few megabytes, ends the class of bug.'
		},
		{
			symptom: '\\partokencontext was undefined under microtype',
			cause:
				'A primitive the engine did not have but the format expected, from a version skew between the two.',
			fix: 'A \\newcount shim injected when we dump the format.'
		},
		{
			symptom: 'Opening a second project showed the first one errors',
			cause:
				'The worker reused one engine across documents and served the previous PDF when a compile failed.',
			fix: 'Mount state is keyed by document. Switching unmounts the old file set before the new one lands.'
		}
	];

	const pipeline = [
		{
			step: '01',
			title: 'Mount',
			body: 'Your project and the TeX distribution land in one in-memory filesystem.'
		},
		{
			step: '02',
			title: 'Typeset',
			body: 'XeTeX runs and writes page data plus the .aux and .toc intermediates.'
		},
		{
			step: '03',
			title: 'Bibliography',
			body: 'If the .aux contains \\bibdata, BibTeX reads it and your .bib and writes the .bbl.'
		},
		{
			step: '04',
			title: 'Converge',
			body: 'Passes repeat while the intermediates keep changing, so references settle.'
		},
		{
			step: '05',
			title: 'Render',
			body: 'xdvipdfmx turns page data into a PDF with fonts subset and embedded.'
		}
	];

	// The point of this table is placement, not ranking. Every project here is
	// open source and solves the problem it set out to solve.
	const landscape = [
		{
			name: 'LaTeX.js',
			engine: 'JavaScript reimplementation',
			files: 'Built in macros',
			offline: true,
			note: 'Renders to HTML. Fast and small, and not aiming at PDF fidelity.'
		},
		{
			name: 'texlive.js',
			engine: 'pdfTeX via Emscripten',
			files: 'Bundled data package',
			offline: true,
			note: 'The original proof that TeX compiles to the web at all.'
		},
		{
			name: 'SwiftLaTeX',
			engine: 'pdfTeX and XeTeX via Emscripten',
			files: 'Fetched per compile',
			offline: false,
			note: 'Package lookups hit a server mid-compile, so a connection is required.'
		},
		{
			name: 'busytex',
			engine: 'Full TeX Live toolchain',
			files: 'Large data packages',
			offline: true,
			note: 'The most complete toolchain, at a size that suits a workbench more than a page load.'
		},
		{
			name: 'GlyphTeX',
			engine: 'Tectonic XeTeX, xdvipdfmx, BibTeX',
			files: 'Prebundled, packs on demand',
			offline: true,
			note: 'Optimised for first load and for being wrong out loud when a file is missing.',
			ours: true
		}
	];

	const limits = [
		{
			works: false,
			title: 'Biber',
			body: 'A Perl program with no WebAssembly build. biblatex works with backend=bibtex, and the workspace tells you that one line change instead of quietly dropping your bibliography.'
		},
		{
			works: false,
			title: 'Shell-escape',
			body: 'Packages that run external programs mid-compile cannot work. WebAssembly has no way to start a subprocess.'
		},
		{
			works: true,
			title: 'Everything a normal paper needs',
			body: 'Math, figures, TikZ and pgfplots, tables, beamer, hyperref, microtype, cross-references, and BibTeX bibliographies.'
		}
	];
</script>

<svelte:head>
	<title>The GlyphTeX engine: how we got LaTeX compiling in a browser</title>
	<meta
		name="description"
		content="How GlyphTeX compiles LaTeX offline in the browser: why we picked Tectonic, the bugs we hit building it to WebAssembly, and how a compile actually runs."
	/>
</svelte:head>

<div class="bg-canvas text-ink selection:bg-brand-subtle min-h-screen font-sans antialiased">
	<div
		aria-hidden="true"
		class="landing-bg-grid landing-bg-grid-fade pointer-events-none fixed inset-0 -z-10 opacity-30"
	></div>

	<SiteHeader />

	<main>
		<section class="relative w-full overflow-hidden">
			<HeroBackdrop src={heroBackdrop} tone="default" wash="left" />

			<div
				class="relative z-10 mx-auto flex max-w-7xl flex-col justify-center px-6 pt-36 pb-20 lg:px-10"
			>
				<span
					class="text-foreground/70 mb-8 inline-flex w-fit items-center gap-2 self-start text-[11px] font-semibold tracking-[0.18em] uppercase"
					in:fly={{ y: 8, duration: 500, easing: cubicOut }}
				>
					<span class="bg-brand size-1.5 rounded-full"></span>
					The engine
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
							Here is what it took to get one into a browser tab.
						</span>
					</h1>

					<p
						class="landing-text-pretty text-foreground/85 mt-6 max-w-2xl text-base leading-relaxed font-medium sm:text-lg"
						in:fly={{ y: 12, duration: 600, delay: 160, easing: cubicOut }}
					>
						GlyphTeX runs Tectonic's XeTeX, xdvipdfmx and BibTeX compiled to WebAssembly, with a TeX
						distribution bundled alongside. The engine is published on npm and the whole thing is
						GPLv3, so you can pull it into your own project without going through us.
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

					<div
						class="border-hairline bg-surface-card/80 mt-6 flex w-fit items-center gap-3 rounded-xl border px-4 py-2.5 font-mono text-sm backdrop-blur-sm"
						in:fly={{ y: 12, duration: 600, delay: 300, easing: cubicOut }}
					>
						<IconBrandNpm class="text-muted-foreground size-4 shrink-0" />
						<code class="text-foreground/90">npm i glyphtex-engine</code>
					</div>
				</div>

				<div
					class="border-hairline mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border md:grid-cols-4"
					in:fly={{ y: 16, duration: 700, delay: 360, easing: cubicOut }}
				>
					{#each stats as stat (stat.label)}
						<div class="bg-surface-card/80 flex flex-col gap-1 p-5 backdrop-blur-sm">
							<span class="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
								{stat.value}
							</span>
							<span class="text-muted-foreground text-xs font-medium">{stat.label}</span>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<Section bordered>
			<Container size="narrow">
				<Reveal variant="up">
					<SectionHeader eyebrow="Where this started" title="We wanted the compiler to be ours." />
				</Reveal>

				<div
					class="text-muted-foreground mt-10 flex flex-col gap-5 text-base leading-relaxed sm:text-lg"
				>
					<Reveal variant="up" delay={60}>
						<p>
							Every browser LaTeX editor we looked at sent your document to a server to compile it.
							That is a reasonable engineering choice and a bad deal for the writer. Your thesis
							leaves your machine, you wait in a queue behind other people's builds, and the day the
							service goes down your deadline goes with it.
						</p>
					</Reveal>
					<Reveal variant="up" delay={120}>
						<p>
							So the question was whether a real TeX engine could run locally, in a tab, with no
							network. Not a subset that handles common documents, and not a renderer that
							approximates the output. The actual engine, producing the PDF a journal expects.
						</p>
					</Reveal>
					<Reveal variant="up" delay={180}>
						<p>
							The research said no. Two rounds of it concluded that no Rust LaTeX engine compiles to
							WebAssembly and we would be cross-compiling a large C codebase by hand. Then we read
							Tectonic's source properly, and the picture changed.
						</p>
					</Reveal>
				</div>
			</Container>
		</Section>

		<Section bordered>
			<Container size="narrow">
				<Reveal variant="up">
					<SectionHeader
						eyebrow="Why Tectonic"
						title="It had already solved the hard part, for unrelated reasons."
					/>
				</Reveal>

				<div
					class="text-muted-foreground mt-10 flex flex-col gap-5 text-base leading-relaxed sm:text-lg"
				>
					<Reveal variant="up" delay={60}>
						<p>
							Tectonic had spent years removing every piece of TeX that touches an operating system.
							We grepped the vendored C tree to check. Zero live calls to open a file. Zero
							kpathsea, the path search library every other TeX distribution is built around. No
							subprocesses, no threads, no signal handlers. Instead there were 458 calls routing all
							input and output back into Rust through one trait.
						</p>
					</Reveal>
					<Reveal variant="up" delay={120}>
						<p>
							That trait is the whole story. Everything a browser makes difficult about TeX, file
							lookup, was already behind a single interface we could implement ourselves. Tectonic
							did it to make builds reproducible, not to target the web, and it turned out to be the
							most web-ready TeX engine in existence. Nobody had noticed because the WebAssembly
							issue on their tracker had been sitting open since 2018.
						</p>
					</Reveal>
					<Reveal variant="up" delay={180}>
						<p>
							We were not first, either. A repository with zero stars had a working Tectonic
							WebAssembly build sitting in it. We validated it, measured it, and found the engine
							genuinely worked and the 414 line wrapper around it did not. That was a good trade.
						</p>
					</Reveal>
				</div>
			</Container>
		</Section>

		<Section bordered>
			<Container>
				<Reveal variant="up">
					<SectionHeader
						eyebrow="What went wrong"
						title="The engine was the easy half."
						description="A selection from the build log. Most of these took longer to diagnose than to fix, and every one of them taught us something about how TeX fails."
						align="center"
					/>
				</Reveal>

				<div class="mt-14 flex flex-col gap-3">
					{#each buildLog as entry, i (entry.symptom)}
						<Reveal variant="up" delay={40 + i * 50}>
							<div
								class="border-hairline bg-surface-card hover:bg-surface-soft grid grid-cols-1 gap-x-8 gap-y-4 rounded-2xl border p-6 transition-colors sm:p-7 md:grid-cols-3 motion-reduce:transition-none"
							>
								<div class="flex flex-col gap-2">
									<span
										class="text-muted-foreground/70 text-[10px] font-semibold tracking-[0.16em] uppercase"
									>
										Symptom
									</span>
									<p class="text-foreground font-mono text-sm leading-relaxed">{entry.symptom}</p>
								</div>
								<div class="flex flex-col gap-2">
									<span
										class="text-muted-foreground/70 text-[10px] font-semibold tracking-[0.16em] uppercase"
									>
										Cause
									</span>
									<p class="text-muted-foreground text-sm leading-relaxed">{entry.cause}</p>
								</div>
								<div class="flex flex-col gap-2">
									<span class="text-brand/80 text-[10px] font-semibold tracking-[0.16em] uppercase">
										Fix
									</span>
									<p class="text-muted-foreground text-sm leading-relaxed">{entry.fix}</p>
								</div>
							</div>
						</Reveal>
					{/each}
				</div>

				<Reveal variant="up" delay={380}>
					<p
						class="text-muted-foreground mx-auto mt-10 max-w-2xl text-center text-base leading-relaxed"
					>
						The pattern underneath all of them is that TeX has no graceful degradation. A missing
						font is not a smaller font. It is a hang, or a blank page, or an exit code of zero with
						nothing in the PDF. So the bundle is now built by compiling real documents and feeding
						back whatever they report missing, and the build fails if any of them cannot produce a
						PDF.
					</p>
				</Reveal>
			</Container>
		</Section>

		<Section bordered>
			<Container>
				<Reveal variant="up">
					<SectionHeader
						eyebrow="Under the hood"
						title="What happens when you press Compile."
						description="The same sequence a local latexmk run performs, in memory, with nothing leaving your machine."
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
						Everything is resolved before step 01, because a TeX file lookup is synchronous and
						there is nothing to await inside one. That single constraint is why the bundle is
						prebuilt rather than fetched.
					</p>
				</Reveal>
			</Container>
		</Section>

		<Section bordered>
			<Container>
				<Reveal variant="up">
					<SectionHeader
						eyebrow="The landscape"
						title="Where this sits among the projects that got here first."
						description="Browser LaTeX has been worked on for over a decade and every project below is open source. They made different trade-offs because they were solving different problems. This is placement, not a scoreboard."
						align="center"
					/>
				</Reveal>

				<Reveal variant="up" delay={100}>
					<div class="border-hairline mt-14 overflow-x-auto rounded-2xl border">
						<table class="w-full min-w-184 border-collapse text-left text-sm">
							<thead>
								<tr class="border-hairline bg-surface-soft border-b">
									<th class="text-foreground px-5 py-4 font-semibold">Project</th>
									<th class="text-foreground px-5 py-4 font-semibold">Engine</th>
									<th class="text-foreground px-5 py-4 font-semibold">Where files come from</th>
									<th class="text-foreground px-5 py-4 text-center font-semibold">Offline</th>
									<th class="text-foreground px-5 py-4 font-semibold">Trade-off it made</th>
								</tr>
							</thead>
							<tbody>
								{#each landscape as row (row.name)}
									<tr
										class={[
											'border-hairline border-b last:border-b-0',
											row.ours ? 'bg-brand/4' : 'bg-surface-card'
										]}
									>
										<td class="text-foreground px-5 py-4 font-semibold whitespace-nowrap">
											{row.name}
										</td>
										<td class="text-muted-foreground px-5 py-4">{row.engine}</td>
										<td class="text-muted-foreground px-5 py-4">{row.files}</td>
										<td class="px-5 py-4">
											<span class="flex justify-center">
												{#if row.offline}
													<IconCheck class="text-brand size-4" />
												{:else}
													<IconX class="text-muted-foreground/60 size-4" />
												{/if}
											</span>
										</td>
										<td class="text-muted-foreground px-5 py-4">{row.note}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</Reveal>

				<Reveal variant="up" delay={180}>
					<p
						class="text-muted-foreground mx-auto mt-10 max-w-2xl text-center text-base leading-relaxed"
					>
						We built on Tectonic, which builds on XeTeX, which builds on TeX. The bundle tooling,
						the pack format and the wrapper are published under GPLv3 so the next person trying this
						does not have to rediscover the six bugs above. If the WebAssembly work is useful
						upstream, we would rather it went there than stayed here.
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
						description="Two things genuinely do not work in a browser. Naming them is cheaper than letting you find out at midnight."
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
