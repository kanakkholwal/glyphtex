<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import { REPO_URL } from "$lib/landing/nav-data";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow, Section, Well } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { IconBrandGithub, IconBrandNpm, IconCheck, IconCpu, IconX } from "@tabler/icons-svelte";

	// Measured Sept 2026 from crates/tectonic-wasm/output (brotli -q 11, tar listing, packs dir).
	// Re-measure after `pnpm engine:refresh` before editing; no timing is shown because none is benchmarked.
	const stats = [
		{ value: "1.07 MB", label: "Engine, brotli" },
		{ value: "1,467", label: "TeX files in the base bundle" },
		{ value: "12", label: "Add-on package packs" },
		{ value: "0", label: "Servers that see your source" }
	];

	// Real bugs from the build log: the symptom we saw, then what it actually was.
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
			fix: "Took the whole family as its own pack. Costs several megabytes, ends the class of bug."
		},
		{
			symptom: "\\partokencontext was undefined under microtype",
			cause:
				"A primitive the engine did not have but the format expected, from a version skew between the two.",
			fix: "A \\newcount shim injected when we dump the format."
		},
		{
			symptom: "Opening a second project showed the first one's errors",
			cause:
				"The worker reused one engine across documents and served the previous PDF when a compile failed.",
			fix: "Mount state is keyed by document. Switching unmounts the old file set before the new one lands."
		}
	];

	const pipeline = [
		{
			title: "Mount",
			body: "Your project and the TeX distribution land in one in-memory filesystem."
		},
		{
			title: "Typeset",
			body: "XeTeX runs and writes page data plus the .aux and .toc intermediates."
		},
		{
			title: "Bibliography",
			body: "If the .aux contains \\bibdata, BibTeX reads it and your .bib and writes the .bbl."
		},
		{
			title: "Converge",
			body: "Passes repeat while the intermediates keep changing, so references settle."
		},
		{
			title: "Render",
			body: "xdvipdfmx turns page data into a PDF with fonts subset and embedded."
		}
	];

	// Placement, not ranking: every project here is open source and solves the problem it set out to.
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
			title: "What a typical paper needs",
			body: "Math, figures, TikZ and pgfplots, tables, beamer, hyperref, microtype, cross-references, and BibTeX bibliographies."
		}
	];

	const prose = "flex max-w-2xl flex-col gap-4 text-base text-pretty text-muted-foreground";
	const note = "mt-6 max-w-2xl text-sm text-pretty text-muted-foreground";
</script>

<Seo
	title="The GlyphTeX engine: how we got LaTeX compiling in a browser"
	description="How GlyphTeX compiles LaTeX offline in the browser: why we picked Tectonic, the bugs we hit building it to WebAssembly, and how a compile actually runs."
	canonical="/engine"
/>

