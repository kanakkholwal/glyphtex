<script lang="ts">
	// Marketing landing — near-monochrome (keyfold-mirrored), written for the
	// people who actually write LaTeX: researchers, PhD students, mathematicians.
	// No engine jargon — value and outcomes. Colour is rationed to the single
	// emerald signal; motion is the shared "settle into place" curve (Reveal).
	import { Logo } from '@glyph/ui/logo';
	import { Reveal } from '@glyph/ui/reveal';
	import { ThemeToggle } from '@glyph/ui/theme-toggle';
	import {
		IconLock,
		IconWifiOff,
		IconBolt,
		IconSparkles,
		IconFileText,
		IconWorld,
		IconDeviceDesktop,
		IconArrowRight,
		IconCheck,
		IconMinus,
		IconDownload
	} from '@tabler/icons-svelte';

	const features = [
		{
			icon: IconLock,
			title: 'Nothing leaves your device',
			body: 'Unpublished papers, grant proposals, your thesis — none of it is uploaded, synced, or used to train anything. Ever.'
		},
		{
			icon: IconWifiOff,
			title: 'Works anywhere, offline',
			body: 'On a flight, at a remote field site, behind a campus firewall — your document still opens, edits, and renders with no connection at all.'
		},
		{
			icon: IconBolt,
			title: 'No setup, no install',
			body: 'Skip the multi-gigabyte TeX distribution and the cryptic package errors. Open Glyph and start writing in seconds.'
		},
		{
			icon: IconFileText,
			title: 'Journal-ready output',
			body: 'Real LaTeX — full math, figures, and BibTeX citations. The exact output your journal template or university thesis spec expects.'
		},
		{
			icon: IconSparkles,
			title: 'A hand when you get stuck',
			body: "Turn a sentence into an equation, or ask what an error actually means — in plain language. Opt-in, and silent until you ask."
		},
		{
			icon: IconWorld,
			title: 'Free in your browser',
			body: 'A complete editor in the browser — free, no account. Prefer an app on your desktop? A native build is on the way.'
		}
	] as const;

	const comparison = [
		{ label: 'Nothing uploaded to the cloud', glyph: true, overleaf: false, desktop: true },
		{ label: 'Works fully offline', glyph: true, overleaf: false, desktop: true },
		{ label: 'No install or setup', glyph: true, overleaf: true, desktop: false },
		{ label: 'Real LaTeX, journal-ready', glyph: true, overleaf: true, desktop: true },
		{ label: 'Free, no account', glyph: true, overleaf: 'Limited', desktop: true },
		{ label: 'AI help when you get stuck', glyph: 'Opt-in', overleaf: 'Paid', desktop: false }
	] as const;
</script>

<svelte:head>
	<title>Glyph — the private LaTeX editor that never leaves your machine</title>
	<meta
		name="description"
		content="Glyph is a local-first LaTeX editor for researchers, PhD students, and mathematicians. Write papers and theses in real LaTeX — fully offline, with nothing uploaded. Free in your browser, plus a native desktop app."
	/>
</svelte:head>

