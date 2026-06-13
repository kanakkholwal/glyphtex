<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Reveal } from '@glyphx/ui/reveal';
	import SiteHeader from '$lib/SiteHeader.svelte';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import FloatingGlyphs from '$lib/FloatingGlyphs.svelte';
	import {
		IconArrowRight,
		IconBrandApple,
		IconBrandWindows,
		IconBrandDebian,
		IconBrandGithub,
		IconDownload,
		IconPlayerPlay,
		IconShieldCheck,
		IconWorld,
		IconCheck
	} from '@tabler/icons-svelte';

	const repo = 'https://github.com/kanakkholwal/glyph';
	const releases = `${repo}/releases`;

	type OS = 'mac' | 'windows' | 'linux' | null;
	let detected = $state<OS>(null);

	onMount(() => {
		const ua = navigator.userAgent.toLowerCase();
		if (ua.includes('mac')) detected = 'mac';
		else if (ua.includes('win')) detected = 'windows';
		else if (ua.includes('linux') || ua.includes('x11')) detected = 'linux';
	});

	const platforms = [
		{
			id: 'mac' as const,
			icon: IconBrandApple,
			name: 'macOS',
			detail: 'Apple silicon and Intel',
			file: '.dmg disk image'
		},
		{
			id: 'windows' as const,
			icon: IconBrandWindows,
			name: 'Windows',
			detail: 'Windows 10 and 11, 64-bit',
			file: '.exe installer'
		},
		{
			id: 'linux' as const,
			icon: IconBrandDebian,
			name: 'Linux',
			detail: 'AppImage and .deb',
			file: 'x86_64 build'
		}
	];

	const included = [
		'The LaTeX engine, built in. No separate TeX distribution to install.',
		'A full editor with live preview, file tree, and command palette.',
		'Everything runs locally, so projects stay on your disk and compile offline.',
		'The hooks for your own cloud: Git, Dropbox, Drive, and a bring-your-own AI key, rolling out from the app itself.',
		'Free, with no account and no telemetry.'
	];
</script>

<svelte:head>
	<title>Download GlyphX: the local-first LaTeX editor</title>
	<meta
		name="description"
		content="Download GlyphX for macOS, Windows, and Linux. A local-first LaTeX editor that ships its own engine, compiles offline, and keeps your projects on your own disk. Free, no account."
	/>
</svelte:head>

