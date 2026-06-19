<script lang="ts">
	import { resolve } from '$app/paths';
	import FloatingGlyphs from '$lib/FloatingGlyphs.svelte';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import SiteHeader from '$lib/SiteHeader.svelte';
	import { Reveal } from '@glyphx/ui/reveal';
	import {
		IconArrowRight,
		IconBrandApple,
		IconBrandDebian,
		IconBrandGithub,
		IconBrandWindows,
		IconCheck,
		IconCopy,
		IconDownload,
		IconInfoCircle,
		IconPlayerPlay,
		IconShieldCheck,
		IconTerminal2,
		IconWorld
	} from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import { trackEvent } from '$lib/analytics';

	const owner = 'kanakkholwal';
	const repoName = 'glyphx';
	const repo = `https://github.com/${owner}/${repoName}`;
	const releases = `${repo}/releases`;

	type OS = 'mac' | 'windows' | 'linux' | null;
	let detected = $state<OS>(null);

	// Live release data, pulled from GitHub Releases so the buttons point at the
	// real build artifacts (per platform/arch) instead of just the releases page.
	type Asset = { name: string; url: string; size: number; kind: string };
	type Grouped = { mac: Asset[]; windows: Asset[]; linux: Asset[] };

	let status = $state<'loading' | 'ready' | 'empty' | 'error'>('loading');
	let version = $state('');
	let publishedAt = $state('');
	let assets = $state<Grouped>({ mac: [], windows: [], linux: [] });

	const releasedOn = $derived(
		publishedAt
			? new Date(publishedAt).toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'short',
					day: 'numeric'
				})
			: ''
	);

	function humanSize(bytes: number) {
		if (!bytes) return '';
		const mb = bytes / 1024 / 1024;
		return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
	}

	function archLabel(n: string) {
		if (n.includes('aarch64') || n.includes('arm64')) return 'Apple Silicon';
		if (n.includes('x64') || n.includes('x86_64') || n.includes('intel')) return 'Intel';
		return 'Universal';
	}

	// Map a release asset filename to a platform + human label, skipping the
	// updater bundles / signatures / manifest that are not direct downloads.
	function classify(name: string): { os: keyof Grouped; kind: string } | null {
		const n = name.toLowerCase();
		if (n.endsWith('.sig') || n.endsWith('.json') || n.endsWith('.app.tar.gz')) return null;
		if (n.endsWith('.dmg')) return { os: 'mac', kind: `${archLabel(n)} (.dmg)` };
		if (n.endsWith('.exe')) return { os: 'windows', kind: 'Installer (.exe)' };
		if (n.endsWith('.msi')) return { os: 'windows', kind: 'Installer (.msi)' };
		if (n.endsWith('.appimage')) return { os: 'linux', kind: 'AppImage' };
		if (n.endsWith('.deb')) return { os: 'linux', kind: 'Debian (.deb)' };
		return null;
	}

	async function loadLatestRelease() {
		try {
			const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/releases/latest`, {
				headers: { Accept: 'application/vnd.github+json' }
			});
			if (!res.ok) throw new Error(`GitHub API ${res.status}`);
			const data = await res.json();
			version = data.tag_name ?? '';
			publishedAt = data.published_at ?? '';
			const grouped: Grouped = { mac: [], windows: [], linux: [] };
			for (const a of data.assets ?? []) {
				const c = classify(a.name);
				if (!c) continue;
				grouped[c.os].push({
					name: a.name,
					url: a.browser_download_url,
					size: a.size,
					kind: c.kind
				});
			}
			assets = grouped;
			const total = grouped.mac.length + grouped.windows.length + grouped.linux.length;
			status = total > 0 ? 'ready' : 'empty';
		} catch {
			status = 'error';
		}
	}

	function trackDownload(platform: string, asset: string) {
		trackEvent('download_click', { platform, asset, version: version || 'unknown' });
	}

	// macOS install helper. The build is not Apple-notarized yet, so a freshly
	// downloaded .dmg is Gatekeeper-blocked until the quarantine flag is cleared.
	// Homebrew would clear it automatically, but the cask is not published yet,
	// so the step is built and kept hidden behind this flag. Flip it to true once
	// `brew tap kanakkholwal/glyphx` + the glyphx cask are live.
	const showHomebrew = false;
	const brewCmd = 'brew install --cask kanakkholwal/glyphx/glyphx';
	const quarantineCmd = 'xattr -dr com.apple.quarantine /Applications/GlyphX.app';

	type MacStep = { title: string; body: string; code?: string; done?: string };
	const macSteps: MacStep[] = [
		...(showHomebrew
			? [
					{
						title: 'Fastest: install with Homebrew',
						body: 'One line grabs the right build for your chip and keeps it updated. It clears the Gatekeeper warning for you, so you can skip the manual steps below.',
						code: brewCmd,
						done: 'Installed this way? You are done. Skip the .dmg steps below.'
					} satisfies MacStep
				]
			: []),
		{
			title: 'Download the .dmg for your chip',
			body: 'Apple Silicon for M1, M2, M3, and M4 Macs. Intel for older models. Not sure which you have? Open the Apple menu, then About This Mac.'
		},
		{
			title: 'Drag GlyphX into Applications',
			body: 'Open the .dmg and drop GlyphX into your Applications folder, the same as any other Mac app.'
		},
		{
			title: 'Clear the Gatekeeper warning, once',
			body: 'GlyphX is not notarized by Apple yet, so the first launch can show a "GlyphX is damaged" or "unidentified developer" message. Run this line in Terminal to clear it. It only removes the quarantine flag macOS adds to downloaded apps.',
			code: quarantineCmd
		},
		{
			title: 'Open GlyphX',
			body: 'Launch it from Applications or Spotlight and you are in. macOS will not ask again. If you ever reinstall from a .dmg and the warning returns, run the same line once more.'
		}
	];

	let copied = $state<string | null>(null);
	let macOpen = $state(false);

	async function copyCmd(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = text;
			setTimeout(() => {
				if (copied === text) copied = null;
			}, 1600);
		} catch {
			// Clipboard can be blocked (no permission, insecure context). The
			// command is selectable in the code block either way.
		}
	}

	onMount(() => {
		const ua = navigator.userAgent.toLowerCase();
		if (ua.includes('mac')) detected = 'mac';
		else if (ua.includes('win')) detected = 'windows';
		else if (ua.includes('linux') || ua.includes('x11')) detected = 'linux';
		// Open the macOS guide automatically for Mac visitors; others can expand it.
		macOpen = detected === 'mac';
		loadLatestRelease();
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
		'A full editor with live preview, file tree, search, and a command palette.',
		'A built-in Git client: stage, commit, diff, history, clone, and push or pull.',
		'Everything runs locally, so projects stay on your disk and compile offline.',
		'Automatic updates, so you stay on the latest build without reinstalling.',
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
			<div class="flex flex-col items-center pt-24 pb-16 text-center sm:pt-32 sm:pb-24">
				<!-- Hero rendered visible by default (no Reveal gate) — it's the LCP
				     element, same as the home hero. -->
				<div class="flex flex-col items-center">
					<span
						class="text-muted-foreground mb-5 font-mono text-[11px] font-semibold tracking-[0.2em] uppercase"
					>
						Desktop app
					</span>
					<h1 class="font-serif max-w-3xl text-[2.6rem] leading-[1.02] sm:text-6xl">
						Download GlyphX.
					</h1>
					<p class="text-muted-foreground mt-6 max-w-[37rem] text-lg leading-relaxed">
						The desktop app puts the LaTeX engine on your machine — write and compile fully offline,
						with the built-in Git client alongside. It updates itself; pick your platform below.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Platform cards -->
	<section class="mx-auto max-w-[1140px] px-5 pb-8 sm:px-6">
		<!-- Release banner -->
		<div class="mb-5 flex items-center justify-between gap-3 font-mono text-xs">
			{#if status === 'loading'}
				<span class="text-muted-foreground flex items-center gap-2">
					<span class="bg-brand size-1.5 animate-pulse rounded-full"></span>
					Checking the latest release&hellip;
				</span>
			{:else if status === 'ready'}
				<span class="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
					<span
						class="text-brand border-brand/30 bg-brand-subtle rounded-full border px-2 py-0.5 font-semibold"
					>
						GlyphX {version}
					</span>
					{#if releasedOn}<span class="text-muted-foreground">released {releasedOn}</span>{/if}
				</span>
			{:else}
				<span class="text-muted-foreground">Latest build info was unavailable.</span>
			{/if}
			<a
				href={releases}
				target="_blank"
				rel="noreferrer"
				class="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
			>
				All releases &rarr;
			</a>
		</div>

		<div class="grid gap-4 sm:grid-cols-3">
			{#each platforms as p, i (p.id)}
				{@const Icon = p.icon}
				{@const isMine = detected === p.id}
				{@const items = assets[p.id]}
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

					<div class="mt-6 flex flex-1 flex-col justify-end gap-2">
						{#if status === 'loading'}
							<div class="bg-muted h-11 w-full animate-pulse rounded-lg"></div>
						{:else if status === 'ready' && items.length > 0}
							{#each items as a, j (a.name)}
								<a
									href={a.url}
									rel="noreferrer"
									title={a.name}
									onclick={() => trackDownload(p.id, a.name)}
									class={'inline-flex h-11 items-center justify-between gap-2 rounded-lg px-4 text-sm font-semibold transition-all active:scale-[0.98] ' +
										(j === 0
											? 'bg-primary text-primary-foreground hover:opacity-90'
											: 'border-hairline bg-canvas text-foreground hover:bg-muted border')}
								>
									<span class="flex items-center gap-2">
										<IconDownload class="size-4" />
										{a.kind}
									</span>
									{#if a.size}<span class="text-[11px] font-normal opacity-70"
											>{humanSize(a.size)}</span
										>{/if}
								</a>
							{/each}
						{:else}
							<a
								href={releases}
								target="_blank"
								rel="noreferrer"
								onclick={() => trackDownload(p.id, 'releases_page')}
								class="border-hairline bg-canvas text-foreground hover:bg-muted inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors"
							>
								<IconBrandGithub class="size-4" />
								{status === 'empty' ? 'Not in this release yet' : 'Find it on GitHub'}
							</a>
						{/if}
					</div>
				</Reveal>
			{/each}
		</div>

		<Reveal variant="up" delay={120}>
			<div
				class="border-hairline bg-card/60 mt-4 flex flex-col items-start justify-between gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center"
			>
				<div class="flex items-start gap-3">
					<span
						class="border-hairline bg-canvas text-foreground grid size-10 shrink-0 place-items-center rounded-lg border"
					>
						<IconWorld class="size-5" />
					</span>
					<div>
						<h3 class="text-sm font-semibold">Just want a quick look first?</h3>
						<p class="text-muted-foreground mt-0.5 text-sm">
							Try the browser editor. It runs the same LaTeX in the page. The desktop app is where
							offline compiling and the built-in Git client come together.
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

	<!-- macOS install guide (the build is not notarized yet) -->
	<section class="mx-auto max-w-[1140px] px-5 pb-8 sm:px-6">
		<Reveal variant="up">
			<details
				bind:open={macOpen}
				class="border-hairline bg-card group/disc overflow-hidden rounded-2xl border [&[open]_.chev]:rotate-180"
			>
				<summary
					class="hover:bg-muted/40 flex cursor-pointer list-none items-center gap-4 px-6 py-5 transition-colors [&::-webkit-details-marker]:hidden"
				>
					<span
						class="border-hairline bg-canvas text-foreground grid size-11 shrink-0 place-items-center rounded-xl border"
					>
						<IconBrandApple class="size-6" />
					</span>
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<h2 class="text-lg font-semibold">Installing on macOS</h2>
							<span
								class="border-warning/30 bg-warning/10 text-warning rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase"
								>Not notarized yet</span
							>
						</div>
						<p class="text-muted-foreground mt-0.5 text-sm">
							One short Terminal step on first launch. Requires macOS 10.15 or later.
						</p>
					</div>
					<span class="text-muted-foreground ml-auto hidden font-mono text-xs sm:block">
						{macSteps.length} steps
					</span>
					<IconArrowRight
						class="chev text-muted-foreground size-4 shrink-0 rotate-90 transition-transform"
					/>
				</summary>

				<div class="border-hairline border-t px-6 py-6">
					<div
						class="border-hairline bg-canvas/60 mb-6 flex items-start gap-3 rounded-xl border p-4"
					>
						<IconInfoCircle class="text-muted-foreground mt-0.5 size-4 shrink-0" />
						<p class="text-muted-foreground text-sm leading-relaxed">
							Apple charges for the developer ID that removes this warning, and we have not added it
							yet. The app is the same build you can read on GitHub. Until it is notarized, macOS
							needs one command to trust it. {#if showHomebrew}Homebrew (step 1) does this for you.{/if}
						</p>
					</div>

					<ol class="flex flex-col gap-5">
						{#each macSteps as step, i (step.title)}
							<li class="flex gap-4">
								<span
									class="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold"
									>{i + 1}</span
								>
								<div class="min-w-0 flex-1">
									<h3 class="text-sm font-semibold">{step.title}</h3>
									<p class="text-muted-foreground mt-1 text-sm leading-relaxed">{step.body}</p>

									{#if step.code}
										<div
											class="border-hairline bg-canvas mt-3 flex items-center gap-3 rounded-lg border py-2.5 pr-2 pl-3"
										>
											<IconTerminal2 class="text-muted-foreground/70 size-4 shrink-0" />
											<code
												class="text-foreground min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-pre"
												>{step.code}</code
											>
											<button
												type="button"
												onclick={() => copyCmd(step.code!)}
												class="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-mono text-[11px] font-medium transition-colors"
												aria-label="Copy command"
											>
												{#if copied === step.code}
													<IconCheck class="text-brand size-3.5" /> Copied
												{:else}
													<IconCopy class="size-3.5" /> Copy
												{/if}
											</button>
										</div>
									{/if}

									{#if step.done}
										<p class="text-brand mt-2 flex items-center gap-1.5 text-xs font-medium">
											<IconCheck class="size-3.5 shrink-0" />
											{step.done}
										</p>
									{/if}
								</div>
							</li>
						{/each}
					</ol>

					<p class="text-muted-foreground mt-6 text-xs leading-relaxed">
						Prefer not to use Terminal? You can also right-click GlyphX in Applications, choose
						Open, and confirm once in the dialog that appears.
					</p>
				</div>
			</details>
		</Reveal>
	</section>

	<!-- What's inside + verify — tonal band -->
	<section class="bg-surface-soft mt-8">
		<div class="mx-auto max-w-[1140px] px-5 py-16 sm:px-6 sm:py-24">
			<div class="grid gap-12 lg:grid-cols-2">
			<Reveal variant="up">
				<span
					class="text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
				>
					What is in the download
				</span>
				<h2 class="font-serif mt-5 text-2xl sm:text-3xl">
					One app. <em>Nothing else to set up.</em>
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
					<span
						class="border-hairline bg-canvas text-foreground mb-5 grid size-10 place-items-center rounded-lg border"
					>
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
		</div>
	</section>

	<!-- CTA -->
	<section class="mx-auto max-w-[1140px] px-5 pb-20 sm:px-6 sm:pb-24">
		<Reveal variant="scale">
			<div
				class="bg-primary text-primary-foreground relative overflow-hidden rounded-3xl px-8 py-14 text-center sm:px-16 sm:py-16"
			>
				<div class="relative mx-auto flex max-w-xl flex-col items-center">
					<h2 class="font-serif text-2xl sm:text-4xl">Builds are on the way.</h2>
					<p class="text-primary-foreground/65 mt-4 max-w-md text-base leading-relaxed">
						Desktop releases are published on GitHub. Watch the repository to hear about the first
						one, or start writing in the browser today.
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
