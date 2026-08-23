<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import { Container, Section } from "$lib/landing";
	import { REPO_URL } from "$lib/landing/nav-data";
	import Seo from "$lib/seo/Seo.svelte";
	import SiteFooter from "$lib/SiteFooter.svelte";
	import SiteHeader from "$lib/SiteHeader.svelte";
	import { Button } from "@glyphtex/ui/button";
	import { Reveal } from "@glyphtex/ui/reveal";
	import { SectionHeader } from "@glyphtex/ui/section-header";
	import { IconBrandGithub, IconBrandNpm, IconCheck, IconX } from "@tabler/icons-svelte";
	import { cubicOut } from "svelte/easing";
	import { fly } from "svelte/transition";

	// Measured against the artifacts this site ships, not estimated. Re-measure
	// with `pnpm engine:refresh` and scripts/check-size-budget.sh before editing.
	const stats = [
		{ value: "1.07 MB", label: "Engine, brotli" },
		{ value: "~600 ms", label: "Typical recompile" },
		{ value: "1,534", label: "TeX files bundled" },
		{ value: "0", label: "Network calls to compile" }
	];

	// Each entry is a real bug from the build log, kept short on purpose. The
	// symptom is what we saw; the cause is what it actually was.
	const buildLog = [
		{
			symptom: "booktabs hung forever on an eight line document",
			cause:
				"The font fallback guessed by matching size digits and handed XeTeX a Type1 outline where it asked for metrics.",
			fix: "Deleted the fallback. A missing file now reports itself."
		},
		{
			symptom: "{\\Large ...} produced a valid 15 byte PDF with no page",
			cause:
				"Same fallback, different failure mode. The exit code was still zero, so nothing looked wrong.",
			fix: "Compile status is now derived from the output, not the return value."
		},
		{
			symptom: "siunitx was in the bundle and still did not work",
			cause:
				"Shipping a .sty file says nothing about its dependency closure. We were listing files and calling it coverage.",
			fix: "The bundle build compiles a real document per package group and loops on what it reports missing."
		},
		{
			symptom: "ec-lmss8.tfm not loadable, then rm-lmss8.tfm, then lmsans9-regular.otf",
			cause:
				"Latin Modern ships under nine encoding prefixes. Every glob we wrote caught some of them.",
			fix: "Took the whole family. Costs a few megabytes, ends the class of bug."
		},
		{
			symptom: "\\partokencontext was undefined under microtype",
			cause:
				"A primitive the engine did not have but the format expected, from a version skew between the two.",
			fix: "A \\newcount shim injected when we dump the format."
		},
		{
			symptom: "Opening a second project showed the first one errors",
			cause:
				"The worker reused one engine across documents and served the previous PDF when a compile failed.",
			fix: "Mount state is keyed by document. Switching unmounts the old file set before the new one lands."
		}
	];

	const pipeline = [
		{
			step: "01",
			title: "Mount",
			body: "Your project and the TeX distribution land in one in-memory filesystem."
		},
		{
			step: "02",
			title: "Typeset",
			body: "XeTeX runs and writes page data plus the .aux and .toc intermediates."
		},
		{
			step: "03",
			title: "Bibliography",
			body: "If the .aux contains \\bibdata, BibTeX reads it and your .bib and writes the .bbl."
		},
		{
			step: "04",
			title: "Converge",
			body: "Passes repeat while the intermediates keep changing, so references settle."
		},
		{
			step: "05",
			title: "Render",
			body: "xdvipdfmx turns page data into a PDF with fonts subset and embedded."
		}
	];

	// The point of this table is placement, not ranking. Every project here is
	// open source and solves the problem it set out to solve.
	const landscape = [
		{
			name: "LaTeX.js",
			engine: "JavaScript reimplementation",
			files: "Built in macros",
			offline: true,
			note: "Renders to HTML. Fast and small, and not aiming at PDF fidelity."
		},
		{
			name: "texlive.js",
			engine: "pdfTeX via Emscripten",
			files: "Bundled data package",
			offline: true,
			note: "The original proof that TeX compiles to the web at all."
		},
		{
			name: "SwiftLaTeX",
			engine: "pdfTeX and XeTeX via Emscripten",
			files: "Fetched per compile",
			offline: false,
			note: "Package lookups hit a server mid-compile, so a connection is required."
		},
		{
			name: "busytex",
			engine: "Full TeX Live toolchain",
			files: "Large data packages",
			offline: true,
			note: "The most complete toolchain, at a size that suits a workbench more than a page load."
		},
		{
			name: "GlyphTeX",
			engine: "Tectonic XeTeX, xdvipdfmx, BibTeX",
			files: "Prebundled, packs on demand",
			offline: true,
			note: "Optimised for first load and for being wrong out loud when a file is missing.",
			ours: true
		}
	];

	const limits = [
		{
			works: false,
			title: "Biber",
			body: "A Perl program with no WebAssembly build. biblatex works with backend=bibtex, and the workspace tells you that one line change instead of quietly dropping your bibliography."
		},
		{
			works: false,
			title: "Shell-escape",
			body: "Packages that run external programs mid-compile cannot work. WebAssembly has no way to start a subprocess."
		},
		{
			works: true,
			title: "Everything a normal paper needs",
			body: "Math, figures, TikZ and pgfplots, tables, beamer, hyperref, microtype, cross-references, and BibTeX bibliographies."
		}
	];
