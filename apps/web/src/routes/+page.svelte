<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import FloatingGlyphs from '$lib/FloatingGlyphs.svelte';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import SiteHeader from '$lib/SiteHeader.svelte';
	import { SplitReveal } from '$lib/motion-core';
	import { trackEvent } from '$lib/analytics';
	import { Reveal } from '@glyphx/ui/reveal';
	import {
		IconAlertTriangle,
		IconArrowRight,
		IconBolt,
		IconBrandDropbox,
		IconCheck,
		IconChevronDown,
		IconCloud,
		IconCpu,
		IconDownload,
		IconFileText,
		IconFolder,
		IconGitBranch,
		IconKey,
		IconLayoutColumns,
		IconLock,
		IconMinus,
		IconPlayerPlay,
		IconShare,
		IconStar,
		IconWifiOff
	} from '@tabler/icons-svelte';

	// Hero mount shows a real product screenshot when `static/hero-editor.png`
	// exists; if it's missing, `onerror` flips this and the coded split-preview
	// fallback renders instead. Drop a screenshot at that path to go live.
	let heroImgOk = $state(true);

	const repo = 'https://github.com/kanakkholwal/glyphx';
	// Live GitHub star count for honest social proof — falls back to just
	// "Star on GitHub" if the API is unreachable / rate-limited (no invented numbers).
	let stars = $state<number | null>(null);
	function formatStars(n: number): string {
		return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
	}
	onMount(async () => {
		try {
			const r = await fetch('https://api.github.com/repos/kanakkholwal/glyphx');
			if (r.ok) {
				// Untrusted response — narrow the one field we read (AGENTS.md rule #4).
				const d = (await r.json()) as { stargazers_count?: unknown };
				if (typeof d.stargazers_count === 'number') stars = d.stargazers_count;
			}
		} catch {
			/* offline or rate-limited — render the link without a count */
		}
	});

	// Feature sections — autosend pattern: an eyebrow + editorial headline, a
	// left list of capabilities, and a framed product mount on the right.
	type FeatureItem = { icon: typeof IconFileText; title: string; body: string };
	type FeatureSection = {
		eyebrow: string;
		/** Headline HTML — may contain <em> for italic emphasis. */
		headline: string;
		items: FeatureItem[];
		mount: 'editor' | 'git';
		cta: string;
		href: string;
	};
	const featureSections: FeatureSection[] = [
		{
			eyebrow: '#01 — Write & compile',
			headline: 'Real LaTeX, compiled on <em>your own machine</em>.',
			items: [
				{
					icon: IconFileText,
					title: 'Real LaTeX',
					body: 'Full math, figures, BibTeX, and the packages a journal template or thesis class needs. What you write is standard .tex.'
				},
				{
					icon: IconBolt,
					title: 'Local engine',
					body: 'The compiler runs on your computer. No shared queue, no server, and no timeout the night before a deadline.'
				},
				{
					icon: IconLayoutColumns,
					title: 'Source & page',
					body: 'Write on the left, watch it render on the right. Double-click the PDF to jump to the line that made it.'
				}
			],
			mount: 'editor',
			cta: 'Try it in the browser',
			href: resolve('/editor')
		},
		{
			eyebrow: '#02 — Version & privacy',
			headline: 'Your history and your drafts, <em>yours alone</em>.',
			items: [
				{
					icon: IconGitBranch,
					title: 'Git built in',
					body: 'Stage and commit, read a side-by-side diff, browse history, clone, and push or pull with your own remote. No paywall.'
				},
				{
					icon: IconLock,
					title: 'Private by default',
					body: 'Unpublished results, grant drafts, a thesis under embargo — none of it is uploaded, indexed, or fed to a model.'
				},
				{
					icon: IconWifiOff,
					title: 'Offline always',
					body: 'The editor and the engine both run on your machine, so a flaky connection never stops you mid-sentence.'
				}
			],
			mount: 'git',
			cta: 'See the full comparison',
			href: '#compare'
		}
	];

	// "Works with" grid — the real LaTeX tools GlyphX supports today.
	const integrations: { icon: typeof IconFileText; label: string; note: string }[] = [
		{ icon: IconBolt, label: 'Tectonic', note: 'Bundled engine' },
		{ icon: IconCpu, label: 'TeX Live', note: 'System engine' },
		{ icon: IconCpu, label: 'MiKTeX', note: 'System engine' },
		{ icon: IconFileText, label: 'BibTeX & Biber', note: 'Bibliographies' },
		{ icon: IconGitBranch, label: 'Git', note: 'Your remote' },
		{ icon: IconFolder, label: 'Overleaf projects', note: 'Drop the folder' }
	];

	// Recurring Overleaf frustrations, paraphrased from what people actually hit,
	// rendered as a console log of "cloud errors" that GlyphX clears to zero —
	// the same shape as the editor's own Problems panel.
	type LogLevel = 'ERROR' | 'WARN';
	type LogLine = { time: string; level: LogLevel; msg: string };
	const cloudLog: LogLine[] = [
		{ time: '14:02', level: 'ERROR', msg: 'compile timed out — free-tier limit reached' },
		{ time: '14:03', level: 'WARN', msg: 'upgrade required to keep working' },
		{ time: '14:04', level: 'WARN', msg: 'version history locked behind a paid plan' },
		{ time: '14:06', level: 'ERROR', msg: 'editor lagging — every keystroke round-trips a server' },
		{ time: '14:07', level: 'WARN', msg: 'draft stored on infrastructure you do not control' },
		{ time: '14:09', level: 'ERROR', msg: 'no connection — the cloud editor is unavailable' }
	];
	// Log level → semantic status color (status tokens, not the brand accent).
	const logLevelClass: Record<LogLevel, string> = {
		ERROR: 'text-destructive',
		WARN: 'text-warning'
	};

	// What stays local vs. what you reach through your own accounts.
	const local = [
		{
			icon: IconCpu,
			title: 'The compiler',
			body: 'The LaTeX engine runs on your computer. Nothing is queued on our servers.'
		},
		{
			icon: IconFolder,
			title: 'Your files',
			body: 'Projects are folders on your disk. Opening one reads a directory, saving writes a file.'
		},
		{
			icon: IconGitBranch,
			title: 'Your history',
			body: 'Commits live in your own Git repository, on your machine and on the remote you pick.'
		}
	] as const;

	const connected = [
		{
			icon: IconKey,
			title: 'Your AI key',
			body: 'Connect a key from a provider you trust. Requests go from the app straight to them.',
			tag: 'Planned'
		},
		{
			icon: IconCloud,
			title: 'Your cloud storage',
			body: 'Sync through Dropbox or Google Drive, on the account you already pay for.',
			tag: 'Planned'
		},
		{
			icon: IconShare,
			title: 'Sharing',
			body: 'Hand a project to a collaborator, stored only while shared and only under your name.',
			tag: 'Planned'
		}
	] as const;

	type Cell = boolean | string;
	type Row = { label: string; glyph: Cell; overleaf: Cell; desktop: Cell };
	const comparison: Row[] = [
		{ label: 'Real LaTeX, journal-ready output', glyph: true, overleaf: true, desktop: true },
		{ label: 'Runs fully offline', glyph: true, overleaf: false, desktop: true },
		{ label: 'Nothing uploaded to a server', glyph: true, overleaf: false, desktop: true },
		{ label: 'No compile timeout', glyph: true, overleaf: 'Free limit', desktop: true },
		{ label: 'Git built in', glyph: true, overleaf: 'Paid', desktop: 'Bring your own' },
		{
			label: 'Version history without paying',
			glyph: 'Built in',
			overleaf: 'Paid',
			desktop: 'Your VCS'
		},
		{ label: 'AI help with your own key', glyph: 'Planned', overleaf: 'Paid', desktop: false },
		{
			label: 'Sync through your own cloud',
			glyph: 'Planned',
			overleaf: 'Dropbox, paid',
			desktop: 'Your cloud'
		},
		{ label: 'Free, no account', glyph: true, overleaf: 'Limited', desktop: true }
	];

	const steps = [
		{
			n: '01',
			title: 'Open a folder, or start a blank one',
			body: 'Point GlyphX at an existing project directory or create a new document. There is no upload step and no size to worry about.'
		},
		{
			n: '02',
			title: 'Write LaTeX with the page beside you',
			body: 'Type real LaTeX and watch the document update next to it. Math, figures, and citations render as you go.'
		},
		{
			n: '03',
			title: 'Export the PDF your journal expects',
			body: 'Compile to a clean PDF that matches your template or thesis spec. The file lands in your folder, ready to submit.'
		}
	];

	const faqs = [
		{
			q: 'Is this real LaTeX or a watered-down version?',
			a: 'Real LaTeX. Full math, environments, figures, and BibTeX, with the packages a journal template or thesis class needs. What you write is standard .tex that any LaTeX setup can read.'
		},
		{
			q: 'Do I have to install a TeX distribution?',
			a: 'No. The desktop app ships with the engine built in, and the browser editor compiles in the page. There is no multi gigabyte download and no package manager to fight.'
		},
		{
			q: 'Where do my files live?',
			a: 'On your disk. A project is a normal folder of .tex and .bib files. Nothing is copied to a server, so backups, syncing, and Git are entirely your call.'
		},
		{
			q: 'Can I bring my Overleaf projects over?',
			a: 'Yes. Overleaf projects are plain LaTeX underneath. Download the project folder, drop it into GlyphX, and keep writing.'
		},
		{
			q: 'Does GlyphX have version control?',
			a: 'Yes. The desktop app has a built in Git client: stage and commit, read a side by side diff, browse history, clone a repository, and push, pull, or sync with your own remote. No subscription tier in the way.'
		},
		{
			q: 'Does it use AI, and where would my data go?',
			a: 'AI help is on the roadmap and will be opt in with your own key. You would connect a provider such as OpenAI or another one you trust, and requests go from the app straight to them on your account. We are not in the path, and there is no shared model trained on your writing.'
		},
		{
			q: 'What does it cost?',
			a: 'The browser editor is free with no account. The desktop app is free as well. The source is on GitHub if you want to read it or build it yourself.'
		},
		{
			q: 'Does it really work offline?',
			a: 'On the desktop, yes. The editor and the engine both run on your machine, so a flaky connection or no connection at all does not stop you. The browser editor needs to be online the first time it fetches a package.'
		}
	];

	// The "trifecta" — three pillars that orbit the one thing GlyphX is built on:
	// your own machine. Rendered as a concentric diagram on desktop, stacked on
	// mobile. Each maps to a deeper feature section below.
	const pillars: { icon: typeof IconFileText; title: string; body: string }[] = [
		{
			icon: IconBolt,
			title: 'Write & compile',
			body: 'Real LaTeX with the engine running locally — no shared queue, no timeout.'
		},
		{
			icon: IconGitBranch,
			title: 'Version & privacy',
			body: 'Built-in Git and drafts that never leave your disk unless you share them.'
		},
		{
			icon: IconWifiOff,
			title: 'Offline, always',
			body: 'Editor and engine both run on your computer, online or not.'
		}
	];

	// Absolute placement for the three trifecta nodes (top, bottom-left,
	// bottom-right), index-aligned to `pillars`.
	const pillarNodePos = [
		'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
		'bottom-[8%] left-[6%] -translate-x-1/4 translate-y-1/4',
		'bottom-[8%] right-[6%] translate-x-1/4 translate-y-1/4'
	];