<div class="bg-canvas text-foreground min-h-dvh">
	<!-- Nav -->
	<header class="border-hairline bg-canvas/80 sticky top-0 z-40 border-b backdrop-blur-xl">
		<div class="mx-auto flex h-16 max-w-[1140px] items-center gap-6 px-5 sm:px-6">
			<Logo href="/" size={28} class="text-lg tracking-tight" />
			<nav class="text-muted-foreground ml-3 hidden items-center gap-6 text-sm font-medium md:flex">
				<a class="hover:text-foreground transition-colors" href="#features">Features</a>
				<a class="hover:text-foreground transition-colors" href="#compare">Compare</a>
				<a class="hover:text-foreground transition-colors" href="#download">Download</a>
			</nav>
			<div class="ml-auto flex items-center gap-1.5 sm:gap-2.5">
				<ThemeToggle />
				<a
					href="/editor"
					class="text-foreground hover:bg-muted hidden h-9 items-center rounded-lg px-3.5 text-sm font-semibold transition-colors sm:inline-flex"
					>Open editor</a
				>
				<a
					href="#download"
					class="bg-primary text-primary-foreground inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90"
					>Download</a
				>
			</div>
		</div>
	</header>

	<!-- Hero -->
	<section class="mx-auto max-w-[1140px] px-5 sm:px-6">
		<div class="grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
			<Reveal variant="up" class="flex flex-col items-start">
				<span
					class="border-hairline bg-card text-muted-foreground mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-medium tracking-[0.12em] uppercase"
				>
					<span class="bg-brand size-1.5 animate-pulse rounded-full"></span>
					Private LaTeX editor
				</span>
				<h1 class="font-display text-[2.6rem] leading-[1.04] tracking-[-0.035em] sm:text-6xl">
					LaTeX that never<br class="hidden sm:block" /> leaves your laptop.
				</h1>
				<p class="text-muted-foreground mt-6 max-w-[34rem] text-lg leading-relaxed">
					Write papers, proofs, and theses in real LaTeX — fully offline, with nothing
					uploaded to anyone's servers. Your unpublished work stays yours.
				</p>
				<div class="mt-9 flex flex-wrap items-center gap-3">
					<a
						href="#download"
						class="bg-primary text-primary-foreground inline-flex h-12 items-center gap-2 rounded-lg px-6 text-sm font-semibold transition-all hover:opacity-90"
					>
						<IconDownload class="size-4" /> Download for desktop
					</a>
					<a
						href="/editor"
						class="border-hairline bg-card text-foreground hover:bg-muted group inline-flex h-12 items-center gap-2 rounded-lg border px-6 text-sm font-semibold transition-colors"
					>
						Start writing in your browser
						<IconArrowRight class="size-4 transition-transform group-hover:translate-x-0.5" />
					</a>
				</div>
				<p class="text-muted-foreground/80 mt-4 font-mono text-xs">
					free · no account · nothing leaves your device
				</p>
			</Reveal>

			<!-- Editor artifact -->
			<Reveal variant="morph" delay={120}>
				<div class="border-hairline bg-card shadow-craft-floating overflow-hidden rounded-2xl border">
					<div class="border-hairline flex h-10 items-center gap-2 border-b px-4">
						<span class="bg-muted-foreground/30 size-2.5 rounded-full"></span>
						<span class="bg-muted-foreground/30 size-2.5 rounded-full"></span>
						<span class="bg-muted-foreground/30 size-2.5 rounded-full"></span>
						<span class="text-muted-foreground ml-2 font-mono text-xs">thesis.tex</span>
						<span
							class="text-brand border-brand/30 bg-brand-subtle ml-auto rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase"
							>LaTeX</span
						>
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-2">
						<pre class="text-muted-foreground overflow-hidden p-4 font-mono text-[11.5px] leading-relaxed"><span class="text-brand">\section</span>&#123;Results&#125;

We observe that the estimator
<span class="text-foreground">$\hat&#123;\theta&#125;$</span> is consistent,
with <span class="text-foreground">$\alpha$</span> scaling as <span class="text-foreground">$\beta^2$</span>:

<span class="text-brand">\begin</span>&#123;equation&#125;
  E = m c^2
<span class="text-brand">\end</span>&#123;equation&#125;