</script>

<Seo
	title="The GlyphTeX engine: how we got LaTeX compiling in a browser"
	description="How GlyphTeX compiles LaTeX offline in the browser: why we picked Tectonic, the bugs we hit building it to WebAssembly, and how a compile actually runs."
	canonical="/engine"
/>

<div class="bg-background text-ink selection:bg-brand-subtle min-h-screen font-sans antialiased">
	<SiteHeader />

	<main id="main">
		<section class="relative w-full">
			<Container size="wide">
				<div class="mx-auto flex max-w-4xl flex-col items-center pt-36 pb-16 text-center md:pt-44">
					<span class="landing-eyebrow mb-4" in:fly={{ y: 8, duration: 400, easing: cubicOut }}>
						The engine
					</span>

					<h1
						class="landing-display"
						in:fly={{ y: 10, duration: 450, delay: 60, easing: cubicOut }}
					>
						A real TeX engine.
						<span class="landing-title-em">In a browser tab.</span>
					</h1>

					<p
						class="landing-lead mt-7 max-w-2xl"
						in:fly={{ y: 10, duration: 450, delay: 120, easing: cubicOut }}
					>
						Tectonic's XeTeX, xdvipdfmx and BibTeX compiled to WebAssembly, with a TeX distribution
						bundled alongside. Published on npm, GPLv3.
					</p>

					<div
						class="mt-9 flex flex-col items-center gap-3 sm:flex-row"
						in:fly={{ y: 10, duration: 450, delay: 180, easing: cubicOut }}
					>
						<Button
							size="lg"
							variant="default"
							href={resolve('/workspace')}
							onclick={() => track('cta_clicked', { target: 'workspace', location: 'engine_hero' })}
						>
							Open the workspace
						</Button>
						<Button
							size="lg"
							variant="outline"
							href={REPO_URL}
							target="_blank"
							rel="noreferrer"
							onclick={() =>
								track('outbound_clicked', { destination: 'github', location: 'engine_hero' })}
						>
							<IconBrandGithub class="size-4" />
							Read the source
						</Button>
					</div>

					<div
						class="bg-surface-soft mt-8 flex w-fit items-center gap-3 rounded-lg px-4 py-2.5 font-mono text-base"
						in:fly={{ y: 10, duration: 450, delay: 240, easing: cubicOut }}
					>
						<IconBrandNpm class="text-muted-foreground size-4 shrink-0" />
						<code class="text-foreground">npm i glyphtex-engine</code>
					</div>
				</div>

				<div
					class="landing-surface grid grid-cols-2 gap-8 p-8 md:grid-cols-4 md:p-10"
					in:fly={{ y: 16, duration: 500, delay: 300, easing: cubicOut }}
				>
					{#each stats as stat (stat.label)}
						<div class="flex flex-col gap-1">
							<span class="text-foreground text-3xl font-semibold tracking-tight">
								{stat.value}
							</span>
							<span class="text-muted-foreground text-sm leading-snug">{stat.label}</span>
						</div>
					{/each}
				</div>
			</Container>
		</section>

		<Section>
			<Container size="narrow">
				<Reveal variant="up">
					<SectionHeader eyebrow="Where this started" title="We wanted the compiler to be ours." />
				</Reveal>

				<div
					class="text-muted-foreground mt-10 flex flex-col gap-5 text-base leading-relaxed sm:text-lg"
				>
					<Reveal variant="up" delay={60}>
						<p>
							Every browser LaTeX editor we looked at compiles on a server. Your thesis leaves your
							machine, you queue behind other people's builds, and the day the service goes down
							your deadline goes with it.
						</p>
					</Reveal>
					<Reveal variant="up" delay={120}>
						<p>
							So: could a real TeX engine run in a tab, with no network?: Not a subset, not an
							approximation. The actual engine, producing the PDF a journal expects.
						</p>
					</Reveal>
					<Reveal variant="up" delay={180}>
						<p>
							The research said no: we would be cross-compiling a large C codebase by hand. Then we
							read Tectonic's source properly.
						</p>
					</Reveal>
				</div>
			</Container>
		</Section>

		<Section>
			<Container size="narrow">
				<Reveal variant="up">
					<SectionHeader eyebrow="Why Tectonic" title="Tectonic had already solved it." />
				</Reveal>

				<div
					class="text-muted-foreground mt-10 flex flex-col gap-5 text-base leading-relaxed sm:text-lg"
				>
					<Reveal variant="up" delay={60}>
						<p>
							Tectonic had spent years removing every piece of TeX that touches an operating system.
							Zero calls to open a file. Zero kpathsea. No subprocesses, no threads. Instead, 458
							calls routing all input and output back into Rust through one trait.
						</p>
					</Reveal>
					<Reveal variant="up" delay={120}>
						<p>
							That trait is the whole story. File lookup, the one thing a browser makes hard, was
							already behind a single interface. Tectonic did it for reproducible builds, not for
							the web, and accidentally built the most web-ready TeX engine there is.
						</p>
					</Reveal>
					<Reveal variant="up" delay={180}>
						<p>
							We were not first. A repository with zero stars had a working WebAssembly build in it.
							The engine worked; the 414-line wrapper around it did not. Good trade.
						</p>
					</Reveal>
				</div>
			</Container>
		</Section>

		<Section>
			<Container>
				<Reveal variant="up">
					<SectionHeader
						eyebrow="What went wrong"
						title="The engine was the easy half."
						description="Most took longer to diagnose than to fix."
						align="center"
					/>
				</Reveal>

				<div class="mt-14 flex flex-col gap-3">
					{#each buildLog as entry, i (entry.symptom)}
						<Reveal variant="up" delay={40 + i * 50}>
							<div
								class="landing-card-outline landing-card-hover grid grid-cols-1 gap-x-8 gap-y-4 rounded-xl p-6 transition-colors sm:p-7 md:grid-cols-3 motion-reduce:transition-none"
							>
								<div class="flex flex-col gap-2">
									<span class="text-muted-foreground text-sm"> Symptom </span>
									<p class="text-foreground font-mono text-sm leading-relaxed">{entry.symptom}</p>
								</div>
								<div class="flex flex-col gap-2">
									<span class="text-muted-foreground text-sm"> Cause </span>
									<p class="text-muted-foreground text-sm leading-relaxed">{entry.cause}</p>
								</div>
								<div class="flex flex-col gap-2">
									<span class="text-foreground text-sm font-medium"> Fix </span>
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
						TeX has no graceful degradation. A missing font is not a smaller font: it is a hang, a
						blank page, or exit code zero with nothing in the PDF. So the bundle is built by
						compiling real documents and feeding back whatever they report missing.
					</p>
				</Reveal>
			</Container>
		</Section>

		<Section>
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
								class="landing-card-outline landing-card-hover flex h-full flex-col gap-3 rounded-xl p-6 transition-colors motion-reduce:transition-none"
							>
								<span
									class="text-muted-foreground font-mono text-xs font-semibold tracking-[0.18em] tabular-nums"
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
						A TeX file lookup is synchronous, so everything resolves before step 01. That one
						constraint is why the bundle is prebuilt rather than fetched.
					</p>
				</Reveal>
			</Container>
		</Section>

		<Section>
			<Container>
				<Reveal variant="up">
					<SectionHeader
						eyebrow="The landscape"
						title="The projects that got here first."
						description="Every project below is open source. Placement, not a scoreboard."
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
						We built on Tectonic, which builds on XeTeX, which builds on TeX. The tooling is GPLv3
						so the next person does not have to rediscover the six bugs above.
					</p>
				</Reveal>
			</Container>
		</Section>

		<Section>
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
							<div class="landing-card-outline flex items-start gap-4 rounded-xl p-6">
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

		<section class="bg-surface-soft">
			<Container size="wide">
				<div class="flex flex-col items-center py-28 text-center md:py-36">
					<Reveal variant="up">
						<h2 class="landing-section-title">Open a document and watch it compile.</h2>
					</Reveal>
					<Reveal variant="up" delay={70}>
						<p class="landing-lead mt-6 max-w-xl">
							No account, no queue, no upload. The compiler downloads once and then belongs to your
							browser.
						</p>
					</Reveal>
					<Reveal variant="up" delay={140} class="mt-9 flex flex-wrap justify-center gap-3">
						<Button
							size="lg"
							variant="default"
							href={resolve('/workspace')}
							onclick={() => track('cta_clicked', { target: 'workspace', location: 'engine_footer' })}
						>
							Open the workspace
						</Button>
						<Button size="lg" variant="outline" href={resolve('/')}>Back to the overview</Button>
					</Reveal>
				</div>
			</Container>
		</section>
	</main>

	<SiteFooter />
</div>