</script>

<svelte:head>
	<title>GlyphX: the LaTeX editor Overleaf should have been</title>
	<meta
		name="description"
		content="GlyphX is a local-first LaTeX editor for researchers, PhD students, and mathematicians. Write papers and theses in real LaTeX, compile on your own machine, use built-in Git, and keep your drafts off other people's servers. Free in your browser, plus a native desktop app."
	/>
</svelte:head>

<div class="bg-canvas text-foreground min-h-dvh">
	<SiteHeader />

	<!-- ============================================================
	     Hero: centered headline + a full-width product window beneath
	     ============================================================ -->
	<section class="relative overflow-hidden">
		<FloatingGlyphs />
		<!-- soft brand glow behind the headline -->
		<div
			class="pointer-events-none absolute top-[-12%] left-1/2 -z-0 h-[460px] w-[820px] max-w-[92vw] -translate-x-1/2 rounded-full opacity-60 blur-[130px]"
			style="background: radial-gradient(closest-side, var(--brand-subtle), transparent);"
			aria-hidden="true"
		></div>

		<div class="relative mx-auto max-w-[1140px] px-5 sm:px-6">
			<div class="flex flex-col items-center pt-24 text-center sm:pt-32">
				<!-- Hero is rendered visible by default (no Reveal gate): it's the LCP
				     element, so it must paint immediately for Core Web Vitals and for
				     no-JS / slow-JS visitors. Scroll-reveal starts below the fold. -->
				<h1 class="font-serif mx-auto max-w-4xl text-[2.9rem] leading-[1.02] sm:text-[4.6rem]">
					The LaTeX editor<br class="hidden sm:block" /> Overleaf
					<em>should have been</em>.
				</h1>
				<div class="flex flex-col items-center">
					<p class="text-muted-foreground mt-7 max-w-[38rem] text-lg leading-relaxed">
						Write papers, proofs, and theses in real LaTeX — the editor, the compiler, your files,
						and Git all run on your own computer.
					</p>
					<div class="mt-9 flex flex-wrap items-center justify-center gap-3">
						<a
							href={resolve('/download')}
							onclick={() => trackEvent('cta_download_click', { location: 'hero' })}
							class="bg-brand text-brand-foreground shadow-craft-sm group inline-flex h-12 items-center gap-2 rounded-lg px-6 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
						>
							<IconDownload class="size-4" /> Get the desktop app
						</a>
						<a
							href={resolve('/editor')}
							class="border-hairline bg-card text-foreground hover:bg-muted group inline-flex h-12 items-center gap-2 rounded-lg border px-6 text-sm font-semibold transition-colors"
						>
							<IconPlayerPlay class="size-4" /> Try it in the browser
							<IconArrowRight class="size-4 transition-transform group-hover:translate-x-0.5" />
						</a>
					</div>
					<a
						href={repo}
						target="_blank"
						rel="noopener noreferrer"
						class="text-muted-foreground hover:text-foreground mt-5 inline-flex items-center gap-1.5 font-mono text-xs transition-colors"
					>
						<IconStar class="text-brand size-3.5" />
						Star on GitHub
						{#if stars !== null}
							<span class="text-foreground font-semibold tabular-nums">· {formatStars(stars)}</span>
						{/if}
					</a>
				</div>
			</div>

			<!-- Framed product mount: the LCP image — rendered immediately (no Reveal
			     gate) so it paints fast. -->
			<div class="relative mt-14 sm:mt-16">
				<!-- soft brand glow lifting the mount off the canvas -->
				<div
					class="pointer-events-none absolute -inset-x-8 -top-4 bottom-[-14%] -z-10 rounded-[2.5rem] opacity-70 blur-3xl"
					style="background: radial-gradient(60% 60% at 50% 30%, var(--brand-subtle), transparent 75%);"
					aria-hidden="true"
				></div>
				<div
					class="border-hairline bg-card shadow-craft-floating overflow-hidden rounded-2xl border"
				>
					<div class="border-hairline flex h-11 items-center gap-2 border-b px-4">
						<span class="bg-muted-foreground/30 size-2.5 rounded-full"></span>
						<span class="bg-muted-foreground/30 size-2.5 rounded-full"></span>
						<span class="bg-muted-foreground/30 size-2.5 rounded-full"></span>
						<span class="text-muted-foreground ml-3 font-mono text-xs">thesis.tex</span>
						<span
							class="text-brand border-brand/30 bg-brand-subtle ml-auto rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase"
							>LaTeX</span
						>
					</div>
					{#if heroImgOk}
						<img
							src="/hero-editor.png"
							alt="GlyphX editing a LaTeX document with a live PDF preview beside the source"
							class="block w-full"
							onerror={() => (heroImgOk = false)}
						/>
					{:else}
						<div class="grid grid-cols-1 lg:grid-cols-2">
							<pre
								class="text-muted-foreground border-hairline overflow-hidden border-b p-5 font-mono text-[12px] leading-[1.85] sm:p-6 lg:border-r lg:border-b-0"><span
									class="text-brand">\documentclass</span
								>&#123;article&#125;
<span class="text-brand">\usepackage</span>&#123;amsmath&#125;

<span class="text-brand">\title</span>&#123;On Local-First Typesetting&#125;
<span class="text-brand">\author</span>&#123;A. Researcher&#125;

<span class="text-brand">\begin</span>&#123;document&#125;
<span class="text-brand">\maketitle</span>

We observe that the estimator <span class="text-foreground">$\hat&#123;\theta&#125;$</span>
is consistent, with <span class="text-foreground">$\alpha$</span> scaling as <span
									class="text-foreground">$\beta^2$</span
								>:

<span class="text-brand">\begin</span>&#123;equation&#125;
  E = m c^2
<span class="text-brand">\end</span>&#123;equation&#125;

See <span class="text-brand">\cite</span>&#123;einstein1905&#125;.<span
									class="text-brand inline-block h-[1em] w-[2px] translate-y-[2px] align-middle [animation:blink_1.05s_steps(1)_infinite]"
								></span>
<span class="text-brand">\end</span>&#123;document&#125;</pre>
							<div class="bg-canvas/50 p-7 sm:p-9">
								<div
									class="text-muted-foreground mb-4 font-mono text-[11px] tracking-widest uppercase"
								>
									Live preview
								</div>
								<h3 class="font-display mb-1 text-2xl">On Local-First Typesetting</h3>
								<p class="text-muted-foreground mb-5 text-sm">A. Researcher</p>
								<p class="text-muted-foreground leading-relaxed">
									We observe that the estimator θ̂ is consistent, with α scaling as β²:
								</p>
								<div class="text-foreground my-4 text-center text-2xl italic">E = mc²</div>
								<p class="text-muted-foreground text-sm">See [1].</p>
							</div>
						</div>
					{/if}
					<div
						class="border-hairline text-muted-foreground flex h-9 items-center gap-4 border-t px-4 font-mono text-[11px]"
					>
						<span class="text-brand flex items-center gap-1.5">
							<span class="bg-brand size-1.5 rounded-full"></span> compiled
						</span>
						<span>on your device</span>
						<span class="text-muted-foreground ml-auto tabular-nums">offline · Ln 14</span>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Logo / tech strip — the honest "works with" cloud (real LaTeX tooling, not
	     invented customer logos), with the trust signals beneath it. -->
	<Reveal as="section" variant="up" class="mt-16 sm:mt-20">
		<div class="border-hairline mx-auto max-w-[1140px] border-y px-5 py-10 sm:px-6 sm:py-12">
			<p
				class="text-muted-foreground text-center font-mono text-[11px] font-semibold tracking-[0.2em] uppercase"
			>
				Works with the LaTeX you already use
			</p>
			<div class="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
				{#each integrations as it (it.label)}
					{@const Icon = it.icon}
					<span
						class="text-muted-foreground/90 inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
					>
						<Icon class="size-[18px]" />
						{it.label}
					</span>
				{/each}
			</div>
			<div
				class="text-muted-foreground mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 font-mono text-xs"
			>
				{#each ['Nothing uploaded', 'Compiles locally', 'No account', 'Free and open source'] as t (t)}
					<span class="flex items-center gap-2">
						<span class="bg-brand size-1.5 rounded-full"></span>
						{t}
					</span>
				{/each}
			</div>
		</div>
	</Reveal>

	<!-- ============================================================
	     The problem — a console of "cloud errors" that clears to zero,
	     echoing the editor's own Problems panel.
	     ============================================================ -->
	<section class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
		<div class="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
			<Reveal variant="up">
				<span
					class="text-muted-foreground font-mono text-[11px] font-semibold tracking-[0.2em] uppercase"
				>
					Sound familiar
				</span>
				<h2 class="font-serif mt-4 text-3xl sm:text-[2.7rem] sm:leading-[1.06]">
					<SplitReveal mode="lines" triggerOnScroll class="block">
						If you have lived in Overleaf, you know these.
					</SplitReveal>
				</h2>
				<p class="text-muted-foreground mt-4 text-lg leading-relaxed">
					Overleaf put LaTeX one click away, and that got a lot of people writing. Then the browser
					started getting in the way. The same handful of messages kept coming back.
				</p>
				<p class="text-foreground mt-6 text-base leading-relaxed font-medium">
					None of these are LaTeX problems. They are cloud problems. GlyphX has no cloud, so it has
					none of them.
				</p>
			</Reveal>

			<!-- A log viewer: the cloud's recurring "errors", cleared by GlyphX to a
			     single all-clear line — the same shape as the editor's Problems panel. -->
			<Reveal variant="up" delay={80} class="relative">
				<div
					class="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] opacity-70 blur-3xl"
					style="background: radial-gradient(60% 60% at 50% 30%, var(--brand-subtle), transparent 75%);"
					aria-hidden="true"
				></div>
				<div
					class="border-hairline bg-card shadow-craft-floating overflow-hidden rounded-2xl border"
				>
					<!-- window chrome -->
					<div class="border-hairline flex items-center gap-2 border-b px-4 py-3">
						<span class="bg-muted-foreground/30 size-2.5 rounded-full"></span>
						<span class="bg-muted-foreground/30 size-2.5 rounded-full"></span>
						<span class="bg-muted-foreground/30 size-2.5 rounded-full"></span>
						<span class="text-muted-foreground ml-3 font-mono text-xs">cloud.log</span>
						<span
							class="text-destructive border-destructive/30 bg-destructive/10 ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase"
						>
							<IconAlertTriangle class="size-3" />
							{cloudLog.length} problems
						</span>
					</div>

					<!-- log body -->
					<div
						class="bg-canvas/40 px-4 py-3 font-mono text-[12.5px] leading-relaxed sm:px-5 sm:py-4"
					>
						{#each cloudLog as line, i (line.msg)}
							<Reveal
								as="div"
								variant="up"
								delay={i * 70}
								class="flex items-baseline gap-2.5 py-1.5 sm:gap-3"
							>
								<span class="text-muted-foreground/60 shrink-0 tabular-nums">{line.time}</span>
								<span class="{logLevelClass[line.level]} w-11 shrink-0 font-semibold"
									>{line.level}</span
								>
								<span class="text-foreground/75 min-w-0">{line.msg}</span>
							</Reveal>
						{/each}

						<!-- the line where the noise stops -->
						<div class="border-hairline mt-2 border-t pt-3">
							<Reveal
								as="div"
								variant="up"
								delay={cloudLog.length * 70}
								class="flex items-baseline gap-2.5 py-0.5 sm:gap-3"
							>
								<span class="bg-brand size-1.5 shrink-0 translate-y-[-1px] rounded-full"></span>
								<span class="text-brand shrink-0 font-semibold">glyphx&nbsp;▸</span>
								<span class="text-foreground/90">0 problems · compiled on your device</span>
							</Reveal>
						</div>
					</div>

					<!-- status bar -->
					<div
						class="border-hairline text-muted-foreground flex h-9 items-center gap-4 border-t px-4 font-mono text-[11px]"
					>
						<span class="text-brand flex items-center gap-1.5">
							<span class="bg-brand size-1.5 rounded-full"></span> no cloud
						</span>
						<span class="hidden sm:inline">nothing to time out, upsell, or unsubscribe from</span>
						<span class="ml-auto tabular-nums">offline</span>
					</div>
				</div>
			</Reveal>
		</div>
	</section>

	<!-- ============================================================
	     Feature sections: an eyebrow + editorial headline, a left
	     capability list, and a framed product mount on a dark backdrop.
	     ============================================================ -->
	<!-- ============================================================
	     The complete suite — intro framing for the two product modules
	     ============================================================ -->
	<section class="border-hairline relative overflow-hidden border-t">
		<div
			class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64"
			style="background: linear-gradient(to bottom, var(--surface-soft), transparent);"
			aria-hidden="true"
		></div>
		<div class="mx-auto max-w-[1140px] px-5 pt-20 pb-4 text-center sm:px-6 sm:pt-28">
			<Reveal variant="up" class="mx-auto max-w-2xl">
				<span class="text-brand font-mono text-[11px] font-semibold tracking-[0.2em] uppercase">
					One app, the whole pipeline
				</span>
				<h2 class="font-serif mt-4 text-3xl sm:text-[2.7rem] sm:leading-[1.06]">
					Everything to write, compile, and version — <em>in one place</em>.
				</h2>
				<p class="text-muted-foreground mt-4 text-lg leading-relaxed">
					No stitched-together tools, no separate TeX install, no server in the loop. The editor,
					the engine, and the version control all live in the same window.
				</p>
			</Reveal>
		</div>
	</section>

	<div id="features">
		{#each featureSections as sec, si (sec.eyebrow)}
			{@const flip = si % 2 === 1}
			<section class="border-hairline border-t">
				<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
					<Reveal variant="up">
						<div class="border-hairline overflow-hidden rounded-2xl border">
							<!-- header -->
							<div class="p-8 sm:p-10">
								<span
									class="text-brand font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
								>
									{sec.eyebrow}
								</span>
								<h2 class="font-serif mt-4 max-w-xl text-3xl sm:text-[2.3rem] sm:leading-[1.1]">
									{@html sec.headline}
								</h2>
							</div>
							<!-- body: capability list + framed mount (sides alternate per module) -->
							<div class="border-hairline grid border-t lg:grid-cols-2">
								<ul
									class="border-hairline border-b lg:border-b-0 {flip
										? 'lg:order-last lg:border-l'
										: 'lg:border-r'}"
								>
									{#each sec.items as it, ii (it.title)}
										{@const Icon = it.icon}
										<li
											class="border-hairline relative flex gap-4 border-b p-6 last:border-b-0 sm:p-7"
										>
											{#if ii === 0}
												<span class="bg-brand absolute top-6 bottom-6 left-0 w-[3px] rounded-r-full"
												></span>
											{/if}
											<span
												class="border-hairline bg-canvas text-brand grid size-9 shrink-0 place-items-center rounded-lg border"
											>
												<Icon class="size-[18px]" />
											</span>
											<div>
												<h3
													class="text-foreground font-mono text-xs font-semibold tracking-wider uppercase"
												>
													{it.title}
												</h3>
												<p class="text-muted-foreground mt-2 text-sm leading-relaxed">{it.body}</p>
											</div>
										</li>
									{/each}
								</ul>
								<!-- framed product mount on a dark backdrop, bled to the bottom edge -->
								<div
									class="bg-primary relative flex min-h-[360px] items-end overflow-hidden p-6 pb-0 sm:min-h-[440px] sm:p-10 sm:pb-0 {flip
										? 'lg:order-first'
										: ''}"
								>
									<div
										class="pointer-events-none absolute inset-0 opacity-[0.06]"
										style="background-image: radial-gradient(circle at 1px 1px, var(--primary-foreground) 1px, transparent 0); background-size: 22px 22px;"
										aria-hidden="true"
									></div>
									<div
										class="pointer-events-none absolute -inset-10 opacity-45 blur-3xl"
										style="background: radial-gradient(55% 55% at 50% 35%, var(--brand-subtle), transparent 75%);"
										aria-hidden="true"
									></div>
									<div
										class="border-hairline bg-card shadow-craft-floating relative w-full overflow-hidden rounded-t-2xl border border-b-0"
									>
										<div class="border-hairline flex items-center gap-1.5 border-b px-4 py-3">
											<span class="bg-muted-foreground/40 size-2.5 rounded-full"></span>
											<span class="bg-muted-foreground/40 size-2.5 rounded-full"></span>
											<span class="bg-muted-foreground/40 size-2.5 rounded-full"></span>
											<span class="text-muted-foreground ml-2 font-mono text-[11px]">
												{sec.mount === 'editor' ? 'main.tex' : 'Source Control'}
											</span>
										</div>
										{#if sec.mount === 'editor'}
											<pre
												class="text-muted-foreground overflow-hidden px-5 py-4 font-mono text-[13px] leading-[1.85]"><span
													class="text-brand">\documentclass</span
												>&#123;article&#125;
<span class="text-brand">\usepackage</span>&#123;amsmath&#125;

<span class="text-brand">\title</span>&#123;On Local-First Typesetting&#125;
<span class="text-brand">\begin</span>&#123;document&#125;
<span class="text-brand">\maketitle</span>

<span class="text-brand">\begin</span>&#123;equation&#125;
  E = m c^2
<span class="text-brand">\end</span>&#123;equation&#125;
<span class="text-brand">\end</span>&#123;document&#125;</pre>
											<div
												class="border-hairline flex items-center gap-2 border-t px-5 py-3 font-mono text-[12px]"
											>
												<span class="text-brand flex items-center gap-1.5">
													<IconCheck class="size-4" /> compiled in 0.41s
												</span>
												<span class="text-muted-foreground ml-auto">offline · on your device</span>
											</div>
										{:else}
											<div class="flex flex-col gap-2.5 px-5 py-4 font-mono text-[13px]">
												<div class="text-muted-foreground flex items-center gap-2">
													<IconGitBranch class="text-brand size-4" /> main · 2 changes
												</div>
												<div class="text-muted-foreground flex items-center gap-2">
													<span class="text-warning w-4">M</span> chapter3.tex
												</div>
												<div class="text-muted-foreground flex items-center gap-2">
													<span class="text-success w-4">A</span> figures/plot.pdf
												</div>
											</div>
											<div class="border-hairline flex items-center gap-3 border-t px-5 py-3">
												<span
													class="bg-brand text-brand-foreground rounded-md px-3 py-1.5 font-mono text-[12px] font-semibold"
												>
													Commit
												</span>
												<span class="text-muted-foreground font-mono text-[12px]">your remote</span>
											</div>
										{/if}
									</div>
								</div>
							</div>
							<!-- footer link -->
							<a
								href={sec.href}
								class="border-hairline text-brand hover:bg-muted/40 flex items-center justify-center gap-2 border-t p-5 font-mono text-xs font-semibold tracking-wider uppercase transition-colors"
							>
								{sec.cta}
								<IconArrowRight class="size-4" />
							</a>
						</div>
					</Reveal>
				</div>
			</section>
		{/each}
	</div>

	<!-- ============================================================
	     The trifecta — three pillars orbiting your machine. Concentric
	     diagram on desktop; a clean stack on mobile.
	     ============================================================ -->
	<section class="border-hairline relative overflow-hidden border-t">
		<div
			class="pointer-events-none absolute top-[6%] left-1/2 -z-10 h-[520px] w-[820px] max-w-[92vw] -translate-x-1/2 rounded-full opacity-50 blur-[130px]"
			style="background: radial-gradient(closest-side, var(--brand-subtle), transparent);"
			aria-hidden="true"
		></div>
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up" class="mx-auto max-w-2xl text-center">
				<span
					class="text-muted-foreground font-mono text-[11px] font-semibold tracking-[0.2em] uppercase"
				>
					The trifecta
				</span>
				<h2 class="font-serif mt-4 text-3xl sm:text-[2.7rem] sm:leading-[1.06]">
					Three things that make GlyphX <em>yours</em>.
				</h2>
				<p class="text-muted-foreground mt-4 text-lg leading-relaxed">
					Everything orbits one decision: the work happens on your computer, not on someone else's
					server.
				</p>
			</Reveal>

			<!-- Desktop: concentric diagram with three orbiting nodes. -->
			<Reveal variant="up" delay={80} class="relative mt-16 hidden sm:block">
				<div class="relative mx-auto aspect-square w-full max-w-[560px]">
					<!-- rings -->
					<div class="border-hairline absolute inset-0 rounded-full border"></div>
					<div class="border-hairline-soft absolute inset-[15%] rounded-full border"></div>
					<div class="border-hairline-soft absolute inset-[30%] rounded-full border"></div>

					<!-- center: your machine -->
					<div
						class="absolute top-1/2 left-1/2 flex size-[30%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1.5 text-center"
					>
						<span
							class="border-hairline bg-card text-brand shadow-craft-md grid size-12 place-items-center rounded-2xl border"
						>
							<IconCpu class="size-6" />
						</span>
						<span
							class="text-foreground font-mono text-[11px] font-semibold tracking-[0.14em] uppercase"
						>
							Your machine
						</span>
					</div>

					<!-- three nodes: top, bottom-left, bottom-right (positions: pillarNodePos) -->
					{#each pillars as p, i (p.title)}
						{@const Icon = p.icon}
						<div class="absolute w-56 max-w-[44%] {pillarNodePos[i]}">
							<div
								class="border-hairline bg-card shadow-craft-lg flex flex-col gap-2 rounded-2xl border p-4"
							>
								<span
									class="border-hairline bg-canvas text-brand grid size-9 place-items-center rounded-lg border"
								>
									<Icon class="size-[18px]" />
								</span>
								<h3
									class="text-foreground font-mono text-xs font-semibold tracking-wider uppercase"
								>
									{p.title}
								</h3>
								<p class="text-muted-foreground text-[13px] leading-snug">{p.body}</p>
							</div>
						</div>
					{/each}
				</div>
			</Reveal>

			<!-- Mobile: stacked pillar cards. -->
			<div class="mt-12 grid gap-4 sm:hidden">
				{#each pillars as p (p.title)}
					{@const Icon = p.icon}
					<Reveal as="article" variant="up" class="border-hairline bg-card rounded-2xl border p-6">
						<span
							class="border-hairline bg-canvas text-brand mb-4 grid size-10 place-items-center rounded-lg border"
						>
							<Icon class="size-5" />
						</span>
						<h3 class="text-foreground font-mono text-xs font-semibold tracking-wider uppercase">
							{p.title}
						</h3>
						<p class="text-muted-foreground mt-2 text-sm leading-relaxed">{p.body}</p>
					</Reveal>
				{/each}
			</div>
		</div>
	</section>

	<!-- ============================================================
	     The ecosystem — standard LaTeX tooling, as a card grid
	     ============================================================ -->
	<section class="bg-surface-soft relative overflow-hidden">
		<div
			class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56"
			style="background: linear-gradient(to bottom, var(--canvas), transparent);"
			aria-hidden="true"
		></div>
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up" class="mx-auto max-w-2xl text-center">
				<span class="text-brand font-mono text-[11px] font-semibold tracking-[0.2em] uppercase">
					The ecosystem
				</span>
				<h2 class="font-serif mt-4 text-3xl sm:text-[2.7rem] sm:leading-[1.06]">
					The LaTeX you <em>already use</em>.
				</h2>
				<p class="text-muted-foreground mt-4 text-lg leading-relaxed">
					GlyphX speaks standard LaTeX and plugs into the tools around it — no proprietary format,
					no lock-in. Bring a project as-is and keep your engine, your bibliography, and your
					remote.
				</p>
			</Reveal>

			<div class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each integrations as it, i (it.label)}
					{@const Icon = it.icon}
					<Reveal
						as="article"
						variant="up"
						delay={i * 60}
						class="group border-hairline bg-card hover:border-brand/40 flex items-start gap-4 rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1"
					>
						<span
							class="border-hairline bg-canvas text-foreground group-hover:text-brand grid size-11 shrink-0 place-items-center rounded-xl border transition-colors"
						>
							<Icon class="size-5" />
						</span>
						<div class="min-w-0">
							<div class="text-foreground text-sm font-semibold tracking-tight">{it.label}</div>
							<div class="text-muted-foreground mt-1 text-[13px] leading-snug">{it.note}</div>
						</div>
					</Reveal>
				{/each}
			</div>
		</div>
	</section>

	<!-- ============================================================
	     Where your data goes: local core vs. your accounts
	     ============================================================ -->
	<section>
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up" class="max-w-2xl">
				<span
					class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
				>
					Where your data goes
				</span>
				<h2 class="font-serif mt-5 text-3xl sm:text-4xl">
					Local-first does not mean <em>cut off from the cloud</em>.
				</h2>
				<p class="text-muted-foreground mt-4 text-lg leading-relaxed">
					The private, heavy work stays on your machine. When you want sync, history, or a hand from
					a model, you reach the cloud through accounts you already have. The compiler is never a
					server, and the keys are always yours.
				</p>
			</Reveal>

			<!-- A single boundary card: the local core on the left, the optional reach
			     to your own accounts on the right, with the privacy promise as a footer. -->
			<Reveal variant="up" delay={60} class="mt-12">
				<div class="border-hairline bg-card overflow-hidden rounded-2xl border">
					<div class="grid lg:grid-cols-2">
						<!-- On your machine (brand-accented core) -->
						<div
							class="border-hairline relative overflow-hidden border-b p-8 sm:p-10 lg:border-r lg:border-b-0"
						>
							<div
								class="pointer-events-none absolute -top-16 -left-16 size-56 rounded-full opacity-70 blur-3xl"
								style="background: radial-gradient(closest-side, var(--brand-subtle), transparent);"
								aria-hidden="true"
							></div>
							<div class="relative mb-7 flex items-center gap-2">
								<span class="bg-brand size-1.5 rounded-full"></span>
								<span
									class="text-foreground font-mono text-[11px] font-semibold tracking-[0.16em] uppercase"
									>On your machine</span
								>
							</div>
							<div class="relative flex flex-col gap-5">
								{#each local as m (m.title)}
									{@const Icon = m.icon}
									<div class="flex items-start gap-3">
										<span
											class="border-hairline bg-canvas text-brand grid size-9 shrink-0 place-items-center rounded-lg border"
										>
											<Icon class="size-[18px]" />
										</span>
										<div>
											<h3 class="text-sm font-semibold">{m.title}</h3>
											<p class="text-muted-foreground mt-0.5 text-sm leading-relaxed">{m.body}</p>
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Through your accounts (quieter, opt-in) -->
						<div class="bg-surface-soft/50 p-8 sm:p-10">
							<div class="mb-7 flex items-center gap-2">
								<span class="bg-muted-foreground/40 size-1.5 rounded-full"></span>
								<span
									class="text-muted-foreground font-mono text-[11px] font-semibold tracking-[0.16em] uppercase"
									>Through your accounts</span
								>
							</div>
							<div class="flex flex-col gap-5">
								{#each connected as m (m.title)}
									{@const Icon = m.icon}
									<div class="flex items-start gap-3">
										<span
											class="border-hairline bg-canvas text-muted-foreground grid size-9 shrink-0 place-items-center rounded-lg border"
										>
											<Icon class="size-[18px]" />
										</span>
										<div class="flex-1">
											<div class="flex items-center gap-2">
												<h3 class="text-sm font-semibold">{m.title}</h3>
												<span
													class="border-hairline text-muted-foreground rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase"
													>{m.tag}</span
												>
											</div>
											<p class="text-muted-foreground mt-0.5 text-sm leading-relaxed">{m.body}</p>
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>

					<!-- the promise, as a footer strip -->
					<div class="border-hairline bg-brand-subtle flex items-start gap-3 border-t p-6">
						<IconLock class="text-brand mt-0.5 size-5 shrink-0" />
						<p class="text-foreground/90 text-[15px] leading-relaxed">
							We only ever hold what you choose to share, tied to your personal account. Click share
							and a project goes out under your name. Never click it, and your work never leaves
							your machine.
						</p>
					</div>
				</div>
			</Reveal>
		</div>
	</section>

	<!-- ============================================================
	     Comparison
	     ============================================================ -->
	<section id="compare" class="bg-surface-soft">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up" class="mx-auto max-w-2xl text-center">
				<span class="text-brand font-mono text-[11px] font-semibold tracking-[0.2em] uppercase">
					Compare
				</span>
				<h2 class="font-serif mt-4 text-3xl sm:text-[2.7rem] sm:leading-[1.06]">
					Private like your laptop. <em>Easy like the cloud was supposed to be.</em>
				</h2>
			</Reveal>

			<Reveal variant="up" delay={80} class="mt-12">
				<div class="border-hairline bg-card overflow-x-auto rounded-2xl border">
					<div class="grid min-w-[640px] grid-cols-[1.8fr_1fr_1fr_1fr] text-sm">
						<div
							class="text-muted-foreground px-5 py-5 font-mono text-[11px] tracking-widest uppercase"
						>
							&nbsp;
						</div>
						<div
							class="bg-brand text-brand-foreground flex items-center justify-center gap-1.5 rounded-t-xl px-3 py-5 text-center font-semibold"
						>
							<IconStar class="size-3.5" /> GlyphX
						</div>
						<div class="text-muted-foreground px-3 py-5 text-center font-medium">Overleaf free</div>
						<div class="text-muted-foreground px-3 py-5 text-center font-medium">
							Desktop&nbsp;TeX
						</div>

						{#each comparison as row (row.label)}
							<div class="border-hairline text-foreground/90 border-t px-5 py-4">{row.label}</div>
							<div class="border-hairline bg-brand-subtle border-t px-3 py-4 text-center">
								{#if row.glyph === true}
									<IconCheck class="text-brand mx-auto size-5" />
								{:else}
									<span class="text-brand font-mono text-xs font-semibold">{row.glyph}</span>
								{/if}
							</div>
							<div class="border-hairline text-muted-foreground border-t px-3 py-4 text-center">
								{#if row.overleaf === true}
									<IconCheck class="mx-auto size-5 opacity-70" />
								{:else if row.overleaf}
									<span class="font-mono text-xs">{row.overleaf}</span>
								{:else}
									<IconMinus class="text-muted-foreground/40 mx-auto size-4" />
								{/if}
							</div>
							<div class="border-hairline text-muted-foreground border-t px-3 py-4 text-center">
								{#if row.desktop === true}
									<IconCheck class="mx-auto size-5 opacity-70" />
								{:else if row.desktop}
									<span class="font-mono text-xs">{row.desktop}</span>
								{:else}
									<IconMinus class="text-muted-foreground/40 mx-auto size-4" />
								{/if}
							</div>
						{/each}
					</div>
				</div>
				<p class="text-muted-foreground mt-3 font-mono text-[11px]">
					Overleaf paid tiers lift some of these limits. The point is that GlyphX does not put them
					there to begin with.
				</p>
			</Reveal>
		</div>
	</section>

	<!-- ============================================================
	     How it works
	     ============================================================ -->
	<section>
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up" class="mx-auto max-w-2xl text-center">
				<span class="text-brand font-mono text-[11px] font-semibold tracking-[0.2em] uppercase">
					How it works
				</span>
				<h2 class="font-serif mt-4 text-3xl sm:text-[2.7rem] sm:leading-[1.06]">
					Three steps, <em>none of which involve a login</em>.
				</h2>
			</Reveal>

			<!-- Numbered timeline: circles connected by a dashed rail (desktop). -->
			<div class="relative mt-16 grid gap-10 sm:grid-cols-3 sm:gap-8">
				<div
					class="border-hairline absolute top-6 right-[16%] left-[16%] -z-10 hidden border-t border-dashed sm:block"
					aria-hidden="true"
				></div>
				{#each steps as s, i (s.n)}
					<Reveal
						as="article"
						variant="up"
						delay={i * 90}
						class="flex flex-col items-center text-center sm:items-start sm:text-left"
					>
						<span
							class="border-hairline bg-card text-brand shadow-craft-sm grid size-12 place-items-center rounded-full border font-mono text-sm font-semibold"
						>
							{s.n}
						</span>
						<h3 class="text-foreground mt-5 text-base font-semibold">{s.title}</h3>
						<p class="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed sm:max-w-none">
							{s.body}
						</p>
					</Reveal>
				{/each}
			</div>
		</div>
	</section>

	<!-- ============================================================
	     Roadmap — what's in the app today vs. what's next (honest board)
	     ============================================================ -->
	<section class="bg-surface-soft relative overflow-hidden">
		<div
			class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56"
			style="background: linear-gradient(to bottom, var(--canvas), transparent);"
			aria-hidden="true"
		></div>
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up" class="mx-auto max-w-2xl text-center">
				<span class="text-brand font-mono text-[11px] font-semibold tracking-[0.2em] uppercase">
					Roadmap
				</span>
				<h2 class="font-serif mt-4 text-3xl sm:text-[2.7rem] sm:leading-[1.06]">
					Built in the open, <em>honest about what's next</em>.
				</h2>
				<p class="text-muted-foreground mt-4 text-lg leading-relaxed">
					The core is here and working. A few things are still on the bench — and we would rather
					say so than pretend. The rule behind all of them stays the same: your providers, your
					keys, your data.
				</p>
			</Reveal>

			<div class="mt-12 grid gap-4 lg:grid-cols-2">
				<!-- In the app today -->
				<Reveal
					variant="up"
					class="border-hairline bg-card flex flex-col rounded-2xl border p-7 sm:p-8"
				>
					<div class="mb-6 flex items-center gap-2">
						<span class="bg-brand size-1.5 rounded-full"></span>
						<span
							class="text-foreground font-mono text-[11px] font-semibold tracking-[0.16em] uppercase"
							>In the app today</span
						>
					</div>
					<div class="flex flex-col gap-4">
						{#each [{ icon: IconFileText, label: 'Editor with live preview' }, { icon: IconBolt, label: 'Bundled LaTeX engine (Tectonic)' }, { icon: IconGitBranch, label: 'Built-in Git client' }, { icon: IconWifiOff, label: 'Fully offline on desktop' }] as r (r.label)}
							{@const Icon = r.icon}
							<div class="flex items-center gap-3">
								<span
									class="bg-brand-subtle text-brand grid size-8 shrink-0 place-items-center rounded-lg"
								>
									<Icon class="size-4" />
								</span>
								<span class="text-foreground text-sm font-medium">{r.label}</span>
								<IconCheck class="text-brand ml-auto size-4 shrink-0" />
							</div>
						{/each}
					</div>
				</Reveal>

				<!-- Building next -->
				<Reveal
					variant="up"
					delay={90}
					class="border-hairline bg-card/60 flex flex-col rounded-2xl border p-7 sm:p-8"
				>
					<div class="mb-6 flex items-center gap-2">
						<span class="bg-muted-foreground/40 size-1.5 rounded-full"></span>
						<span
							class="text-muted-foreground font-mono text-[11px] font-semibold tracking-[0.16em] uppercase"
							>Building next</span
						>
					</div>
					<div class="flex flex-col gap-4">
						{#each [{ icon: IconKey, label: 'Bring-your-own AI key' }, { icon: IconBrandDropbox, label: 'Dropbox & Google Drive sync' }, { icon: IconShare, label: 'Project sharing' }] as r (r.label)}
							{@const Icon = r.icon}
							<div class="flex items-center gap-3">
								<span
									class="border-hairline bg-canvas text-muted-foreground grid size-8 shrink-0 place-items-center rounded-lg border"
								>
									<Icon class="size-4" />
								</span>
								<span class="text-foreground text-sm font-medium">{r.label}</span>
								<span
									class="border-hairline text-muted-foreground ml-auto shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase"
									>planned</span
								>
							</div>
						{/each}
						<p class="text-muted-foreground mt-2 text-[13px] leading-relaxed">
							Not in the app yet — your providers, your keys, your data when they land.
						</p>
					</div>
				</Reveal>
			</div>
		</div>
	</section>

	<!-- ============================================================
	     FAQ
	     ============================================================ -->
	<section id="faq">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up" class="mx-auto max-w-2xl text-center">
				<span class="text-brand font-mono text-[11px] font-semibold tracking-[0.2em] uppercase">
					FAQ
				</span>
				<h2 class="font-serif mt-4 text-3xl sm:text-[2.7rem] sm:leading-[1.06]">
					The questions people ask first.
				</h2>
			</Reveal>

			<!-- Accordion — native <details>, so it works without JS and in SSR. -->
			<div class="mx-auto mt-12 flex max-w-3xl flex-col gap-3">
				{#each faqs as f, i (f.q)}
					<Reveal as="div" variant="up" delay={i * 35}>
						<details
							class="group border-hairline bg-card hover:border-brand/30 rounded-2xl border px-5 py-4 transition-colors open:shadow-craft-sm sm:px-6 sm:py-5 [&[open]_.faq-chev]:rotate-180"
						>
							<summary
								class="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden"
							>
								<h3 class="text-foreground text-[15px] font-semibold sm:text-base">{f.q}</h3>
								<span
									class="border-hairline text-muted-foreground group-hover:text-brand faq-chev grid size-7 shrink-0 place-items-center rounded-lg border transition-transform duration-300"
								>
									<IconChevronDown class="size-4" />
								</span>
							</summary>
							<p class="text-muted-foreground mt-3 text-sm leading-relaxed">{f.a}</p>
						</details>
					</Reveal>
				{/each}
			</div>
		</div>
	</section>

	<!-- ============================================================
	     CTA band
	     ============================================================ -->
	<section class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-24">
		<Reveal variant="scale">
			<div
				class="bg-primary text-primary-foreground relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16 sm:py-20"
			>
				<div
					class="pointer-events-none absolute inset-0 opacity-10"
					style="background-image: radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0); background-size: 22px 22px;"
					aria-hidden="true"
				></div>
				<div class="relative mx-auto flex max-w-xl flex-col items-center">
					<h2 class="font-serif text-3xl sm:text-[2.9rem] sm:leading-[1.04]">
						Keep your research <em>on your own machine</em>.
					</h2>
					<p class="text-primary-foreground/65 mt-4 max-w-md text-base leading-relaxed">
						Start in the browser, or get the desktop app and work fully offline.
					</p>
					<div class="mt-9 flex flex-wrap justify-center gap-3">
						<a
							href={resolve('/download')}
							onclick={() => trackEvent('cta_download_click', { location: 'footer_cta' })}
							class="bg-card text-foreground group inline-flex h-12 items-center gap-2 rounded-lg px-6 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
						>
							<IconDownload class="size-4" /> Download GlyphX
						</a>
						<a
							href={resolve('/editor')}
							class="border-primary-foreground/25 text-primary-foreground hover:bg-primary-foreground/10 inline-flex h-12 items-center gap-2 rounded-lg border px-6 text-sm font-semibold transition-colors"
						>
							Open the editor <IconArrowRight class="size-4" />
						</a>
					</div>
				</div>
			</div>
		</Reveal>
	</section>

	<SiteFooter />
</div>

<style>
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
</style>