See <span class="text-brand">\cite</span>&#123;einstein1905&#125;.<span class="text-brand inline-block h-[1em] w-[2px] translate-y-[2px] align-middle [animation:blink_1.05s_steps(1)_infinite]"></span>
</pre>
						<div class="border-hairline bg-canvas/60 border-t p-5 sm:border-t-0 sm:border-l">
							<div class="text-foreground mb-2 text-lg font-semibold">Results</div>
							<p class="text-muted-foreground text-sm leading-relaxed">
								We observe that the estimator θ̂ is consistent, with α scaling as β²:
							</p>
							<div class="text-foreground mt-3 text-center text-xl italic">E = mc²</div>
							<p class="text-muted-foreground/70 mt-3 text-xs">See [1].</p>
						</div>
					</div>
					<div
						class="border-hairline text-muted-foreground flex items-center gap-3 border-t px-4 py-2 font-mono text-[11px]"
					>
						<span class="text-brand flex items-center gap-1.5">
							<span class="bg-brand size-1.5 rounded-full"></span> compiled
						</span>
						<span>on your device</span>
						<span class="ml-auto">offline</span>
					</div>
				</div>
			</Reveal>
		</div>
	</section>

	<!-- Trust strip -->
	<Reveal as="section" variant="up">
		<div class="border-hairline mx-auto max-w-[1140px] border-y px-5 sm:px-6">
			<div class="text-muted-foreground grid grid-cols-2 gap-y-4 py-6 font-mono text-xs sm:grid-cols-4">
				<span class="flex items-center gap-2"><span class="bg-brand size-1.5 rounded-full"></span> Nothing uploaded</span>
				<span class="flex items-center gap-2"><span class="bg-brand size-1.5 rounded-full"></span> Fully offline</span>
				<span class="flex items-center gap-2"><span class="bg-brand size-1.5 rounded-full"></span> No setup</span>
				<span class="flex items-center gap-2"><span class="bg-brand size-1.5 rounded-full"></span> Free &amp; open source</span>
			</div>
		</div>
	</Reveal>

	<!-- Features -->
	<section id="features" class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
		<Reveal variant="up">
			<span class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase">
				<span class="bg-brand size-1.5 rounded-full"></span> Why Glyph
			</span>
			<h2 class="font-display mt-5 max-w-2xl text-3xl tracking-tight sm:text-4xl">
				Built for people who write LaTeX, not code.
			</h2>
		</Reveal>

		<div class="bg-hairline border-hairline mt-12 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-3">
			{#each features as f, i (f.title)}
				{@const Icon = f.icon}
				<Reveal
					as="article"
					variant="up"
					delay={i * 60}
					class="bg-card group flex flex-col p-7 transition-colors hover:bg-muted/50"
				>
					<span
						class="border-hairline bg-canvas text-foreground group-hover:text-brand mb-5 grid size-10 place-items-center rounded-lg border transition-colors"
					>
						<Icon class="size-5" />
					</span>
					<h3 class="text-base font-semibold">{f.title}</h3>
					<p class="text-muted-foreground mt-2 text-sm leading-relaxed">{f.body}</p>
				</Reveal>
			{/each}
		</div>
	</section>

	<!-- Editor showcase -->
	<section class="border-hairline border-t">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up" class="mx-auto max-w-2xl text-center">
				<span class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase">
					<span class="bg-brand size-1.5 rounded-full"></span> The editor
				</span>
				<h2 class="font-display mt-5 text-3xl tracking-tight sm:text-4xl">
					Everything you need to finish the paper.
				</h2>
				<p class="text-muted-foreground mt-4 text-lg leading-relaxed">
					A focused editor and a live preview, side by side. Your equations, figures, and
					citations — and nothing competing for your attention.
				</p>
			</Reveal>

			<Reveal variant="blur" delay={100} class="mt-12">
				<div class="border-hairline bg-card shadow-craft-lg overflow-hidden rounded-2xl border">
					<div class="border-hairline flex h-11 items-center gap-3 border-b px-4">
						<span class="bg-primary text-primary-foreground grid size-6 place-items-center rounded-md text-[13px] font-bold">G</span>
						<span class="text-muted-foreground/70 font-mono text-xs">thesis.tex</span>
						<span class="border-hairline text-muted-foreground ml-auto rounded-md border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase">LaTeX</span>
					</div>
					<div class="grid grid-cols-1 lg:grid-cols-2">
						<pre class="text-muted-foreground border-hairline overflow-hidden border-b p-6 font-mono text-xs leading-[1.8] lg:border-b-0 lg:border-r"><span class="text-brand">\documentclass</span>&#123;article&#125;
<span class="text-brand">\usepackage</span>&#123;amsmath&#125;

<span class="text-brand">\title</span>&#123;On Local-First Typesetting&#125;
<span class="text-brand">\author</span>&#123;A. Researcher&#125;

<span class="text-brand">\begin</span>&#123;document&#125;
<span class="text-brand">\maketitle</span>

A consistent estimator satisfies

<span class="text-brand">\begin</span>&#123;equation&#125;
  \hat&#123;\theta&#125; \to \theta
<span class="text-brand">\end</span>&#123;equation&#125;

as the sample grows, see <span class="text-brand">\cite</span>&#123;ref&#125;.

<span class="text-brand">\end</span>&#123;document&#125;</pre>
						<div class="bg-canvas/50 p-8">
							<div class="text-muted-foreground/60 mb-4 font-mono text-[11px] tracking-widest uppercase">Live preview</div>
							<h3 class="font-display mb-1 text-2xl">On Local-First Typesetting</h3>
							<p class="text-muted-foreground mb-5 text-sm">A. Researcher</p>
							<p class="text-muted-foreground leading-relaxed">A consistent estimator satisfies</p>
							<div class="text-foreground my-4 text-center text-2xl italic">θ̂ → θ</div>
							<p class="text-muted-foreground leading-relaxed">as the sample grows, see [1].</p>
						</div>
					</div>
					<div class="border-hairline text-muted-foreground flex h-8 items-center gap-4 border-t px-4 font-mono text-[11px]">
						<span class="text-brand flex items-center gap-1.5"><span class="bg-brand size-1.5 rounded-full"></span> Offline-ready</span>
						<span>auto-saved on your device</span>
						<span class="text-muted-foreground/50 ml-auto tabular-nums">Ln 14 · 312 chars</span>
					</div>
				</div>
			</Reveal>
		</div>
	</section>

	<!-- Comparison -->
	<section id="compare" class="border-hairline border-t">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up">
				<span class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase">
					<span class="bg-brand size-1.5 rounded-full"></span> Compare
				</span>
				<h2 class="font-display mt-5 max-w-2xl text-3xl tracking-tight sm:text-4xl">
					Private like your laptop. Simple like the cloud.
				</h2>
			</Reveal>

			<Reveal variant="up" delay={80} class="mt-10">
				<div class="border-hairline overflow-hidden rounded-2xl border">
					<div class="grid grid-cols-[1.8fr_1fr_1fr_1fr] text-sm">
						<div class="text-muted-foreground bg-card px-5 py-4 font-mono text-[11px] tracking-widest uppercase">&nbsp;</div>
						<div class="bg-card text-foreground px-3 py-4 text-center font-semibold">Glyph</div>
						<div class="bg-card text-muted-foreground px-3 py-4 text-center font-medium">Overleaf</div>
						<div class="bg-card text-muted-foreground px-3 py-4 text-center font-medium">Desktop&nbsp;TeX</div>

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
			</Reveal>
		</div>
	</section>

	<!-- CTA band -->
	<section id="download" class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-24">
		<Reveal variant="scale">
			<div class="bg-primary text-primary-foreground relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16 sm:py-20">
				<div class="mx-auto flex max-w-xl flex-col items-center">
					<IconDeviceDesktop class="text-primary-foreground/70 mb-6 size-8" />
					<h2 class="font-display text-3xl tracking-tight sm:text-[2.75rem] sm:leading-[1.05]">
						Your research stays yours.
					</h2>
					<p class="text-primary-foreground/65 mt-4 max-w-md text-base leading-relaxed">
						Start writing in your browser — free, no account — or get the desktop app for
						fully offline work.
					</p>
					<div class="mt-9 flex flex-wrap justify-center gap-3">
						<a
							href="/editor"
							class="bg-card text-foreground inline-flex h-12 items-center gap-2 rounded-lg px-6 text-sm font-semibold transition-all hover:opacity-90"
						>
							Open the editor <IconArrowRight class="size-4" />
						</a>
						<span
							class="border-primary-foreground/25 text-primary-foreground/90 inline-flex h-12 items-center rounded-lg border px-6 font-mono text-xs tracking-wide"
							>desktop app · coming soon</span
						>
					</div>
				</div>
			</div>
		</Reveal>
	</section>

	<!-- Footer -->
	<footer class="border-hairline border-t">
		<div class="text-muted-foreground mx-auto flex max-w-[1140px] flex-col items-center justify-between gap-4 px-5 py-10 text-sm sm:flex-row sm:px-6">
			<Logo size="md" class="text-foreground" />
			<p class="font-mono text-xs">local-first typesetting · your documents stay yours</p>
		</div>
	</footer>
</div>

<style>
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
</style>
