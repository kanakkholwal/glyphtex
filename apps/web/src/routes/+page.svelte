<script lang="ts">
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
		IconSparkles,
		IconWifiOff
	} from '@tabler/icons-svelte';

	// Hero mount shows a real product screenshot when `static/hero-editor.png`
	// exists; if it's missing, `onerror` flips this and the coded split-preview
	// fallback renders instead. Drop a screenshot at that path to go live.
	let heroImgOk = $state(true);

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

	// Recurring Overleaf frustrations, paraphrased from what people actually hit.
	// Reframed as a "Junk" folder: the cloud's interruptions as unwanted mail you
	// can't unsubscribe from. `tone` colors the severity; `tag` is the label.
	type Tone = 'red' | 'amber' | 'muted';
	type Junk = {
		from: string;
		subject: string;
		preview: string;
		tone: Tone;
		icon: typeof IconLock;
		tag: string;
		time: string;
	};
	const junk: Junk[] = [
		{
			from: 'Overleaf Billing',
			subject: 'Compile timed out.',
			preview: 'On the free plan a long chapter can stop building right when you need the PDF most.',
			tone: 'red',
			icon: IconAlertTriangle,
			tag: 'free tier',
			time: 'just now'
		},
		{
			from: 'Overleaf Premium',
			subject: 'Upgrade to keep working.',
			preview: 'More collaborators, Git, and Dropbox sync all sit behind the paid tier.',
			tone: 'amber',
			icon: IconLock,
			tag: 'paywall',
			time: '4 min'
		},
		{
			from: 'Overleaf Premium',
			subject: 'Where did my history go?',
			preview: 'Full version history is a premium feature, so a free account only sees so far back.',
			tone: 'amber',
			icon: IconLock,
			tag: 'paywall',
			time: '1 hr'
		},
		{
			from: 'The server',
			subject: 'Why is the editor lagging?',
			preview: 'Long documents get sluggish because every keystroke round trips through a server.',
			tone: 'red',
			icon: IconAlertTriangle,
			tag: 'round trip',
			time: '3 hr'
		},
		{
			from: 'Their servers',
			subject: 'Is my draft actually private?',
			preview: 'Your unpublished work lives on infrastructure you do not own or control.',
			tone: 'amber',
			icon: IconAlertTriangle,
			tag: 'privacy',
			time: 'yesterday'
		},
		{
			from: 'No connection',
			subject: 'I have no signal.',
			preview: 'No connection means no editor, even if all you wanted was to fix one line.',
			tone: 'muted',
			icon: IconWifiOff,
			tag: 'offline',
			time: 'yesterday'
		}
	];

	// Tone -> avatar tint for the junk rows.
	const toneClass: Record<Tone, string> = {
		red: 'bg-destructive/10 text-destructive',
		amber: 'bg-warning/10 text-warning',
		muted: 'bg-muted text-muted-foreground'
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
				<Reveal variant="up">
					<h1 class="font-serif mx-auto max-w-4xl text-[2.9rem] leading-[1.02] sm:text-[4.6rem]">
						The LaTeX editor<br class="hidden sm:block" /> Overleaf
						<em>should have been</em>.
					</h1>
				</Reveal>
				<Reveal variant="up" delay={250} class="flex flex-col items-center">
					<p class="text-muted-foreground mt-7 max-w-[40rem] text-lg leading-relaxed">
						Write papers, proofs, and theses in real LaTeX. The desktop app runs the editor, the
						compiler, your files, and Git on your own computer. Sync and AI connect through accounts
						you already own. Nothing has to pass through our servers.
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
					<p class="text-muted-foreground/80 mt-4 font-mono text-[11px] tracking-wider uppercase">
						free · no account · all on your machine
					</p>
				</Reveal>
			</div>

			<!-- Framed product mount: real screenshot if present, else a coded split -->
			<Reveal variant="morph" delay={140} class="relative mt-14 sm:mt-16">
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
								class="text-muted-foreground/60 mb-4 font-mono text-[11px] tracking-widest uppercase"
							>
								Live preview
							</div>
							<h3 class="font-display mb-1 text-2xl">On Local-First Typesetting</h3>
							<p class="text-muted-foreground mb-5 text-sm">A. Researcher</p>
							<p class="text-muted-foreground leading-relaxed">
								We observe that the estimator θ̂ is consistent, with α scaling as β²:
							</p>
							<div class="text-foreground my-4 text-center text-2xl italic">E = mc²</div>
							<p class="text-muted-foreground/70 text-sm">See [1].</p>
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
						<span class="text-muted-foreground/50 ml-auto tabular-nums">offline · Ln 14</span>
					</div>
				</div>
			</Reveal>
		</div>
	</section>

	<!-- Trust strip -->
	<Reveal as="section" variant="up" class="mt-16 sm:mt-20">
		<div class="border-hairline mx-auto max-w-[1140px] border-y px-5 sm:px-6">
			<div
				class="text-muted-foreground grid grid-cols-2 gap-y-4 py-6 font-mono text-xs sm:grid-cols-4"
			>
				<span class="flex items-center gap-2"
					><span class="bg-brand size-1.5 rounded-full"></span> Nothing uploaded</span
				>
				<span class="flex items-center gap-2"
					><span class="bg-brand size-1.5 rounded-full"></span> Compiles locally</span
				>
				<span class="flex items-center gap-2"
					><span class="bg-brand size-1.5 rounded-full"></span> No account</span
				>
				<span class="flex items-center gap-2"
					><span class="bg-brand size-1.5 rounded-full"></span> Free and open source</span
				>
			</div>
		</div>
	</Reveal>

	<!-- ============================================================
	     The problem
	     ============================================================ -->
	<section class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
		<div class="grid items-start gap-12 lg:grid-cols-[0.85fr_1.15fr]">
			<Reveal variant="up" class="lg:sticky lg:top-28">
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

			<!-- iOS-style notification stack: each cloud interruption drops in and
			     stacks, frosted over a soft wallpaper, with a staggered settle -->
			<div class="relative">
				<!-- soft "wallpaper" so the frosted cards have something to blur over -->
				<div
					class="pointer-events-none absolute -inset-4 -z-10 overflow-hidden rounded-[2.25rem]"
					aria-hidden="true"
				>
					<div
						class="absolute inset-0"
						style="background: radial-gradient(120% 85% at 50% 0%, var(--surface-soft), transparent 72%);"
					></div>
					<div
						class="absolute -top-10 left-1/5 size-64 rounded-full opacity-70 blur-3xl"
						style="background: radial-gradient(closest-side, var(--brand-subtle), transparent);"
					></div>
					<div
						class="absolute right-2 -bottom-10 size-56 rounded-full opacity-60 blur-3xl"
						style="background: radial-gradient(closest-side, var(--surface-2), transparent);"
					></div>
				</div>

				<div class="flex flex-col gap-2.5">
					{#each junk as m, i (m.subject)}
						{@const Icon = m.icon}
						<Reveal
							as="div"
							variant="down"
							delay={i * 95}
							class="border-hairline bg-card/70 shadow-craft-lg flex items-start gap-3 rounded-[1.4rem] border px-4 py-3.5 backdrop-blur-xl"
						>
							<span
								class="grid size-9 shrink-0 place-items-center rounded-[0.6rem] {toneClass[m.tone]}"
							>
								<Icon class="size-[18px]" />
							</span>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span
										class="text-muted-foreground font-mono text-[10px] font-semibold tracking-[0.14em] uppercase"
									>
										{m.from}
									</span>
									<span class="text-muted-foreground/45 ml-auto shrink-0 text-[11px]">{m.time}</span>
								</div>
								<p class="text-foreground mt-1 text-[15px] leading-snug font-semibold">{m.subject}</p>
								<p class="text-muted-foreground mt-0.5 text-[13px] leading-snug">{m.preview}</p>
							</div>
						</Reveal>
					{/each}

					<!-- the one notification you actually want — GlyphX -->
					<Reveal
						as="div"
						variant="down"
						delay={junk.length * 95}
						class="border-brand/20 bg-brand-subtle shadow-craft-lg flex items-start gap-3 rounded-[1.4rem] border px-4 py-3.5 backdrop-blur-xl"
					>
						<span
							class="bg-brand text-brand-foreground grid size-9 shrink-0 place-items-center rounded-[0.6rem]"
						>
							<IconCheck class="size-[18px]" />
						</span>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span
									class="text-brand font-mono text-[10px] font-semibold tracking-[0.14em] uppercase"
								>
									GlyphX
								</span>
								<span class="text-muted-foreground/45 ml-auto shrink-0 text-[11px]">now</span>
							</div>
							<p class="text-foreground mt-1 text-[15px] leading-snug font-semibold">All clear.</p>
							<p class="text-muted-foreground mt-0.5 text-[13px] leading-snug">
								No cloud, so nothing to time out, upsell, or unsubscribe from.
							</p>
						</div>
					</Reveal>
				</div>
			</div>
		</div>
	</section>

	<!-- ============================================================
	     Feature sections: an eyebrow + editorial headline, a left
	     capability list, and a framed product mount on a dark backdrop.
	     ============================================================ -->
	<div id="features">
		{#each featureSections as sec (sec.eyebrow)}
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
							<!-- body: capability list + framed mount -->
							<div class="border-hairline grid border-t lg:grid-cols-2">
								<ul class="border-hairline border-b lg:border-r lg:border-b-0">
									{#each sec.items as it, ii (it.title)}
										{@const Icon = it.icon}
										<li
											class="border-hairline relative flex gap-4 border-b p-6 last:border-b-0 sm:p-7"
										>
											{#if ii === 0}
												<span
													class="bg-brand absolute top-6 bottom-6 left-0 w-[3px] rounded-r-full"
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
								<!-- framed product mount on a dark backdrop -->
								<div
									class="bg-primary relative grid place-items-center overflow-hidden p-7 sm:p-10"
								>
									<div
										class="pointer-events-none absolute inset-0 opacity-[0.06]"
										style="background-image: radial-gradient(circle at 1px 1px, var(--primary-foreground) 1px, transparent 0); background-size: 22px 22px;"
										aria-hidden="true"
									></div>
									<div
										class="pointer-events-none absolute -inset-6 opacity-40 blur-3xl"
										style="background: radial-gradient(50% 50% at 50% 40%, var(--brand-subtle), transparent 75%);"
										aria-hidden="true"
									></div>
									<div
										class="border-hairline bg-card shadow-craft-floating relative w-full max-w-md overflow-hidden rounded-xl border"
									>
										<div class="border-hairline flex items-center gap-1.5 border-b px-3 py-2.5">
											<span class="bg-muted-foreground/30 size-2 rounded-full"></span>
											<span class="bg-muted-foreground/30 size-2 rounded-full"></span>
											<span class="bg-muted-foreground/30 size-2 rounded-full"></span>
										</div>
										{#if sec.mount === 'editor'}
											<pre
												class="text-muted-foreground overflow-hidden p-4 font-mono text-[11.5px] leading-[1.75]"><span
													class="text-brand">\documentclass</span>&#123;article&#125;
<span class="text-brand">\usepackage</span>&#123;amsmath&#125;

<span class="text-brand">\begin</span>&#123;equation&#125;
  E = m c^2
<span class="text-brand">\end</span>&#123;equation&#125;</pre>
											<div
												class="border-hairline flex items-center gap-2 border-t px-4 py-2.5 font-mono text-[11px]"
											>
												<span class="text-brand flex items-center gap-1.5">
													<IconCheck class="size-3.5" /> compiled in 0.41s
												</span>
												<span class="text-muted-foreground/60 ml-auto">offline</span>
											</div>
										{:else}
											<div class="flex flex-col gap-2 p-4 font-mono text-[11.5px]">
												<div class="text-muted-foreground flex items-center gap-2">
													<IconGitBranch class="text-brand size-3.5" /> main · 2 changes
												</div>
												<div class="text-muted-foreground flex items-center gap-2">
													<span class="text-warning">M</span> chapter3.tex
												</div>
												<div class="text-muted-foreground flex items-center gap-2">
													<span class="text-success">A</span> figures/plot.pdf
												</div>
											</div>
											<div class="border-hairline flex items-center border-t px-4 py-2.5">
												<span
													class="bg-brand text-brand-foreground rounded-md px-3 py-1 font-mono text-[11px] font-semibold"
												>
													Commit
												</span>
												<span class="text-muted-foreground/60 ml-auto font-mono text-[11px]">
													your remote
												</span>
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
								{sec.cta} <IconArrowRight class="size-4" />
							</a>
						</div>
					</Reveal>
				</div>
			</section>
		{/each}
	</div>

	<!-- ============================================================
	     "Works with" grid (autosend integrations pattern)
	     ============================================================ -->
	<section class="border-hairline border-t">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up">
				<div
					class="border-hairline grid overflow-hidden rounded-2xl border lg:grid-cols-[0.85fr_1.15fr]"
				>
					<div
						class="border-hairline flex flex-col justify-between gap-10 border-b p-8 sm:p-10 lg:border-r lg:border-b-0"
					>
						<span
							class="text-brand font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
						>
							Works with real LaTeX
						</span>
						<h2 class="font-serif text-3xl sm:text-4xl sm:leading-[1.08]">
							The LaTeX you <em>already use</em>.
						</h2>
					</div>
					<div class="bg-hairline grid gap-px sm:grid-cols-3">
						{#each integrations as it (it.label)}
							{@const Icon = it.icon}
							<div class="bg-card flex flex-col gap-3 p-6">
								<Icon class="text-foreground size-5" />
								<div>
									<div
										class="text-foreground font-mono text-xs font-semibold tracking-wider uppercase"
									>
										{it.label}
									</div>
									<div
										class="text-muted-foreground/70 mt-1 font-mono text-[10px] tracking-wide uppercase"
									>
										{it.note}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</Reveal>
		</div>
	</section>

	<!-- ============================================================
	     Where your data goes: local core vs. your accounts
	     ============================================================ -->
	<section class="border-hairline border-t">
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

			<div class="mt-12 grid gap-4 lg:grid-cols-2">
				<!-- Stays local -->
				<Reveal variant="up" class="border-hairline bg-card flex flex-col rounded-2xl border p-7">
					<div class="mb-6 flex items-center gap-2">
						<span class="bg-brand size-1.5 rounded-full"></span>
						<span
							class="text-foreground font-mono text-[11px] font-semibold tracking-[0.16em] uppercase"
							>On your machine</span
						>
					</div>
					<div class="flex flex-col gap-5">
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
				</Reveal>

				<!-- Through your accounts -->
				<Reveal
					variant="up"
					delay={90}
					class="border-hairline bg-card/60 flex flex-col rounded-2xl border p-7"
				>
					<div class="mb-6 flex items-center gap-2">
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
											class="border-hairline text-muted-foreground rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider uppercase"
											>{m.tag}</span
										>
									</div>
									<p class="text-muted-foreground mt-0.5 text-sm leading-relaxed">{m.body}</p>
								</div>
							</div>
						{/each}
					</div>
				</Reveal>
			</div>

			<Reveal variant="up" delay={120}>
				<div
					class="border-hairline bg-brand-subtle mt-4 flex items-start gap-3 rounded-2xl border p-6"
				>
					<IconLock class="text-brand mt-0.5 size-5 shrink-0" />
					<p class="text-foreground/90 text-base leading-relaxed">
						We only ever hold what you choose to share, tied to your personal account. Click share
						and a project goes out under your name. Never click it, and your work never leaves your
						machine.
					</p>
				</div>
			</Reveal>
		</div>
	</section>

	<!-- ============================================================
	     Comparison
	     ============================================================ -->
	<section id="compare" class="border-hairline border-t">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up">
				<span
					class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
				>
					Compare
				</span>
				<h2 class="font-serif mt-5 max-w-2xl text-3xl sm:text-4xl">
					Private like your laptop. <em>Easy like the cloud was supposed to be.</em>
				</h2>
			</Reveal>

			<Reveal variant="up" delay={80} class="mt-10">
				<div class="border-hairline overflow-x-auto rounded-2xl border">
					<div class="grid min-w-[640px] grid-cols-[1.8fr_1fr_1fr_1fr] text-sm">
						<div
							class="text-muted-foreground bg-card px-5 py-4 font-mono text-[11px] tracking-widest uppercase"
						>
							&nbsp;
						</div>
						<div class="bg-card text-foreground px-3 py-4 text-center font-semibold">GlyphX</div>
						<div class="bg-card text-muted-foreground px-3 py-4 text-center font-medium">
							Overleaf free
						</div>
						<div class="bg-card text-muted-foreground px-3 py-4 text-center font-medium">
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
				<p class="text-muted-foreground/70 mt-3 font-mono text-[11px]">
					Overleaf paid tiers lift some of these limits. The point is that GlyphX does not put them
					there to begin with.
				</p>
			</Reveal>
		</div>
	</section>

	<!-- ============================================================
	     How it works
	     ============================================================ -->
	<section class="border-hairline border-t">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up">
				<span
					class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
				>
					How it works
				</span>
				<h2 class="font-serif mt-5 max-w-2xl text-3xl sm:text-4xl">
					Three steps, <em>none of which involve a login</em>.
				</h2>
			</Reveal>

			<div
				class="bg-hairline border-hairline mt-12 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-3"
			>
				{#each steps as s, i (s.n)}
					<Reveal as="article" variant="up" delay={i * 80} class="bg-card flex flex-col p-7">
						<span class="text-brand font-mono text-sm font-semibold">{s.n}</span>
						<h3 class="mt-4 text-base font-semibold">{s.title}</h3>
						<p class="text-muted-foreground mt-2 text-sm leading-relaxed">{s.body}</p>
					</Reveal>
				{/each}
			</div>
		</div>
	</section>

	<!-- ============================================================
	     Roadmap note (honest about what is not built yet)
	     ============================================================ -->
	<section class="border-hairline border-t">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal
				variant="up"
				class="border-hairline bg-card flex flex-col gap-4 rounded-2xl border p-8 sm:flex-row sm:items-start sm:gap-6 sm:p-10"
			>
				<span
					class="border-hairline bg-canvas text-foreground grid size-11 shrink-0 place-items-center rounded-xl border"
				>
					<IconSparkles class="size-5" />
				</span>
				<div class="max-w-2xl">
					<h2 class="font-display text-2xl tracking-tight sm:text-3xl">Still to come.</h2>
					<p class="text-muted-foreground mt-3 text-base leading-relaxed">
						A bring-your-own AI key, Dropbox and Google Drive sync, and project sharing are the next
						things we are building. They are not in the app yet, and we would rather say so than
						pretend otherwise. The rule behind all of them stays the same: your providers, your
						keys, your data.
					</p>
					<div class="mt-5 flex flex-wrap gap-2">
						{#each [{ icon: IconKey, label: 'Your AI key' }, { icon: IconBrandDropbox, label: 'Cloud sync' }, { icon: IconShare, label: 'Sharing' }] as r (r.label)}
							{@const Icon = r.icon}
							<span
								class="border-hairline text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-medium"
							>
								<Icon class="size-3.5" />
								{r.label}
								<span class="text-muted-foreground/50">· planned</span>
							</span>
						{/each}
					</div>
				</div>
			</Reveal>
		</div>
	</section>

	<!-- ============================================================
	     FAQ
	     ============================================================ -->
	<section id="faq" class="border-hairline border-t">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<div class="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
				<Reveal variant="up">
					<span
						class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
					>
						FAQ
					</span>
					<h2 class="font-serif mt-5 max-w-sm text-3xl sm:text-4xl">
						The questions people ask first.
					</h2>
				</Reveal>

				<div class="flex flex-col">
					{#each faqs as f, i (f.q)}
						<Reveal
							as="div"
							variant="up"
							delay={i * 40}
							class="border-hairline border-t py-6 first:border-t-0 first:pt-0"
						>
							<h3 class="text-foreground text-base font-semibold">{f.q}</h3>
							<p class="text-muted-foreground mt-2 text-sm leading-relaxed">{f.a}</p>
						</Reveal>
					{/each}
				</div>
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
						Start in the browser for free, or get the desktop app and work fully offline. No
						account, no upload, no waiting on a server.
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
