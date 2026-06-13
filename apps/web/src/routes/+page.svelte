<script lang="ts">
	import { resolve } from '$app/paths';
	import { Reveal } from '@glyphx/ui/reveal';
	import SiteHeader from '$lib/SiteHeader.svelte';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import FloatingGlyphs from '$lib/FloatingGlyphs.svelte';
	import {
		IconArrowRight,
		IconCheck,
		IconMinus,
		IconLock,
		IconWifiOff,
		IconBolt,
		IconFolder,
		IconFileText,
		IconBrandGithub,
		IconDownload,
		IconPlayerPlay,
		IconCpu,
		IconCloud,
		IconKey,
		IconSparkles,
		IconGitBranch,
		IconBrandDropbox,
		IconBrandGoogleDrive,
		IconShare
	} from '@tabler/icons-svelte';

	const features = [
		{
			icon: IconFileText,
			title: 'Real LaTeX, not a lookalike',
			body: 'Full math, figures, BibTeX, and the packages your journal template leans on. The PDF you get is the PDF your reviewer gets.'
		},
		{
			icon: IconBolt,
			title: 'Compiles on your machine',
			body: 'No shared queue, no server, no "compile timed out" the night before a deadline. The renderer runs locally and keeps up while you type.'
		},
		{
			icon: IconFolder,
			title: 'Your folder is the project',
			body: 'A project is a directory on disk. Open it, edit it, drag files between folders, and back it up the way you already back up files.'
		},
		{
			icon: IconLock,
			title: 'Private by default',
			body: 'Unpublished results, grant drafts, a thesis under embargo. None of it is uploaded, indexed, or fed to a model. It sits on your disk and nowhere else.'
		},
		{
			icon: IconWifiOff,
			title: 'Works with the wifi off',
			body: 'On a flight, in a basement lab, on a train with no signal. The editor and the live preview do not wait on a connection.'
		},
		{
			icon: IconBrandGithub,
			title: 'Free, and the source is open',
			body: 'The browser editor is free with no account. The desktop app is free too. You can read every line of it on GitHub.'
		}
	] as const;

	// Recurring Overleaf pain points, paraphrased from what people actually run
	// into (compile timeouts on the free tier, premium-gated history and Git,
	// lag on long files, the always-online model). Honest, not a pile-on.
	const painPoints = [
		{
			quote: 'Compile timed out.',
			body: 'On the free plan a long chapter can stop building right when you need the PDF most.'
		},
		{
			quote: 'Upgrade to keep working together.',
			body: 'More collaborators, Git, and Dropbox sync all sit behind the paid tier.'
		},
		{
			quote: 'Where did my history go?',
			body: 'Full version history is a premium feature, so a free account only sees so far back.'
		},
		{
			quote: 'Why is the editor lagging?',
			body: 'Long documents get sluggish because every keystroke is round tripping through a server.'
		},
		{
			quote: 'Is my draft actually private?',
			body: 'Your unpublished work lives on infrastructure you do not own or control.'
		},
		{
			quote: 'I have no signal.',
			body: 'No connection means no editor, even if all you wanted was to fix one line.'
		}
	];

	// How the local + cloud split works: heavy/private work local, the cloud
	// reached through the user's own accounts.
	const model = [
		{
			icon: IconCpu,
			title: 'Compiling stays on your machine',
			body: 'The LaTeX engine runs on your computer. No shared queue, no build sitting on our servers, nothing to time out.'
		},
		{
			icon: IconCloud,
			title: 'Sync through your own cloud',
			body: 'Connect the storage you already use. Your files move through your GitHub, Dropbox, or Drive, never through us.'
		},
		{
			icon: IconKey,
			title: 'Your AI, your key',
			body: 'Bring an API key from the provider you trust. Requests go straight from the app to them, and we never sit in the middle.'
		}
	] as const;

	// The integration roadmap. Honest about being the plan, not shipped yet.
	const integrations = [
		{
			icon: IconSparkles,
			title: 'Bring your own AI provider',
			body: 'Use an OpenAI-compatible key from OpenAI, Gemini, DeepSeek, or whoever you prefer. Rephrase a paragraph, draft an equation, or decode a compiler error, all on your own account and billing.',
			tag: 'Planned'
		},
		{
			icon: IconGitBranch,
			title: 'Git and GitHub, built in',
			body: 'Commit as you write and push to your own repository. Real history, branches, and diffs, without versioning sitting behind a paywall.',
			tag: 'Planned'
		},
		{
			icon: IconBrandDropbox,
			title: 'Dropbox and Google Drive sync',
			body: 'Keep a project in the cloud storage you already pay for and pick it back up on another machine. You pick the provider, you hold the account.',
			tag: 'Planned'
		},
		{
			icon: IconShare,
			title: 'Share on your terms',
			body: 'Hand a project to a collaborator from the desktop app. We store only what you actively share, only while it is shared, and only under your personal account.',
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
		{ label: 'Version history without paying', glyph: 'Your VCS', overleaf: 'Paid', desktop: 'Your VCS' },
		{ label: 'Git without a subscription', glyph: true, overleaf: 'Paid', desktop: true },
		{ label: 'AI help with your own key', glyph: 'Planned', overleaf: 'Paid', desktop: false },
		{ label: 'Sync through your own cloud', glyph: 'Planned', overleaf: 'Dropbox, paid', desktop: 'Your cloud' },
		{ label: 'Free, no account', glyph: true, overleaf: 'Limited', desktop: true }
	];

	const steps = [
		{
			n: '01',
			title: 'Open a folder, or start a blank one',
			body: 'Point GlyphX at an existing project directory or create a new document. There is no upload step and no project size to worry about.'
		},
		{
			n: '02',
			title: 'Write LaTeX with the preview beside you',
			body: 'Type in real LaTeX and watch the page update next to it. Math, figures, and citations render as you go.'
		},
		{
			n: '03',
			title: 'Export the PDF your journal expects',
			body: 'Compile to a clean PDF that matches your template or thesis spec, ready to submit. The file lands in your folder.'
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
			q: 'Does it use AI, and where does my data go?',
			a: 'AI help is opt-in and brings your own key. You connect a provider such as OpenAI, Gemini, or DeepSeek, and requests go from the app straight to them on your own account. We are not in the path, and there is no shared model trained on your writing.'
		},
		{
			q: 'If everything is local, how do sharing and sync work?',
			a: 'Through accounts you already have. Connect GitHub, Dropbox, or Google Drive and your files sync through those. If you share a project with someone, we store only that project, only while it is shared, and only under your personal account.'
		},
		{
			q: 'What does it cost?',
			a: 'The browser editor is free with no account. The desktop app is free as well. The source is on GitHub if you want to read it or build it yourself.'
		},
		{
			q: 'Does it really work offline?',
			a: 'Yes. The editor and the renderer both run on your machine, so a flaky connection or no connection at all does not stop you.'
		}
	];

	const repo = 'https://github.com/kanakkholwal/glyph';
</script>

<svelte:head>
	<title>GlyphX: the LaTeX editor Overleaf should have been</title>
	<meta
		name="description"
		content="GlyphX is a local-first LaTeX editor for researchers, PhD students, and mathematicians. Write papers and theses in real LaTeX, compile on your own machine, and keep your drafts off other people's servers. Free in your browser, plus a native desktop app."
	/>
</svelte:head>

<div class="bg-canvas text-foreground min-h-dvh">
	<SiteHeader />

	<!-- Hero -->
	<section class="relative">
		<FloatingGlyphs />
		<!-- soft brand glow behind the headline -->
		<div
			class="pointer-events-none absolute top-[-10%] left-1/2 -z-0 h-[420px] w-[720px] max-w-[90vw] -translate-x-1/2 rounded-full opacity-60 blur-[120px]"
			style="background: radial-gradient(closest-side, var(--brand-subtle), transparent);"
			aria-hidden="true"
		></div>

		<div class="relative mx-auto max-w-[1140px] px-5 sm:px-6">
			<div class="grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
				<Reveal variant="up" class="flex flex-col items-start">
					<span
						class="border-hairline bg-card text-muted-foreground mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-medium tracking-[0.12em] uppercase"
					>
						<span class="bg-brand size-1.5 animate-pulse rounded-full"></span>
						LaTeX, on your machine
					</span>
					<h1 class="font-display text-[2.6rem] leading-[1.03] tracking-[-0.035em] sm:text-6xl">
						The LaTeX editor<br class="hidden sm:block" /> Overleaf should have been.
					</h1>
					<p class="text-muted-foreground mt-6 max-w-[34rem] text-lg leading-relaxed">
						Write papers, proofs, and theses in real LaTeX. Get the desktop app and everything runs on
						your computer: the compiler, your files, and the sync, Git, and AI you connect through
						your own accounts. Nothing has to pass through our servers.
					</p>
					<div class="mt-9 flex flex-wrap items-center gap-3">
						<a
							href={resolve('/download')}
							class="bg-primary text-primary-foreground group inline-flex h-12 items-center gap-2 rounded-lg px-6 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
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
					<p class="text-muted-foreground/80 mt-4 font-mono text-xs">
						free · no account · the desktop app keeps it all on your machine
					</p>
				</Reveal>

				<!-- Editor artifact -->
				<Reveal variant="morph" delay={120}>
					<div
						class="border-hairline bg-card shadow-craft-floating overflow-hidden rounded-2xl border transition-transform duration-500 hover:-translate-y-1"
					>
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
							<pre
								class="text-muted-foreground overflow-hidden p-4 font-mono text-[11.5px] leading-relaxed"><span
									class="text-brand">\section</span
								>&#123;Results&#125;

We observe that the estimator
<span class="text-foreground">$\hat&#123;\theta&#125;$</span> is consistent,
with <span class="text-foreground">$\alpha$</span> scaling as <span class="text-foreground"
									>$\beta^2$</span
								>:

<span class="text-brand">\begin</span>&#123;equation&#125;
  E = m c^2
<span class="text-brand">\end</span>&#123;equation&#125;

See <span class="text-brand">\cite</span>&#123;einstein1905&#125;.<span
									class="text-brand inline-block h-[1em] w-[2px] translate-y-[2px] align-middle [animation:blink_1.05s_steps(1)_infinite]"
								></span>
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
		</div>
	</section>

	<!-- Trust strip -->
	<Reveal as="section" variant="up">
		<div class="border-hairline mx-auto max-w-[1140px] border-y px-5 sm:px-6">
			<div class="text-muted-foreground grid grid-cols-2 gap-y-4 py-6 font-mono text-xs sm:grid-cols-4">
				<span class="flex items-center gap-2"
					><span class="bg-brand size-1.5 rounded-full"></span> Nothing uploaded</span
				>
				<span class="flex items-center gap-2"
					><span class="bg-brand size-1.5 rounded-full"></span> Compiles offline</span
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

	<!-- Why we built it -->
	<section id="why" class="border-hairline border-b">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<div class="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
				<Reveal variant="up">
					<span
						class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
					>
						<span class="bg-brand size-1.5 rounded-full"></span> Why we built it
					</span>
					<h2 class="font-display mt-5 max-w-md text-3xl leading-[1.1] tracking-tight sm:text-[2.5rem]">
						Overleaf got a lot of people writing LaTeX. Then it started getting in the way.
					</h2>
				</Reveal>

				<Reveal variant="up" delay={80} class="text-muted-foreground flex flex-col gap-5 text-base leading-relaxed">
					<p>
						Overleaf did something genuinely useful. It took LaTeX, which used to mean a huge install
						and a wall of package errors, and put it one click away in a browser. Plenty of people
						wrote their first paper because of it, and that is worth saying out loud.
					</p>
					<p>
						The browser was also the catch. Your project lives on their servers. On a busy day the
						editor lags on a long chapter. Let a build run too long on the free plan and you get a
						timeout instead of a PDF. Want Git, a few more collaborators, or your full history back,
						and you are reading a pricing page. None of that has much to do with writing LaTeX. It has
						to do with running someone else's cloud.
					</p>
					<p>
						GlyphX starts from the other end. The editor and the compiler run on your computer.
						Opening a project means reading a folder. Saving means writing a file. There is no server
						in the loop, so there is nothing to time out, nothing to subscribe to, and nothing of
						yours sitting on a machine you cannot see.
					</p>
					<blockquote
						class="border-brand text-foreground mt-2 border-l-2 pl-5 text-lg font-medium italic"
					>
						We wanted the thing Overleaf looked like it was going to be, before the pricing page showed
						up.
					</blockquote>
				</Reveal>
			</div>
		</div>
	</section>

	<!-- Features -->
	<section id="features" class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
		<Reveal variant="up">
			<span
				class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
			>
				<span class="bg-brand size-1.5 rounded-full"></span> What you get
			</span>
			<h2 class="font-display mt-5 max-w-2xl text-3xl tracking-tight sm:text-4xl">
				Built for the people who write the LaTeX, not the people who run the servers.
			</h2>
		</Reveal>

		<div
			class="bg-hairline border-hairline mt-12 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-3"
		>
			{#each features as f, i (f.title)}
				{@const Icon = f.icon}
				<Reveal
					as="article"
					variant="up"
					delay={i * 60}
					class="bg-card group flex flex-col p-7 transition-colors hover:bg-muted/50"
				>
					<span
						class="border-hairline bg-canvas text-foreground group-hover:text-brand group-hover:border-brand/30 mb-5 grid size-10 place-items-center rounded-lg border transition-colors"
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
				<span
					class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
				>
					<span class="bg-brand size-1.5 rounded-full"></span> The editor
				</span>
				<h2 class="font-display mt-5 text-3xl tracking-tight sm:text-4xl">
					Source on the left, the page on the right.
				</h2>
				<p class="text-muted-foreground mt-4 text-lg leading-relaxed">
					A focused editor and a live preview, side by side. Your equations, figures, and citations,
					with nothing else competing for the screen.
				</p>
			</Reveal>

			<Reveal variant="blur" delay={100} class="mt-12">
				<div class="border-hairline bg-card shadow-craft-lg overflow-hidden rounded-2xl border">
					<div class="border-hairline flex h-11 items-center gap-3 border-b px-4">
						<span
							class="bg-primary text-primary-foreground grid size-6 place-items-center rounded-md text-[13px] font-bold"
							>G</span
						>
						<span class="text-muted-foreground/70 font-mono text-xs">thesis.tex</span>
						<span
							class="border-hairline text-muted-foreground ml-auto rounded-md border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase"
							>LaTeX</span
						>
					</div>
					<div class="grid grid-cols-1 lg:grid-cols-2">
						<pre
							class="text-muted-foreground border-hairline overflow-hidden border-b p-6 font-mono text-xs leading-[1.8] lg:border-b-0 lg:border-r"><span
								class="text-brand">\documentclass</span
							>&#123;article&#125;
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
							<div class="text-muted-foreground/60 mb-4 font-mono text-[11px] tracking-widest uppercase">
								Live preview
							</div>
							<h3 class="font-display mb-1 text-2xl">On Local-First Typesetting</h3>
							<p class="text-muted-foreground mb-5 text-sm">A. Researcher</p>
							<p class="text-muted-foreground leading-relaxed">A consistent estimator satisfies</p>
							<div class="text-foreground my-4 text-center text-2xl italic">θ̂ → θ</div>
							<p class="text-muted-foreground leading-relaxed">as the sample grows, see [1].</p>
						</div>
					</div>
					<div
						class="border-hairline text-muted-foreground flex h-8 items-center gap-4 border-t px-4 font-mono text-[11px]"
					>
						<span class="text-brand flex items-center gap-1.5"
							><span class="bg-brand size-1.5 rounded-full"></span> Offline-ready</span
						>
						<span>saved on your device</span>
						<span class="text-muted-foreground/50 ml-auto tabular-nums">Ln 14 · 312 chars</span>
					</div>
				</div>
			</Reveal>
		</div>
	</section>

	<!-- Local-first, not local-only -->
	<section class="border-hairline border-t">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up" class="max-w-2xl">
				<span
					class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
				>
					<span class="bg-brand size-1.5 rounded-full"></span> How it fits together
				</span>
				<h2 class="font-display mt-5 text-3xl tracking-tight sm:text-4xl">
					Local-first does not mean cut off from the cloud.
				</h2>
				<p class="text-muted-foreground mt-4 text-lg leading-relaxed">
					The private, heavy work stays on your machine. When you want sync, history, or a hand from a
					model, you reach the cloud through accounts you already have. The compiler is never a server,
					and the keys are always yours.
				</p>
			</Reveal>

			<div
				class="bg-hairline border-hairline mt-12 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-3"
			>
				{#each model as m, i (m.title)}
					{@const Icon = m.icon}
					<Reveal as="article" variant="up" delay={i * 70} class="bg-card flex flex-col p-7">
						<span class="border-hairline bg-canvas text-brand mb-5 grid size-10 place-items-center rounded-lg border">
							<Icon class="size-5" />
						</span>
						<h3 class="text-base font-semibold">{m.title}</h3>
						<p class="text-muted-foreground mt-2 text-sm leading-relaxed">{m.body}</p>
					</Reveal>
				{/each}
			</div>

			<Reveal variant="up" delay={120}>
				<div class="border-hairline bg-brand-subtle mt-4 flex items-start gap-3 rounded-2xl border p-6">
					<IconLock class="text-brand mt-0.5 size-5 shrink-0" />
					<p class="text-foreground/90 text-base leading-relaxed">
						We only ever hold what you choose to share, tied to your personal account. Click share and
						a project goes out under your name. Never click it, and your work never leaves your
						machine.
					</p>
				</div>
			</Reveal>
		</div>
	</section>

	<!-- Bring your own stack (integration roadmap) -->
	<section class="border-hairline border-t">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up" class="max-w-2xl">
				<span
					class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
				>
					<span class="bg-brand size-1.5 rounded-full"></span> On the roadmap
				</span>
				<h2 class="font-display mt-5 text-3xl tracking-tight sm:text-4xl">
					Plug GlyphX into the tools you already trust.
				</h2>
				<p class="text-muted-foreground mt-4 text-lg leading-relaxed">
					Instead of locking you into one cloud, GlyphX connects to yours. Here is where it is headed.
				</p>
			</Reveal>

			<div class="mt-12 grid gap-4 sm:grid-cols-2">
				{#each integrations as it, i (it.title)}
					{@const Icon = it.icon}
					<Reveal
						as="article"
						variant="up"
						delay={i * 60}
						class="border-hairline bg-card group flex flex-col rounded-2xl border p-7 transition-transform duration-300 hover:-translate-y-0.5"
					>
						<div class="flex items-center justify-between">
							<span class="border-hairline bg-canvas text-foreground group-hover:text-brand grid size-11 place-items-center rounded-xl border transition-colors">
								<Icon class="size-5" />
							</span>
							<span class="border-hairline text-muted-foreground rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase">
								{it.tag}
							</span>
						</div>
						<h3 class="mt-5 text-base font-semibold">{it.title}</h3>
						<p class="text-muted-foreground mt-2 text-sm leading-relaxed">{it.body}</p>
					</Reveal>
				{/each}
			</div>

			<Reveal variant="up" delay={120}>
				<p class="text-muted-foreground mt-8 max-w-2xl text-base leading-relaxed">
					These are the next things we are building. The rule behind all of them stays the same: your
					providers, your keys, your data.
				</p>
			</Reveal>
		</div>
	</section>

	<!-- Sound familiar (pain points) -->
	<section class="border-hairline border-t">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up" class="max-w-2xl">
				<span
					class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
				>
					<span class="bg-brand size-1.5 rounded-full"></span> Sound familiar
				</span>
				<h2 class="font-display mt-5 text-3xl tracking-tight sm:text-4xl">
					If you have lived in Overleaf for a while, you know these.
				</h2>
				<p class="text-muted-foreground mt-4 text-lg leading-relaxed">
					We kept hearing the same handful of complaints, and ran into most of them ourselves. Here is
					the short list.
				</p>
			</Reveal>

			<div class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each painPoints as p, i (p.quote)}
					<Reveal
						as="article"
						variant="up"
						delay={i * 50}
						class="border-hairline bg-card flex flex-col rounded-xl border p-6 transition-transform duration-300 hover:-translate-y-0.5"
					>
						<span class="text-brand/30 font-display text-4xl leading-none">&ldquo;</span>
						<p class="text-foreground -mt-2 text-base font-semibold">{p.quote}</p>
						<p class="text-muted-foreground mt-2 text-sm leading-relaxed">{p.body}</p>
					</Reveal>
				{/each}
			</div>

			<Reveal variant="up" delay={120}>
				<p class="text-muted-foreground mt-10 max-w-2xl text-base leading-relaxed">
					None of these are LaTeX problems. They are cloud problems. GlyphX does not have a cloud, so
					it does not have them.
				</p>
			</Reveal>
		</div>
	</section>

	<!-- Comparison -->
	<section id="compare" class="border-hairline border-t">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up">
				<span
					class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
				>
					<span class="bg-brand size-1.5 rounded-full"></span> Compare
				</span>
				<h2 class="font-display mt-5 max-w-2xl text-3xl tracking-tight sm:text-4xl">
					Private like your laptop. Easy like the cloud was supposed to be.
				</h2>
			</Reveal>

			<Reveal variant="up" delay={80} class="mt-10">
				<div class="border-hairline overflow-x-auto rounded-2xl border">
					<div class="grid min-w-[640px] grid-cols-[1.8fr_1fr_1fr_1fr] text-sm">
						<div class="text-muted-foreground bg-card px-5 py-4 font-mono text-[11px] tracking-widest uppercase">
							&nbsp;
						</div>
						<div class="bg-card text-foreground px-3 py-4 text-center font-semibold">GlyphX</div>
						<div class="bg-card text-muted-foreground px-3 py-4 text-center font-medium">Overleaf free</div>
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
				<p class="text-muted-foreground/70 mt-3 font-mono text-[11px]">
					Overleaf paid tiers lift some of these limits. The point is that GlyphX does not put them
					there to begin with.
				</p>
			</Reveal>
		</div>
	</section>

	<!-- How it works -->
	<section class="border-hairline border-t">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<Reveal variant="up">
				<span
					class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
				>
					<span class="bg-brand size-1.5 rounded-full"></span> How it works
				</span>
				<h2 class="font-display mt-5 max-w-2xl text-3xl tracking-tight sm:text-4xl">
					Three steps, none of which involve a login.
				</h2>
			</Reveal>

			<div class="mt-12 grid gap-px overflow-hidden rounded-2xl bg-hairline border-hairline border sm:grid-cols-3">
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

	<!-- FAQ -->
	<section id="faq" class="border-hairline border-t">
		<div class="mx-auto max-w-[1140px] px-5 py-20 sm:px-6 sm:py-28">
			<div class="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
				<Reveal variant="up">
					<span
						class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
					>
						<span class="bg-brand size-1.5 rounded-full"></span> FAQ
					</span>
					<h2 class="font-display mt-5 max-w-sm text-3xl tracking-tight sm:text-4xl">
						The questions people ask first.
					</h2>
				</Reveal>

				<div class="flex flex-col">
					{#each faqs as f, i (f.q)}
						<Reveal as="div" variant="up" delay={i * 40} class="border-hairline border-t py-6 first:border-t-0 first:pt-0">
							<h3 class="text-foreground text-base font-semibold">{f.q}</h3>
							<p class="text-muted-foreground mt-2 text-sm leading-relaxed">{f.a}</p>
						</Reveal>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<!-- CTA band -->
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
					<h2 class="font-display text-3xl tracking-tight sm:text-[2.75rem] sm:leading-[1.05]">
						Keep your research on your own machine.
					</h2>
					<p class="text-primary-foreground/65 mt-4 max-w-md text-base leading-relaxed">
						Start in the browser for free, or get the desktop app and work fully offline. No account,
						no upload, no waiting on a server.
					</p>
					<div class="mt-9 flex flex-wrap justify-center gap-3">
						<a
							href={resolve('/download')}
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
