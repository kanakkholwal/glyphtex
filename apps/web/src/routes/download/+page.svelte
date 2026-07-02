<script lang="ts">
	import { resolve } from '$app/paths';
	import FloatingGlyphs from '$lib/FloatingGlyphs.svelte';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import SiteHeader from '$lib/SiteHeader.svelte';
	import { Button } from '@glyphx/ui/button';
	import { Reveal } from '@glyphx/ui/reveal';
	import {
		IconArrowRight,
		IconBrandApple,
		IconBrandDebian,
		IconBrandGithub,
		IconBrandWindows,
		IconCheck,
		IconChevronDown,
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
	const patternTall = '/decor/pattern-tall.svg';

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

	// GitHub Releases API — only the fields we use, validated at the boundary. The
	// response is untrusted and feeds a clickable download href, so each asset is
	// parsed/narrowed (and its URL constrained to https) before use (AGENTS.md rule #4).
	type RawAsset = { name: string; browser_download_url: string; size: number };
	type RawRelease = { tag_name: string; published_at: string; assets: RawAsset[] };

	function parseRelease(data: unknown): RawRelease {
		if (!data || typeof data !== 'object') throw new Error('Malformed release response.');
		const o = data as Record<string, unknown>;
		const assets: RawAsset[] = Array.isArray(o.assets)
			? o.assets.flatMap((raw): RawAsset[] => {
					if (!raw || typeof raw !== 'object') return [];
					const a = raw as Record<string, unknown>;
					const name = a.name;
					const url = a.browser_download_url;
					// Reject anything that isn't a named asset on an https GitHub URL.
					if (typeof name !== 'string' || typeof url !== 'string') return [];
					if (!url.startsWith('https://')) return [];
					return [
						{ name, browser_download_url: url, size: typeof a.size === 'number' ? a.size : 0 }
					];
				})
			: [];
		return {
			tag_name: typeof o.tag_name === 'string' ? o.tag_name : '',
			published_at: typeof o.published_at === 'string' ? o.published_at : '',
			assets
		};
	}

	async function loadLatestRelease() {
		try {
			const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/releases/latest`, {
				headers: { Accept: 'application/vnd.github+json' }
			});
			if (!res.ok) throw new Error(`GitHub API ${res.status}`);
			const release = parseRelease(await res.json());
			version = release.tag_name;
			publishedAt = release.published_at;
			const grouped: Grouped = { mac: [], windows: [], linux: [] };
			for (const a of release.assets) {
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

<div class="min-h-screen bg-canvas font-sans text-ink antialiased selection:bg-brand-subtle">
	<SiteHeader />

	<main>
		<!-- Hero -->
		<section class="landing-shell landing-hero border-b border-hairline">
			<div class="landing-hero__wash"></div>
			<FloatingGlyphs />
			<div class="relative mx-auto max-w-7xl px-6 lg:px-10">
				<div class="flex flex-col items-center pb-16 pt-24 text-center sm:pb-24 sm:pt-32">
					<!-- Hero rendered visible by default (no Reveal gate) — it's the LCP element. -->
					<p class="landing-section-label mb-6 justify-center">Desktop app</p>
					<h1 class="landing-section-title max-w-3xl">
						Download <em>GlyphX</em>
					</h1>
					<p class="mt-6 max-w-[37rem] text-lg leading-relaxed text-ink-body">
						The desktop app puts the LaTeX engine on your machine — write and compile fully offline,
						with the built-in Git client alongside. It updates itself; pick your platform below.
					</p>
				</div>
			</div>
		</section>

		<!-- Platform cards -->
		<section class="landing-shell border-b border-hairline">
			<div class="mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:px-10">
				<Reveal
					variant="up"
					class="mb-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
				>
					<div class="max-w-2xl">
						<p class="landing-section-label">Pick your platform</p>
						<h2 class="landing-section-title mt-4">
							One download, <em>everything included</em>
						</h2>
					</div>
					<p class="max-w-md text-base leading-7 text-ink-body sm:text-lg">
						Native builds for macOS, Windows, and Linux — each ships the LaTeX engine, the editor,
						and the Git client in a single app. No separate TeX install, no account.
					</p>
				</Reveal>

				<!-- Release banner -->
				<div class="mb-5 flex items-center justify-between gap-3 font-mono text-xs">
					{#if status === 'loading'}
						<span class="flex items-center gap-2 text-ink-muted">
							<span class="size-1.5 animate-pulse rounded-full bg-brand"></span>
							Checking the latest release&hellip;
						</span>
					{:else if status === 'ready'}
						<span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-muted">
							<span
								class="rounded-full border border-brand/30 bg-brand-subtle px-2 py-0.5 font-semibold text-brand"
							>
								GlyphX {version}
							</span>
							{#if releasedOn}<span class="text-ink-muted">released {releasedOn}</span>{/if}
						</span>
					{:else}
						<span class="text-ink-muted">Latest build info was unavailable.</span>
					{/if}
					<a
						href={releases}
						target="_blank"
						rel="noreferrer"
						class="shrink-0 text-ink-muted transition-colors hover:text-ink"
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
							class={'group relative flex flex-col rounded-3xl border bg-surface-card p-7 shadow-craft-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-craft-lg ' +
								(isMine ? 'border-brand/50 ring-2 ring-brand/20' : 'border-hairline')}
						>
							{#if isMine}
								<span
									class="absolute right-4 top-4 rounded-full bg-brand-subtle px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-brand"
									>Your platform</span
								>
							{/if}
							<span
								class="mb-5 grid size-12 place-items-center rounded-xl border border-hairline bg-canvas text-ink transition-colors group-hover:text-brand"
							>
								<Icon class="size-6" />
							</span>
							<h2 class="text-lg font-semibold text-ink">{p.name}</h2>
							<p class="mt-1 text-sm text-ink-muted">{p.detail}</p>

							<div class="mt-6 flex flex-1 flex-col justify-end gap-2">
								{#if status === 'loading'}
									<div class="h-11 w-full animate-pulse rounded-lg bg-surface-soft"></div>
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
													: 'border border-hairline bg-canvas text-ink hover:bg-surface-soft')}
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
										class="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-hairline bg-canvas px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft"
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
						class="mt-4 flex flex-col items-start justify-between gap-4 rounded-3xl border border-hairline bg-surface-card/60 p-6 shadow-craft-sm sm:flex-row sm:items-center"
					>
						<div class="flex items-start gap-3">
							<span
								class="grid size-10 shrink-0 place-items-center rounded-lg border border-hairline bg-canvas text-ink"
							>
								<IconWorld class="size-5" />
							</span>
							<div>
								<h3 class="text-sm font-semibold text-ink">Just want a quick look first?</h3>
								<p class="mt-0.5 text-sm text-ink-muted">
									Try the browser editor. It runs the same LaTeX in the page. The desktop app is where
									offline compiling and the built-in Git client come together.
								</p>
							</div>
						</div>
						<a
							href={resolve('/editor')}
							class="group inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-hairline bg-surface-card px-5 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft"
						>
							<IconPlayerPlay class="size-4" /> Try in browser
							<IconArrowRight class="size-4 transition-transform group-hover:translate-x-0.5" />
						</a>
					</div>
				</Reveal>
			</div>
		</section>

		<!-- macOS install guide (the build is not notarized yet) -->
		<section class="landing-shell border-b border-hairline">
			<div class="mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:px-10">
				<Reveal variant="up" class="mb-12 max-w-3xl">
					<p class="landing-section-label">macOS · one-time step</p>
					<h2 class="landing-section-title mt-4">
						Clearing the <em>Gatekeeper</em> warning
					</h2>
					<p class="mt-5 text-lg leading-8 text-ink-body">
						The build isn't Apple-notarized yet, so the first launch needs one short Terminal
						command. Here's the whole process, start to finish.
					</p>
				</Reveal>

				<Reveal variant="up" delay={80}>
					<details
						bind:open={macOpen}
						class="group/disc overflow-hidden rounded-3xl border border-hairline bg-surface-card shadow-craft-sm [&[open]_.chev]:rotate-180"
					>
						<summary
							class="flex cursor-pointer list-none items-center gap-4 px-6 py-5 transition-colors hover:bg-surface-soft/50 [&::-webkit-details-marker]:hidden"
						>
							<span
								class="grid size-11 shrink-0 place-items-center rounded-xl border border-hairline bg-canvas text-ink"
							>
								<IconBrandApple class="size-6" />
							</span>
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<h2 class="text-lg font-semibold text-ink">Installing on macOS</h2>
									<span
										class="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-warning"
										>Not notarized yet</span
									>
								</div>
								<p class="mt-0.5 text-sm text-ink-muted">
									One short Terminal step on first launch. Requires macOS 10.15 or later.
								</p>
							</div>
							<span class="ml-auto hidden font-mono text-xs text-ink-muted sm:block">
								{macSteps.length} steps
							</span>
							<span
								class="chev grid size-7 shrink-0 place-items-center rounded-lg border border-hairline text-ink-muted transition-transform duration-300"
							>
								<IconChevronDown class="size-4" />
							</span>
						</summary>

						<div class="border-t border-hairline px-6 py-6">
							<div
								class="mb-6 flex items-start gap-3 rounded-xl border border-hairline bg-canvas/60 p-4"
							>
								<IconInfoCircle class="mt-0.5 size-4 shrink-0 text-ink-muted" />
								<p class="text-sm leading-relaxed text-ink-muted">
									Apple charges for the developer ID that removes this warning, and we have not added
									it yet. The app is the same build you can read on GitHub. Until it is notarized,
									macOS needs one command to trust it. {#if showHomebrew}Homebrew (step 1) does this
										for you.{/if}
								</p>
							</div>

							<ol class="flex flex-col gap-5">
								{#each macSteps as step, i (step.title)}
									<li class="flex gap-4">
										<span
											class="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground"
											>{i + 1}</span
										>
										<div class="min-w-0 flex-1">
											<h3 class="text-sm font-semibold text-ink">{step.title}</h3>
											<p class="mt-1 text-sm leading-relaxed text-ink-muted">{step.body}</p>

											{#if step.code}
												<div
													class="mt-3 flex items-center gap-3 rounded-lg border border-hairline bg-canvas py-2.5 pl-3 pr-2"
												>
													<IconTerminal2 class="size-4 shrink-0 text-ink-muted/70" />
													<code
														class="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-xs text-ink"
														>{step.code}</code
													>
													<button
														type="button"
														onclick={() => copyCmd(step.code!)}
														class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-mono text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
														aria-label="Copy command"
													>
														{#if copied === step.code}
															<IconCheck class="size-3.5 text-brand" /> Copied
														{:else}
															<IconCopy class="size-3.5" /> Copy
														{/if}
													</button>
												</div>
											{/if}

											{#if step.done}
												<p class="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand">
													<IconCheck class="size-3.5 shrink-0" />
													{step.done}
												</p>
											{/if}
										</div>
									</li>
								{/each}
							</ol>

							<p class="mt-6 text-xs leading-relaxed text-ink-muted">
								Prefer not to use Terminal? You can also right-click GlyphX in Applications, choose
								Open, and confirm once in the dialog that appears.
							</p>
						</div>
					</details>
				</Reveal>
			</div>
		</section>

		<!-- What's inside + verify -->
		<section class="landing-shell border-b border-hairline bg-surface-soft/40">
			<div class="mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:px-10">
				<div class="grid gap-12 lg:grid-cols-2">
					<Reveal variant="up">
						<p class="landing-section-label">What is in the download</p>
						<h2 class="landing-section-title mt-4">
							One app. <em>Nothing else to set up.</em>
						</h2>
						<ul class="mt-7 flex flex-col gap-3.5">
							{#each included as line (line)}
								<li class="flex items-start gap-3">
									<span
										class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-subtle text-brand"
									>
										<IconCheck class="size-4" />
									</span>
									<span class="pt-1 text-sm leading-relaxed text-ink-body">{line}</span>
								</li>
							{/each}
						</ul>
					</Reveal>

					<Reveal variant="up" delay={80}>
						<div
							class="flex h-full flex-col rounded-3xl border border-hairline bg-surface-card p-7 shadow-craft-sm"
						>
							<span
								class="mb-5 grid size-10 place-items-center rounded-lg border border-hairline bg-canvas text-ink"
							>
								<IconShieldCheck class="size-5" />
							</span>
							<h3 class="text-base font-semibold text-ink">Verifying your download</h3>
							<p class="mt-2 text-sm leading-relaxed text-ink-muted">
								Every release on GitHub lists the build artifacts next to their checksums. Compare the
								hash of the file you downloaded against the one in the release notes before you run
								it. The full source is in the same repository if you would rather build it yourself.
							</p>
							<div class="mt-6 flex flex-wrap gap-3">
								<a
									href={releases}
									target="_blank"
									rel="noreferrer"
									class="inline-flex h-10 items-center gap-2 rounded-lg border border-hairline bg-canvas px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft"
								>
									<IconDownload class="size-4" /> All releases
								</a>
								<a
									href={repo}
									target="_blank"
									rel="noreferrer"
									class="inline-flex h-10 items-center gap-2 rounded-lg border border-hairline bg-canvas px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft"
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
		<section class="landing-shell">
			<div class="mx-auto max-w-6xl px-6 py-20 sm:py-28 lg:px-10">
				<Reveal variant="scale">
					<div class="landing-cta-panel">
						<img
							src={patternTall}
							alt=""
							aria-hidden="true"
							class="landing-cta-pattern landing-cta-pattern--left"
						/>
						<img
							src={patternTall}
							alt=""
							aria-hidden="true"
							class="landing-cta-pattern landing-cta-pattern--right"
						/>

						<p class="landing-section-label justify-center">Ready when you are</p>
						<h2 class="landing-section-title mt-4 max-w-3xl">Builds are <em>on the way</em></h2>
						<p class="mt-6 max-w-md text-lg leading-8 text-ink-body">
							Desktop releases are published on GitHub. Watch the repository to hear about the first
							one, or start writing in the browser today.
						</p>
						<div class="mt-10 flex flex-wrap justify-center gap-4">
							<Button href={repo} target="_blank" rel="noreferrer" variant="landing_soft" size="pill">
								<IconBrandGithub class="size-4" /> Watch on GitHub
							</Button>
							<Button href={resolve('/editor')} variant="landing_ghost" size="pill">
								Open the editor <IconArrowRight class="size-4" />
							</Button>
						</div>
					</div>
				</Reveal>
			</div>
		</section>
	</main>

	<SiteFooter />
</div>