<div class="bg-canvas text-foreground min-h-dvh">
	<SiteHeader />

	<!-- Hero -->
	<section class="relative">
		<FloatingGlyphs />
		<div class="relative mx-auto max-w-[1140px] px-5 sm:px-6">
			<div class="flex flex-col items-center py-16 text-center sm:py-24">
				<Reveal variant="up" class="flex flex-col items-center">
					<span
						class="border-hairline bg-card text-muted-foreground mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-medium tracking-[0.12em] uppercase"
					>
						<span class="bg-brand size-1.5 animate-pulse rounded-full"></span>
						Desktop app
					</span>
					<h1 class="font-display max-w-3xl text-[2.4rem] leading-[1.05] tracking-[-0.035em] sm:text-6xl">
						Download GlyphX.
					</h1>
					<p class="text-muted-foreground mt-6 max-w-[36rem] text-lg leading-relaxed">
						The desktop app brings the engine onto your machine, so you write and compile LaTeX with no
						connection at all. It is also where sync, Git, and your own AI key connect, straight from
						the app through your own accounts. Pick your platform below. Builds are published on GitHub
						Releases.
					</p>
				</Reveal>
			</div>
		</div>
	</section>

	<!-- Platform cards -->
	<section class="mx-auto max-w-[1140px] px-5 pb-8 sm:px-6">
		<div class="grid gap-4 sm:grid-cols-3">
			{#each platforms as p, i (p.id)}
				{@const Icon = p.icon}
				{@const isMine = detected === p.id}
				<Reveal
					as="article"
					variant="up"
					delay={i * 70}
					class={'group bg-card relative flex flex-col rounded-2xl border p-7 transition-all duration-300 hover:-translate-y-1 ' +
						(isMine ? 'border-brand/50 ring-brand/20 ring-2' : 'border-hairline')}
				>
					{#if isMine}
						<span
							class="text-brand bg-brand-subtle absolute top-4 right-4 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase"
							>Your platform</span
						>
					{/if}
					<span
						class="border-hairline bg-canvas text-foreground group-hover:text-brand mb-5 grid size-12 place-items-center rounded-xl border transition-colors"
					>
						<Icon class="size-6" />
					</span>
					<h2 class="text-lg font-semibold">{p.name}</h2>
					<p class="text-muted-foreground mt-1 text-sm">{p.detail}</p>
					<p class="text-muted-foreground/60 mt-0.5 font-mono text-xs">{p.file}</p>

					<a
						href={releases}
						target="_blank"
						rel="noreferrer"
						class="bg-primary text-primary-foreground mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
					>
						<IconDownload class="size-4" /> Get {p.name} build
					</a>
					<p class="text-muted-foreground/60 mt-3 text-center font-mono text-[11px]">
						from GitHub Releases
					</p>
				</Reveal>
			{/each}
		</div>

		<Reveal variant="up" delay={120}>
			<div
				class="border-hairline bg-card/60 mt-4 flex flex-col items-start justify-between gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center"
			>
				<div class="flex items-start gap-3">
					<span class="border-hairline bg-canvas text-foreground grid size-10 shrink-0 place-items-center rounded-lg border">
						<IconWorld class="size-5" />
					</span>
					<div>
						<h3 class="text-sm font-semibold">Just want a quick look first?</h3>
						<p class="text-muted-foreground mt-0.5 text-sm">
							Try the browser editor. It runs the same LaTeX in the page. The desktop app is where
							offline compiling, Git, and your own cloud sync come together.
						</p>
					</div>
				</div>
				<a
					href={resolve('/editor')}
					class="border-hairline bg-card text-foreground hover:bg-muted group inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border px-5 text-sm font-semibold transition-colors"
				>
					<IconPlayerPlay class="size-4" /> Try in browser
					<IconArrowRight class="size-4 transition-transform group-hover:translate-x-0.5" />
				</a>
			</div>
		</Reveal>
	</section>

	<!-- What's inside + verify -->
	<section class="mx-auto max-w-[1140px] px-5 py-16 sm:px-6 sm:py-24">
		<div class="grid gap-12 lg:grid-cols-2">
			<Reveal variant="up">
				<span
					class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
				>
					<span class="bg-brand size-1.5 rounded-full"></span> What is in the download
				</span>
				<h2 class="font-display mt-5 text-2xl tracking-tight sm:text-3xl">
					One app. Nothing else to set up.
				</h2>
				<ul class="mt-6 flex flex-col gap-3">
					{#each included as line (line)}
						<li class="text-muted-foreground flex items-start gap-3 text-sm leading-relaxed">
							<IconCheck class="text-brand mt-0.5 size-4 shrink-0" />
							<span>{line}</span>
						</li>
					{/each}
				</ul>
			</Reveal>

			<Reveal variant="up" delay={80}>
				<div class="border-hairline bg-card flex h-full flex-col rounded-2xl border p-7">
					<span class="border-hairline bg-canvas text-foreground mb-5 grid size-10 place-items-center rounded-lg border">
						<IconShieldCheck class="size-5" />
					</span>
					<h3 class="text-base font-semibold">Verifying your download</h3>
					<p class="text-muted-foreground mt-2 text-sm leading-relaxed">
						Every release on GitHub lists the build artifacts next to their checksums. Compare the
						hash of the file you downloaded against the one in the release notes before you run it.
						The full source is in the same repository if you would rather build it yourself.
					</p>
					<div class="mt-6 flex flex-wrap gap-3">
						<a
							href={releases}
							target="_blank"
							rel="noreferrer"
							class="border-hairline bg-canvas text-foreground hover:bg-muted inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors"
						>
							<IconDownload class="size-4" /> All releases
						</a>
						<a
							href={repo}
							target="_blank"
							rel="noreferrer"
							class="border-hairline bg-canvas text-foreground hover:bg-muted inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors"
						>
							<IconBrandGithub class="size-4" /> Source code
						</a>
					</div>
				</div>
			</Reveal>
		</div>
	</section>

	<!-- CTA -->
	<section class="mx-auto max-w-[1140px] px-5 pb-20 sm:px-6 sm:pb-24">
		<Reveal variant="scale">
			<div
				class="bg-primary text-primary-foreground relative overflow-hidden rounded-3xl px-8 py-14 text-center sm:px-16 sm:py-16"
			>
				<div class="relative mx-auto flex max-w-xl flex-col items-center">
					<h2 class="font-display text-2xl tracking-tight sm:text-4xl">
						Builds are on the way.
					</h2>
					<p class="text-primary-foreground/65 mt-4 max-w-md text-base leading-relaxed">
						Desktop releases are published on GitHub. Watch the repository to hear about the first one,
						or start writing in the browser today.
					</p>
					<div class="mt-8 flex flex-wrap justify-center gap-3">
						<a
							href={repo}
							target="_blank"
							rel="noreferrer"
							class="bg-card text-foreground inline-flex h-12 items-center gap-2 rounded-lg px-6 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
						>
							<IconBrandGithub class="size-4" /> Watch on GitHub
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
