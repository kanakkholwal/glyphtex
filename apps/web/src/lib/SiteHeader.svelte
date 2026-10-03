<script lang="ts">
	import { resolve } from "$app/paths";
	import type { ResolvedPathname } from "$app/types";
	import { page } from "$app/state";
	import { track } from "$lib/analytics";
	import { footerSocials, navLinks, REPO_URL } from "$lib/landing/nav-data";
	import { Button } from "@glyphtex/ui/button";
	import { Logo } from "@glyphtex/ui/logo";
	import { MegaNavbar } from "@glyphtex/ui/mega-navbar";
	import { ThemeToggle } from "@glyphtex/ui/theme-toggle";
	import { IconBrandGithub, IconBrandX } from "@tabler/icons-svelte";

	const home = resolve("/");
	const repo = REPO_URL;
	const xHref = footerSocials.find((s) => s.label === "Twitter")?.href;
	const format = new Intl.NumberFormat("en", { notation: "compact" });

	// Streamed from the root layout; null hides the count rather than showing a guess.
	const stars = $derived(page.data.stars as Promise<number | null> | undefined);

	const resolveAny = resolve as (route: string) => ResolvedPathname;
	function hrefFor(href: string, external = false): ResolvedPathname | string {
		if (external) return href;
		// Internal paths must start with a single `/` and have no scheme.
		if (!href.startsWith("/") || href.startsWith("//")) return href;
		return resolveAny(href);
	}

	const resolvedLinks = $derived(
		navLinks.map((link) => ({ ...link, href: hrefFor(link.href, link.external) }))
	);
</script>

{#snippet brand()}
	<a
		href={home}
		class="-m-1.5 flex items-center rounded-md p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
		aria-label="GlyphTeX home"
	>
		<Logo size={26} badge text={true} class="text-body-lg" />
	</a>
{/snippet}

{#snippet actions()}
	<Button
		href={repo}
		target="_blank"
		rel="noopener noreferrer"
		variant="ghost"
		class="gap-1.5 px-3 hover:bg-foreground/[0.06]"
		onclick={() => track('outbound_clicked', { destination: 'github', location: 'nav' })}
	>
		<IconBrandGithub class="size-4" aria-hidden="true" />
		<span class="sr-only">GlyphTeX on GitHub</span>
		{#await stars then count}
			{#if typeof count === 'number'}
				<span class="tabular-nums">{format.format(count)}<span class="sr-only"> stars</span></span>
			{/if}
		{/await}
	</Button>
	{#if xHref}
		<Button
			href={xHref}
			target="_blank"
			rel="noopener noreferrer"
			variant="ghost"
			size="icon"
			aria-label="GlyphTeX on X"
			class="hidden sm:inline-flex hover:bg-foreground/[0.06]"
			onclick={() => track('outbound_clicked', { destination: 'twitter', location: 'nav' })}
		>
			<IconBrandX class="size-4" aria-hidden="true" />
		</Button>
	{/if}
	<ThemeToggle size="icon" class="hidden sm:inline-flex hover:bg-foreground/[0.06]" />
	<Button
		href={resolve('/workspace')}
		variant="default"
		class="hidden shadow-none xl:inline-flex"
		onclick={() => track('cta_clicked', { target: 'workspace', location: 'nav' })}
	>
		Open the workspace
	</Button>
{/snippet}

{#snippet mobileActions()}
	<Button
		href={resolve('/workspace')}
		variant="default"
		class="shadow-none"
		onclick={() => track('cta_clicked', { target: 'workspace', location: 'nav' })}
	>
		Open the workspace
	</Button>
	<div class="flex items-center justify-between gap-4 px-2 pt-1">
		<span class="text-body font-medium text-foreground">Theme</span>
		<ThemeToggle size="icon" />
	</div>
{/snippet}

<MegaNavbar
	brand={brand}
	groups={[]}
	links={resolvedLinks}
	actions={actions}
	mobileActions={mobileActions}
	active={page.url.pathname}
	class="fixed"
/>
