<script lang="ts">
	import { resolve } from '$app/paths';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import SiteHeader from '$lib/SiteHeader.svelte';
	import { Button } from '@glyphtex/ui/button';
	import { Reveal } from '@glyphtex/ui/reveal';
	import { Container, HeroBackdrop, Section } from '$lib/landing';
	import {
		IconAlertTriangle,
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
		IconStar,
		IconTerminal2
	} from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { track } from '$lib/analytics';

	const owner = 'kanakkholwal';
	const repoName = 'glyphtex';
	const repo = `https://github.com/${owner}/${repoName}`;
	const releases = `${repo}/releases`;
	const heroBackdrop = '/background-download.webp';

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
		track('download_click', { platform, asset, version: version || 'unknown' });
	}

	// macOS install helper. The build is not Apple-notarized yet, so a freshly
	// downloaded .dmg is Gatekeeper-blocked until the quarantine flag is cleared.
	// Homebrew would clear it automatically, but the cask is not published yet,
	// so the step is built and kept hidden behind this flag. Flip it to true once
	// `brew tap kanakkholwal/glyphtex` + the glyphtex cask are live.
	const showHomebrew = false;
	const brewCmd = 'brew install --cask kanakkholwal/glyphtex/glyphtex';
	const quarantineCmd = 'xattr -dr com.apple.quarantine /Applications/GlyphTeX.app';

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
			title: 'Drag GlyphTeX into Applications',
			body: 'Open the .dmg and drop GlyphTeX into your Applications folder, the same as any other Mac app.'
		},
		{
			title: 'Clear the Gatekeeper warning, once',
			body: 'GlyphTeX is not notarized by Apple yet, so the first launch can show a "GlyphTeX is damaged" or "unidentified developer" message. Run this line in Terminal to clear it. It only removes the quarantine flag macOS adds to downloaded apps.',
			code: quarantineCmd
		},
		{
			title: 'Open GlyphTeX',
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

	// Prototype scope, stated plainly. Nothing here is a promise about the current build.
	const included = [
		'The LaTeX engine, built in. No separate TeX distribution to install.',
		'An editor with live preview, file tree, search, and a command palette.',
		'A Git client: stage, commit, diff, history, clone, and push or pull.',
		'Everything runs locally, so projects stay on your disk and compile offline.',
		'No account, and the app itself sends no analytics of any kind.',
		'Missing whatever has landed in the workspace since these builds were cut.'
	];
</script>

<svelte:head>
	<title>GlyphTeX desktop app: an archived prototype</title>
	<meta
		name="description"
		content="The GlyphTeX desktop app is an unmaintained prototype. Any builds here are outdated and unsupported — use the browser workspace instead."
	/>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-screen bg-canvas font-sans text-ink antialiased selection:bg-brand-subtle">
	<div
		aria-hidden="true"
		class="landing-bg-grid landing-bg-grid-fade pointer-events-none fixed inset-0 -z-10 opacity-30"
	></div>

	<SiteHeader />

	<main>
		<!-- Full-bleed hero, same shape as the home page: photo to the viewport edges,
		     the fixed nav sitting transparently on top, copy left-aligned in the nav's
		     own gutters. `min-h-dvh` so mobile chrome can't crop the CTAs. -->
		<section class="relative min-h-dvh w-full overflow-hidden">
			<HeroBackdrop src={heroBackdrop} tone="default" wash="left" />

			<div
				class="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col justify-center px-6 pt-28 pb-16 lg:px-10"
			>
				<span
					class="border-warning/40 bg-warning/10 text-warning mb-8 inline-flex w-fit items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs font-semibold"
					in:fly={{ y: 8, duration: 500, delay: 0, easing: cubicOut }}
				>
					<IconAlertTriangle class="size-3.5" />
					Outdated prototype · not maintained
				</span>

				<div class="flex max-w-2xl flex-col items-start text-left">
					<h1
						class="landing-text-balance text-[2.5rem] leading-[1.05] font-bold tracking-[-0.025em] text-foreground sm:text-5xl md:text-[3rem]"
						in:fly={{ y: 12, duration: 600, delay: 80, easing: cubicOut }}
					>
						The desktop app is on hold.
						<span
							class="mt-2 block font-serif text-xl font-medium text-foreground/65 italic sm:text-2xl md:text-3xl"
							style="line-height: 1.15;"
						>
							Use the browser workspace.
						</span>
					</h1>

					<p
						class="landing-text-pretty mt-5 max-w-xl text-base leading-relaxed font-medium text-foreground/85 sm:text-lg"
						in:fly={{ y: 12, duration: 600, delay: 160, easing: cubicOut }}
					>
						Any builds listed below are old prototypes, kept only for reference. They lag well
						behind the current editor, get no updates, and are not supported. The browser workspace
						is where GlyphTeX is actually being built.
					</p>

					<div
						class="mt-6 flex flex-col items-start gap-3 sm:flex-row"
						in:fly={{ y: 12, duration: 600, delay: 240, easing: cubicOut }}
					>
						<Button
							href={resolve('/workspace')}
							variant="default"
							size="lg"
							class="group/cta gap-2.5"
						>
							<IconPlayerPlay class="size-4" />
							Try the workspace
							<IconArrowRight class="size-4 transition-transform group-hover/cta:translate-x-0.5" />
						</Button>
						<Button
							href={repo}
							target="_blank"
							rel="noopener noreferrer"
							variant="outline"
							size="lg"
							class="group/star gap-2"
						>
							<IconBrandGithub class="size-4" />
							Star the repo
							<IconStar
								class="size-3.5 opacity-55 transition-[color,fill,opacity] group-hover/star:fill-warning group-hover/star:text-warning group-hover/star:opacity-100"
							/>
						</Button>
					</div>

					<div
						class="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium tracking-wide text-foreground/70"
						in:fly={{ y: 8, duration: 500, delay: 320, easing: cubicOut }}
					>
						<span class="relative flex size-1.5">
							<span
								class="bg-brand/60 absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
							></span>
							<span class="bg-brand relative inline-flex size-1.5 rounded-full"></span>
						</span>
						Open source · GPLv3 · No account · No telemetry in the app
					</div>
				</div>
			</div>
		</section>

		<!--
		  Platform cards. Three columns (mac / windows / linux), each
		  detects the visitor's OS and highlights the matching card.
		  Same chip + reveal pattern as the home page sections.
		-->
		<Section bordered>
			<Container>
				<Reveal variant="up" class="mb-12 max-w-3xl">
					<span
						class="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70"
					>
						<span class="size-1.5 rounded-full bg-warning"></span>
						Archived builds
					</span>
					<h2
						class="landing-text-balance mt-5 text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-5xl"
					>
						Old prototypes. <em class="font-serif italic font-medium text-foreground/65"
							>Kept for reference only.</em
						>
					</h2>
					<p class="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
						These builds predate most of the current editor and will not be updated. Expect missing
						features and rough edges. Install one only if you want to see where the desktop shell
						got to.
					</p>
				</Reveal>

				<!--
				  Release banner. Reads as a small live status strip above the
				  cards: version + release date, "All releases" link on the right.
				-->
				<div class="mb-5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
					{#if status === 'loading'}
						<span class="flex items-center gap-2 text-muted-foreground">
							<span class="size-1.5 animate-pulse rounded-full bg-brand"></span>
							Checking the latest release&hellip;
						</span>
					{:else if status === 'ready'}
						<span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
							<span
								class="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 font-semibold text-brand"
							>
								GlyphTeX {version}
							</span>
							{#if releasedOn}<span>released {releasedOn}</span>{/if}
						</span>
					{:else}
						<span class="text-muted-foreground">Latest build info was unavailable.</span>
					{/if}
					<a
						href={releases}
						target="_blank"
						rel="noreferrer"
						class="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
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
							class={'group relative flex flex-col rounded-3xl border p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-craft-lg ' +
								(isMine
									? 'border-brand/50 ring-2 ring-brand/20 bg-card shadow-craft-sm'
									: 'border-hairline bg-card shadow-craft-sm')}
						>
							{#if isMine}
								<span
									class="absolute right-4 top-4 rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-brand"
									>Your platform</span
								>
							{/if}
							<span
								class="mb-5 grid size-12 place-items-center rounded-xl border border-hairline bg-background text-foreground transition-colors group-hover:text-brand"
							>
								<Icon class="size-6" />
							</span>
							<h3 class="text-lg font-semibold tracking-tight text-foreground">
								{p.name}
							</h3>
							<p class="mt-1 text-sm text-muted-foreground">{p.detail}</p>

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
													: 'border border-hairline bg-background text-foreground hover:bg-surface-soft')}
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
										class="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-hairline bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft"
									>
										<IconBrandGithub class="size-4" />
										{status === 'empty' ? 'Not in this release yet' : 'Find it on GitHub'}
									</a>
								{/if}
							</div>
						</Reveal>
					{/each}
				</div>
			</Container>
		</Section>

		<!--
		  macOS install guide. The build isn't Apple-notarized yet, so the
		  first launch needs one short Terminal command. Renders as a
		  `<details>` accordion so non-Mac visitors don't see it expanded.
		-->
		<Section bordered>
			<Container>
				<Reveal variant="up" class="mb-12 max-w-3xl">
					<span
						class="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70"
					>
						<span class="size-1.5 rounded-full bg-warning"></span>
						macOS · one-time step
					</span>
					<h2
						class="landing-text-balance mt-5 text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-5xl"
					>
						Clearing the <em class="font-serif italic font-medium text-foreground/65">Gatekeeper</em
						> warning.
					</h2>
					<p class="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
						The build isn't Apple-notarized yet, so the first launch needs one short Terminal
						command. Here is the whole process, start to finish.
					</p>
				</Reveal>

				<Reveal variant="up" delay={80}>
					<details
						bind:open={macOpen}
						class="group/disc overflow-hidden rounded-3xl border border-hairline bg-card shadow-craft-sm [&[open]_.chev]:rotate-180"
					>
						<summary
							class="flex cursor-pointer list-none items-center gap-4 px-6 py-5 transition-colors hover:bg-surface-soft/50 [&::-webkit-details-marker]:hidden"
						>
							<span
								class="grid size-11 shrink-0 place-items-center rounded-xl border border-hairline bg-background text-foreground"
							>
								<IconBrandApple class="size-6" />
							</span>
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<h3 class="text-lg font-semibold tracking-tight text-foreground">
										Installing on macOS
									</h3>
									<span
										class="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-warning"
										>Not notarized yet</span
									>
								</div>
								<p class="mt-0.5 text-sm text-muted-foreground">
									One short Terminal step on first launch. Requires macOS 10.15 or later.
								</p>
							</div>
							<span class="ml-auto hidden font-mono text-xs text-muted-foreground sm:block">
								{macSteps.length} steps
							</span>
							<span
								class="chev grid size-7 shrink-0 place-items-center rounded-lg border border-hairline text-muted-foreground transition-transform duration-300"
							>
								<IconChevronDown class="size-4" />
							</span>
						</summary>

						<div class="border-t border-hairline px-6 py-6">
							<div
								class="mb-6 flex items-start gap-3 rounded-xl border border-hairline bg-background/60 p-4"
							>
								<IconInfoCircle class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
								<p class="text-sm leading-relaxed text-muted-foreground">
									Apple charges for the developer ID that removes this warning, and we have not
									added it yet. The app is the same build you can read on GitHub. Until it is
									notarized, macOS needs one command to trust it. {#if showHomebrew}Homebrew (step
										1) does this for you.{/if}
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
											<h4 class="text-sm font-semibold text-foreground">{step.title}</h4>
											<p class="mt-1 text-sm leading-relaxed text-muted-foreground">
												{step.body}
											</p>

											{#if step.code}
												<div
													class="mt-3 flex items-center gap-3 rounded-lg border border-hairline bg-background py-2.5 pl-3 pr-2"
												>
													<IconTerminal2 class="size-4 shrink-0 text-muted-foreground/70" />
													<code
														class="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-xs text-foreground"
														>{step.code}</code
													>
													<button
														type="button"
														onclick={() => copyCmd(step.code!)}
														class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-mono text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-soft hover:text-foreground"
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

							<p class="mt-6 text-xs leading-relaxed text-muted-foreground">
								Prefer not to use Terminal? You can also right-click GlyphTeX in Applications,
								choose Open, and confirm once in the dialog that appears.
							</p>
						</div>
					</details>
				</Reveal>
			</Container>
		</Section>

		<!--
		  What is in the download + how to verify. Two columns: the bullet
		  list on the left, the verify card on the right. Same surface
		  treatment as the home page's showcase cards.
		-->
		<Section bordered class="bg-surface-soft/40">
			<Container>
				<div class="grid gap-12 lg:grid-cols-2">
					<Reveal variant="up">
						<span
							class="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70"
						>
							<span class="size-1.5 rounded-full bg-brand"></span>
							What the prototype had
						</span>
						<h2
							class="landing-text-balance mt-5 text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl"
						>
							One app. <em class="font-serif italic font-medium text-foreground/65"
								>Frozen where it stopped.</em
							>
						</h2>
						<ul class="mt-7 flex flex-col gap-3.5">
							{#each included as line (line)}
								<li class="flex items-start gap-3">
									<span
										class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand"
									>
										<IconCheck class="size-4" />
									</span>
									<span class="pt-1 text-sm leading-relaxed text-foreground/85">{line}</span>
								</li>
							{/each}
						</ul>
					</Reveal>

					<Reveal variant="up" delay={80}>
						<div
							class="flex h-full flex-col rounded-3xl border border-hairline bg-card p-7 shadow-craft-sm"
						>
							<span
								class="mb-5 grid size-10 place-items-center rounded-lg border border-hairline bg-background text-foreground"
							>
								<IconShieldCheck class="size-5" />
							</span>
							<h3 class="text-base font-semibold tracking-tight text-foreground">
								Verifying your download
							</h3>
							<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
								Every release on GitHub lists the build artifacts next to their checksums. Compare
								the hash of the file you downloaded against the one in the release notes before you
								run it. The full source is in the same repository if you would rather build it
								yourself.
							</p>
							<div class="mt-6 flex flex-wrap gap-3">
								<a
									href={releases}
									target="_blank"
									rel="noreferrer"
									class="inline-flex h-10 items-center gap-2 rounded-lg border border-hairline bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft"
								>
									<IconDownload class="size-4" /> All releases
								</a>
								<a
									href={repo}
									target="_blank"
									rel="noreferrer"
									class="inline-flex h-10 items-center gap-2 rounded-lg border border-hairline bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft"
								>
									<IconBrandGithub class="size-4" /> Source code
								</a>
							</div>
						</div>
					</Reveal>
				</div>
			</Container>
		</Section>

		<!--
		  Final CTA. Same closing bookend as the home page: a single
		  centered column with eyebrow + headline + body + two CTAs.
		  Reuses the `.landing-cta-panel` pattern but with the new token
		  names (`bg-card`, `border-hairline`, `text-foreground`) so the
		  surface matches the rest of the page.
		-->
		<Section>
			<Container>
				<Reveal variant="scale">
					<div
						class="relative overflow-hidden rounded-[2.2rem] border border-hairline bg-card px-6 py-20 text-center shadow-craft-sm sm:px-10 sm:py-24"
					>
						<span
							class="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70"
						>
							<span class="size-1.5 rounded-full bg-brand"></span>
							Where the work is
						</span>
						<h2
							class="landing-text-balance mt-4 max-w-3xl mx-auto text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-5xl"
						>
							A real release <em class="font-serif italic font-medium text-foreground/65"
								>comes later</em
							>.
						</h2>
						<p
							class="landing-text-pretty mt-5 max-w-md mx-auto text-base leading-relaxed text-muted-foreground sm:text-lg"
						>
							Development is happening in the browser workspace first. Watch the repository to hear
							when the desktop app is picked back up.
						</p>
						<div class="mt-9 flex flex-wrap justify-center gap-3">
							<Button
								href={repo}
								target="_blank"
								rel="noreferrer"
								variant="outline"
								size="lg"
								class="gap-2"
							>
								<IconBrandGithub class="size-4" /> Watch on GitHub
							</Button>
							<Button href={resolve('/workspace')} variant="default" size="lg" class="gap-2">
								Open the browser workspace
								<IconArrowRight class="size-4" />
							</Button>
						</div>
					</div>
				</Reveal>
			</Container>
		</Section>
	</main>

	<SiteFooter />
</div>
