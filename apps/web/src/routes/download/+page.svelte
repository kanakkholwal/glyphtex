<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import { REPO_SLUG, REPO_URL } from "$lib/landing/nav-data";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow, SplitSection } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { Skeleton } from "@glyphtex/ui/skeleton";
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
		IconFlask,
		IconTerminal2
	} from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	const releases = `${REPO_URL}/releases`;

	type OS = "mac" | "windows" | "linux";
	let detected = $state<OS | null>(null);

	type Asset = { name: string; url: string; size: number; kind: string };
	type Grouped = Record<OS, Asset[]>;

	let status = $state<"loading" | "ready" | "empty" | "error">("loading");
	let version = $state("");
	let publishedAt = $state("");
	let assets = $state<Grouped>({ mac: [], windows: [], linux: [] });

	const releasedOn = $derived(
		publishedAt
			? new Date(publishedAt).toLocaleDateString("en-GB", {
					year: "numeric",
					month: "long",
					day: "numeric"
				})
			: ""
	);

	// Older builds shipped as "GlyphX"; the quarantine command must name the real bundle.
	const appName = $derived(assets.mac[0]?.name.split("_")[0] || "GlyphTeX");
	const quarantineCmd = $derived(`xattr -dr com.apple.quarantine /Applications/${appName}.app`);

	function humanSize(bytes: number) {
		if (!bytes) return "";
		const mb = bytes / 1024 / 1024;
		return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
	}

	function archLabel(n: string) {
		if (n.includes("aarch64") || n.includes("arm64")) return "Apple silicon";
		if (n.includes("x64") || n.includes("x86_64") || n.includes("intel")) return "Intel";
		return "Universal";
	}

	// Skips updater bundles, signatures and the manifest, which are not direct downloads.
	function classify(name: string): { os: OS; kind: string } | null {
		const n = name.toLowerCase();
		if (n.endsWith(".sig") || n.endsWith(".json") || n.endsWith(".app.tar.gz")) return null;
		if (n.endsWith(".dmg")) return { os: "mac", kind: `${archLabel(n)} (.dmg)` };
		if (n.endsWith(".exe")) return { os: "windows", kind: "Installer (.exe)" };
		if (n.endsWith(".msi")) return { os: "windows", kind: "Installer (.msi)" };
		if (n.endsWith(".appimage")) return { os: "linux", kind: "AppImage" };
		if (n.endsWith(".deb")) return { os: "linux", kind: "Debian (.deb)" };
		return null;
	}

	// The GitHub response is untrusted and feeds a download href, so it is narrowed here (AGENTS.md #4).
	type RawAsset = { name: string; browser_download_url: string; size: number };
	type RawRelease = { tag_name: string; published_at: string; assets: RawAsset[] };

	function parseRelease(data: unknown): RawRelease {
		if (!data || typeof data !== "object") throw new Error("Malformed release response.");
		const o = data as Record<string, unknown>;
		const assets: RawAsset[] = Array.isArray(o.assets)
			? o.assets.flatMap((raw): RawAsset[] => {
					if (!raw || typeof raw !== "object") return [];
					const a = raw as Record<string, unknown>;
					const name = a.name;
					const url = a.browser_download_url;
					if (typeof name !== "string" || typeof url !== "string") return [];
					if (!url.startsWith("https://")) return [];
					return [
						{ name, browser_download_url: url, size: typeof a.size === "number" ? a.size : 0 }
					];
				})
			: [];
		return {
			tag_name: typeof o.tag_name === "string" ? o.tag_name : "",
			published_at: typeof o.published_at === "string" ? o.published_at : "",
			assets
		};
	}

	async function loadLatestRelease() {
		try {
			const res = await fetch(`https://api.github.com/repos/${REPO_SLUG}/releases/latest`, {
				headers: { Accept: "application/vnd.github+json" }
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
			status = total > 0 ? "ready" : "empty";
		} catch {
			status = "error";
		}
	}

	function trackDownload(platform: string, asset: string) {
		track("download_clicked", { platform, asset, version: version || "unknown" });
	}

	let copied = $state(false);
	let macOpen = $state(false);

	async function copyCmd() {
		try {
			await navigator.clipboard.writeText(quarantineCmd);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			// Clipboard can be blocked; the command stays selectable in the code block.
		}
	}

	onMount(() => {
		const ua = navigator.userAgent.toLowerCase();
		if (ua.includes("mac")) detected = "mac";
		else if (ua.includes("win")) detected = "windows";
		else if (ua.includes("linux") || ua.includes("x11")) detected = "linux";
		macOpen = detected === "mac";
		loadLatestRelease();
	});

	const platforms = [
		{
			id: "mac" as const,
			icon: IconBrandApple,
			name: "macOS",
			detail: "Apple silicon and Intel, macOS 10.15 or later"
		},
		{
			id: "windows" as const,
			icon: IconBrandWindows,
			name: "Windows",
			detail: "Windows 10 and 11, 64-bit"
		},
		{
			id: "linux" as const,
			icon: IconBrandDebian,
			name: "Linux",
			detail: "AppImage and .deb, x86_64"
		}
	];

	const macSteps = $derived([
		{
			title: "Download the .dmg for your chip",
			body: "Apple silicon for M1 and later, Intel for older Macs. Check under Apple menu, About This Mac."
		},
		{
			title: `Drag ${appName} into Applications`,
			body: "Open the .dmg and drop the app into your Applications folder, the same as any other Mac app."
		},
		{
			title: "Clear the Gatekeeper warning, once",
			body: "The build is not notarized, so the first launch can say it is damaged or from an unidentified developer. This line clears the quarantine flag.",
			code: true
		},
		{
			title: "Open it",
			body: "Launch from Applications or Spotlight. Reinstalling from a .dmg brings the warning back, so run the line again."
		}
	]);

	// What the old builds contained. Nothing here describes a current or future release.
	const included = [
		"The LaTeX engine, built in.",
		"Live preview, file tree, search, command palette.",
		"A Git client: stage, commit, diff, history, push.",
		"Runs locally and compiles offline.",
		"No account and no analytics."
	];
</script>

<Seo
	title="GlyphTeX desktop app"
	description="The GlyphTeX desktop app for offline LaTeX. The desktop build is an early prototype; for everyday use, the browser workspace is the maintained option."
	canonical="/download"
/>

<RailFrame>
	<RailRow divider={false} label="Desktop app">
		<PageHero
			title="The desktop app"
			accent="is an unmaintained prototype"
			lede="Use the browser workspace for real work. The desktop builds below are old prototypes: unsupported, missing most of the current editor, and kept only for reference."
		>
			{#snippet actions()}
				<Button href={resolve('/workspace')} variant="primary">
					Open the workspace
					<IconArrowRight />
				</Button>
				<Button href={REPO_URL} target="_blank" rel="noopener noreferrer" variant="outline">
					<IconBrandGithub />
					View the source
				</Button>
			{/snippet}
		</PageHero>
	</RailRow>

	<RailRow label="Old builds">
		<SplitSection
			title="Old builds,"
			accent="for reference only"
			description="These predate most of the current editor and will not be updated. There is no release date for a maintained desktop app."
		>
			{#snippet aside()}
				<div class="flex flex-col gap-3">
					<p
						class="flex w-fit items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-body text-foreground"
					>
						<IconAlertTriangle class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
						<span><span class="font-semibold">Unsupported.</span> Bugs in these builds will not be fixed.</span>
					</p>
					<p class="text-body text-muted-foreground" aria-live="polite">
						{#if status === 'loading'}
							Checking GitHub for the latest build...
						{:else if status === 'ready'}
							Latest build: <span class="font-medium text-foreground">{version}</span>{#if releasedOn}, released {releasedOn}{/if}.
						{:else if status === 'empty'}
							The latest release on GitHub has no desktop files attached.
						{:else}
							Could not reach GitHub. The releases page lists every build.
						{/if}
					</p>
					<a
						href={releases}
						target="_blank"
						rel="noopener noreferrer"
						class="flex min-h-10 w-fit items-center gap-1.5 rounded-md text-body font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
					>
						All releases on GitHub
						<IconArrowRight class="size-4" aria-hidden="true" />
					</a>
				</div>
			{/snippet}

			<ul class="grid grid-cols-1 gap-3 md:grid-cols-3">
				{#each platforms as p (p.id)}
					{@const items = assets[p.id]}
					<li class="panel-card flex flex-col p-5">
						<div class="flex items-start justify-between gap-3">
							<span
								class="grid size-10 place-items-center rounded-lg border border-border bg-background text-foreground"
							>
								<p.icon class="size-5" aria-hidden="true" />
							</span>
							{#if detected === p.id}
								<span
									class="flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-caption font-medium text-foreground"
								>
									<IconCheck class="size-3.5 text-primary" aria-hidden="true" />
									Your platform
								</span>
							{/if}
						</div>
						<h3 class="mt-4 text-body-lg font-medium text-foreground">{p.name}</h3>
						<p class="mt-1 text-body text-muted-foreground">{p.detail}</p>

						<div class="mt-5 flex flex-1 flex-col justify-end gap-2">
							{#if status === 'loading'}
								<Skeleton class="h-11 w-full rounded-md" />
							{:else if status === 'ready' && items.length > 0}
								{#each items as a (a.name)}
									<a
										href={a.url}
										rel="noopener noreferrer"
										title={a.name}
										onclick={() => trackDownload(p.id, a.name)}
										class="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border bg-card px-3 text-body font-medium text-foreground outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring dark:bg-background"
									>
										<span class="flex items-center gap-2">
											<IconDownload class="size-4" aria-hidden="true" />
											{a.kind}
										</span>
										{#if a.size}<span class="text-caption text-muted-foreground">{humanSize(a.size)}</span>{/if}
									</a>
								{/each}
							{:else}
								<a
									href={releases}
									target="_blank"
									rel="noopener noreferrer"
									onclick={() => trackDownload(p.id, 'releases_page')}
									class="flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-body font-medium text-foreground outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring dark:bg-background"
								>
									<IconBrandGithub class="size-4" aria-hidden="true" />
									{status === 'empty' ? 'Not in this release' : 'Find it on GitHub'}
								</a>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</SplitSection>
	</RailRow>

	<RailRow label="Installing on macOS">
		<SplitSection
			title="Opening it on macOS"
			accent="takes one command"
			description="The build is not notarized by Apple, so the first launch needs a Terminal line or a right-click Open."
		>
			<details bind:open={macOpen} class="group panel-card overflow-hidden">
				<summary
					class="flex min-h-14 cursor-pointer list-none items-center gap-4 rounded-2xl px-5 py-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden"
				>
					<span
						class="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-background text-foreground"
					>
						<IconBrandApple class="size-5" aria-hidden="true" />
					</span>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="text-body-lg font-medium text-foreground">Installing on macOS</span>
						<span class="text-body text-muted-foreground">{macSteps.length} steps, about a minute</span>
					</span>
					<IconChevronDown
						class="size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-craft group-open:rotate-180"
						aria-hidden="true"
					/>
				</summary>

				<div class="border-t border-border px-5 py-6">
					<ol class="flex flex-col gap-5">
						{#each macSteps as step, i (step.title)}
							<li class="flex gap-4">
								<span
									class="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-background text-caption font-semibold tabular-nums text-foreground"
								>
									{i + 1}
								</span>
								<div class="min-w-0 flex-1">
									<h3 class="text-body font-semibold text-foreground">{step.title}</h3>
									<p class="mt-1 text-body text-muted-foreground">{step.body}</p>
									{#if step.code}
										<div
											class="mt-3 flex items-center gap-3 rounded-lg border border-border bg-background py-1 pr-1 pl-3"
										>
											<IconTerminal2 class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
											<code class="min-w-0 flex-1 overflow-x-auto font-mono text-caption whitespace-pre text-foreground"
												>{quarantineCmd}</code
											>
											<Button variant="ghost" onclick={copyCmd} aria-label="Copy command">
												{#if copied}
													<IconCheck class="text-success" aria-hidden="true" /> Copied
												{:else}
													<IconCopy aria-hidden="true" /> Copy
												{/if}
											</Button>
										</div>
									{/if}
								</div>
							</li>
						{/each}
					</ol>
					<p class="mt-6 text-body text-muted-foreground">
						Prefer not to use Terminal? Right-click the app in Applications, choose Open, and confirm
						once in the dialog.
					</p>
				</div>
			</details>
		</SplitSection>
	</RailRow>

	<RailRow label="What the prototype had">
		<SplitSection
			title="What the prototype had,"
			accent="frozen where it stopped"
			description="Everything shipped in the browser workspace since these builds were cut is missing from them."
		>
			<div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
				<ul class="panel-card flex flex-col gap-3 p-5 sm:p-6">
					{#each included as line (line)}
						<li class="flex items-start gap-3 text-body text-foreground">
							<IconCheck class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
							{line}
						</li>
					{/each}
				</ul>
				<div class="panel-card flex flex-col p-5 sm:p-6">
					<span
						class="grid size-10 place-items-center rounded-lg border border-border bg-background text-foreground"
					>
						<IconFlask class="size-5" aria-hidden="true" />
					</span>
					<h3 class="mt-4 text-body-lg font-medium text-foreground">Checking a download</h3>
					<p class="mt-2 text-pretty text-body text-muted-foreground">
						The releases do not publish checksums yet, and the installers are not code-signed for macOS or Windows. If that matters
						for your machine, build the app from source: the desktop app lives in
						<code class="rounded-sm bg-muted px-1 font-mono text-caption text-foreground">apps/desktop</code>
						of the same repository.
					</p>
					<div class="mt-5">
						<Button href={REPO_URL} target="_blank" rel="noopener noreferrer" variant="outline">
							<IconBrandGithub />
							Source code
						</Button>
					</div>
				</div>
			</div>
		</SplitSection>
	</RailRow>

	<RailRow label="Where the work is">
		<BrandPanel
			title="A real release comes later."
			body="Development happens in the browser workspace first. Watch the repository to hear when the desktop app is picked back up."
		>
			{#snippet actions()}
				<Button href={resolve('/workspace')} variant="ink">Open the workspace</Button>
				<Button href={REPO_URL} target="_blank" rel="noopener noreferrer" variant="light">
					<IconBrandGithub />
					Watch on GitHub
				</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