<RailFrame>
	<RailRow divider={false} label="The engine">
		<PageHero
			badge="The engine"
			title="A real TeX engine"
			accent="in a browser tab"
			lede="Tectonic's XeTeX, xdvipdfmx and BibTeX compiled to WebAssembly, with a TeX distribution bundled alongside. Published on npm, GPLv3."
		>
			{#snippet actions()}
				<Button
					variant="default"
					size="lg"
					href={resolve('/workspace')}
					onclick={() => track('cta_clicked', { target: 'workspace', location: 'engine_hero' })}
				>
					Open the workspace
				</Button>
				<Button
					variant="outline"
					size="lg"
					href={REPO_URL}
					target="_blank"
					rel="noopener noreferrer"
					onclick={() => track('outbound_clicked', { destination: 'github', location: 'engine_hero' })}
				>
					<IconBrandGithub />
					Read the source
				</Button>
			{/snippet}
			{#snippet aside()}
				<Well bodyClass="flex flex-col gap-6 p-6 sm:p-8">
					<dl class="grid grid-cols-2 gap-x-6 gap-y-5">
						{#each stats as stat (stat.label)}
							<div class="flex flex-col gap-1">
								<dt class="order-2 text-xs text-muted-foreground">{stat.label}</dt>
								<dd class="pixel order-1 text-2xl text-foreground tabular-nums">{stat.value}</dd>
							</div>
						{/each}
					</dl>
					<div
						class="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 font-mono text-sm"
					>
						<IconBrandNpm class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<code class="min-w-0 overflow-x-auto text-foreground">npm i glyphtex-engine</code>
					</div>
				</Well>
			{/snippet}
		</PageHero>
	</RailRow>

	<Section id="origin" number={1} title="we wanted the compiler to be ours.">
		<div class={prose}>
			<p>
				Every browser LaTeX editor we looked at compiles on a server. Your thesis leaves your
				machine, you queue behind other people's builds, and the day the service goes down your
				deadline goes with it.
			</p>
			<p>
				So: could a real TeX engine run in a tab, with no network? Not a subset, not an
				approximation. The actual engine, producing the PDF a journal expects.
			</p>
			<p>
				The research said no: we would be cross-compiling a large C codebase by hand. Then we read
				Tectonic's source properly.
			</p>
		</div>
	</Section>

	<Section id="tectonic" number={2} title="tectonic had already solved it.">
		<div class={prose}>
			<p>
				Tectonic had spent years removing every piece of TeX that touches an operating system. No
				direct file opens, no kpathsea, no subprocesses, no threads. Instead, input and output route
				back into Rust through one trait.
			</p>
			<p>
				That trait is the whole story. File lookup, the one thing a browser makes hard, was already
				behind a single interface. Tectonic did it for reproducible builds, not for the web, and
				built one of the most web-ready TeX engines there is.
			</p>
			<p>
				We were not first. A little-known repository already had a working WebAssembly build. The
				engine worked; the wrapper around it did not. Good trade.
			</p>
		</div>
	</Section>

	<Section
		id="build-log"
		number={3}
		title="the engine was the easy half."
		description="Most of these took longer to diagnose than to fix."
	>
		<ul>
			{#each buildLog as entry (entry.symptom)}
				<li
					class="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-dashed border-border py-5 md:grid-cols-3"
				>
					<div class="flex flex-col gap-1">
						<span class="font-mono text-xs text-muted-foreground">Symptom</span>
						<p class="font-mono text-sm text-foreground">{entry.symptom}</p>
					</div>
					<div class="flex flex-col gap-1">
						<span class="font-mono text-xs text-muted-foreground">Cause</span>
						<p class="text-sm text-muted-foreground">{entry.cause}</p>
					</div>
					<div class="flex flex-col gap-1">
						<span class="font-mono text-xs text-muted-foreground">Fix</span>
						<p class="text-sm text-foreground">{entry.fix}</p>
					</div>
				</li>
			{/each}
		</ul>
		<p class={note}>
			TeX has no graceful degradation. A missing font is not a smaller font: it is a hang, a blank
			page, or exit code zero with nothing in the PDF. So the bundle is built by compiling real
			documents and feeding back whatever they report missing.
		</p>
	</Section>

	<Section
		id="pipeline"
		number={4}
		title="what happens when you press compile."
		description="The same sequence a local latexmk run performs, in memory, with nothing leaving your machine."
	>
		<ol class="grid gap-x-10 sm:grid-cols-2">
			{#each pipeline as item, i (item.title)}
				<li class="flex gap-4 border-t border-dashed border-border py-5">
					<span class="w-6 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
						{String(i + 1).padStart(2, '0')}
					</span>
					<div class="min-w-0">
						<h3 class="text-sm font-medium text-foreground">{item.title}</h3>
						<p class="mt-1 text-sm text-pretty text-muted-foreground">{item.body}</p>
					</div>
				</li>
			{/each}
		</ol>
		<p class={note}>
			A TeX file lookup is synchronous, so everything resolves before step 01. That one constraint
			is why the bundle is prebuilt rather than fetched mid-compile.
		</p>
	</Section>

	<Section
		id="landscape"
		number={5}
		title="the projects that got here first."
		description="Every project below is open source. Placement, not a scoreboard."
	>
		<div class="overflow-x-auto rounded-xl border border-border">
			<table class="w-full min-w-184 border-collapse text-left text-sm">
				<thead class="bg-card">
					<tr>
						<th scope="col" class="px-4 py-3 font-medium text-foreground">Project</th>
						<th scope="col" class="px-4 py-3 font-medium text-foreground">Engine</th>
						<th scope="col" class="px-4 py-3 font-medium text-foreground">Where files come from</th>
						<th scope="col" class="px-4 py-3 font-medium text-foreground">Offline</th>
						<th scope="col" class="px-4 py-3 font-medium text-foreground">Trade-off it made</th>
					</tr>
				</thead>
				<tbody>
					{#each landscape as row (row.name)}
						<tr class={['border-t border-border align-top', row.ours && 'bg-foreground/[0.03]']}>
							<th scope="row" class="px-4 py-3 font-medium whitespace-nowrap text-foreground">
								{row.name}
								{#if row.ours}
									<span class="block font-mono text-xs font-normal text-muted-foreground">
										This project
									</span>
								{/if}
							</th>
							<td class="px-4 py-3 text-muted-foreground">{row.engine}</td>
							<td class="px-4 py-3 text-muted-foreground">{row.files}</td>
							<td class="px-4 py-3">
								<span class="flex items-center gap-1.5 whitespace-nowrap text-foreground">
									{#if row.offline}
										<IconCheck class="size-4" aria-hidden="true" /> Yes
									{:else}
										<IconX class="size-4 text-muted-foreground" aria-hidden="true" /> No
									{/if}
								</span>
							</td>
							<td class="px-4 py-3 text-muted-foreground">{row.note}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class={note}>
			We built on Tectonic, which builds on XeTeX, which builds on TeX. The tooling is GPLv3 so the
			next person does not have to rediscover the six bugs above.
		</p>
	</Section>

	<Section
		id="limits"
		number={6}
		title="what works, and what cannot."
		description="Two things genuinely do not work in a browser. Naming them is cheaper than letting you find out at midnight."
	>
		<ul>
			{#each limits as limit (limit.title)}
				<li class="flex gap-4 border-t border-dashed border-border py-5">
					<span
						class="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground"
						aria-hidden="true"
					>
						{#if limit.works}
							<IconCheck class="size-4.5" />
						{:else}
							<IconX class="size-4.5" />
						{/if}
					</span>
					<div class="min-w-0">
						<h3 class="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-foreground">
							{limit.title}
							<span class="font-mono text-xs font-normal text-muted-foreground">
								{limit.works ? 'Works' : 'Does not work'}
							</span>
						</h3>
						<p class="mt-1 max-w-2xl text-sm text-pretty text-muted-foreground">{limit.body}</p>
					</div>
				</li>
			{/each}
		</ul>
	</Section>

	<RailRow label="Try it">
		<BrandPanel
			title="Open a document and watch it compile."
			body="No account, no queue, no upload. The compiler downloads once and then belongs to your browser."
		>
			{#snippet icon()}
				<IconCpu />
			{/snippet}
			{#snippet actions()}
				<Button
					variant="dark"
					href={resolve('/workspace')}
					onclick={() => track('cta_clicked', { target: 'workspace', location: 'engine_footer' })}
				>
					Open the workspace
				</Button>
				<Button variant="outline" href={resolve('/')}>Back to the overview</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
