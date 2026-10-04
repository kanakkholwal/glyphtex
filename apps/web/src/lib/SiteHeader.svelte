<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { track } from "$lib/analytics";
	import { navLinks, REPO_URL } from "$lib/landing/nav-data";
	import { openSiteCommand } from "$lib/site/command";
	import { Button } from "@glyphtex/ui/button";
	import { Logo } from "@glyphtex/ui/logo";
	import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@glyphtex/ui/sheet";
	import { shortcutCap } from "@glyphtex/ui/shortcut";
	import { ThemeToggle } from "@glyphtex/ui/theme-toggle";
	import { IconBrandGithub, IconMenu2, IconSearch } from "@tabler/icons-svelte";

	const home = resolve("/");
	const format = new Intl.NumberFormat("en", { notation: "compact" });

	// From the root layout; null hides the count rather than showing a guess.
	const stars = $derived(typeof page.data.stars === "number" ? page.data.stars : null);

	let menuOpen = $state(false);
	// Apple glyph after hydration only; SSR and first paint say Ctrl.
	let mod = $state("Ctrl");
	$effect(() => {
		if (/Mac|iPhone|iPad/.test(navigator.platform)) mod = "⌘";
	});

	const resolveAny = resolve as (route: string) => string;
	const isCurrent = (href: string) => href !== "/" && page.url.pathname.startsWith(href);
</script>

{#snippet githubButton(location: string)}
	<Button
		href={REPO_URL}
		target="_blank"
		rel="noopener noreferrer"
		variant="ghost"
		size="sm"
		class="text-muted-foreground"
		onclick={() => track('outbound_clicked', { destination: 'github', location })}
	>
		<IconBrandGithub aria-hidden="true" />
		<span class="sr-only">GlyphTeX on GitHub</span>
		{#if stars !== null}
			<span class="font-mono tabular-nums">{format.format(stars)}<span class="sr-only"> stars</span></span>
		{/if}
	</Button>
{/snippet}

<header
	class="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-dashed border-border bg-background/85 px-5 backdrop-blur-md sm:px-6 lg:px-10"
>
	<a
		href={home}
		class="-m-1.5 flex shrink-0 items-center rounded-md p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
		aria-label="GlyphTeX home"
	>
		<Logo size={24} badge text={true} class="text-base" />
	</a>

	<nav aria-label="Primary" class="ml-4 hidden md:block">
		<ul class="flex items-center gap-1">
			{#each navLinks as link (link.href)}
				{@const current = isCurrent(link.href)}
				<li>
					<a
						href={resolveAny(link.href)}
						aria-current={current ? 'page' : undefined}
						class={[
							'inline-flex h-8 items-center rounded-lg px-2.5 text-sm outline-none transition-colors duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-ring',
							current
								? 'font-medium text-foreground'
								: 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground'
						]}
					>
						{link.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="ml-auto flex items-center gap-1">
		<button
			type="button"
			onclick={openSiteCommand}
			class="hidden h-8 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground outline-none transition-[color,background-color,scale] duration-(--duration-fast) hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-(--press-scale-sm) sm:flex"
		>
			<IconSearch class="size-4" aria-hidden="true" />
			Search
			<span class="flex items-center gap-1" aria-hidden="true">
				<kbd class={shortcutCap({ size: 'md' })}>{mod}</kbd>
				<kbd class={shortcutCap({ size: 'md' })}>K</kbd>
			</span>
		</button>
		<span aria-hidden="true" class="mx-1.5 hidden h-4 w-px bg-border sm:block"></span>
		<span class="hidden sm:contents">{@render githubButton('nav')}</span>
		<ThemeToggle size="icon-sm" class="text-muted-foreground" />
		<Button
			href={resolve('/workspace')}
			variant="dark"
			size="sm"
			class="ml-2 hidden sm:inline-flex"
			onclick={() => track('cta_clicked', { target: 'workspace', location: 'nav' })}
		>
			Open the editor
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			class="md:hidden"
			aria-label="Open menu"
			aria-expanded={menuOpen}
			onclick={() => (menuOpen = true)}
		>
			<IconMenu2 />
		</Button>
	</div>
</header>

<Sheet bind:open={menuOpen}>
	<SheetContent side="right" class="flex w-[min(20rem,85vw)] flex-col gap-0 p-0">
		<SheetHeader class="border-b border-dashed border-border px-5 py-4">
			<SheetTitle>
				<Logo size={22} badge text={true} class="text-base" />
			</SheetTitle>
		</SheetHeader>
		<nav aria-label="Mobile" class="flex-1 overflow-y-auto p-3">
			<ul class="flex flex-col">
				{#each navLinks as link (link.href)}
					<li>
						<a
							href={resolveAny(link.href)}
							aria-current={isCurrent(link.href) ? 'page' : undefined}
							onclick={() => (menuOpen = false)}
							class="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-foreground transition-colors hover:bg-foreground/[0.06] aria-[current=page]:bg-foreground/[0.06]"
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
		<div class="flex flex-col gap-2 border-t border-dashed border-border p-4">
			<Button
				href={resolve('/workspace')}
				variant="dark"
				onclick={() => {
					track('cta_clicked', { target: 'workspace', location: 'nav' });
					menuOpen = false;
				}}
			>
				Open the editor
			</Button>
			<div class="flex items-center justify-between">
				{@render githubButton('nav_mobile')}
				<button
					type="button"
					class="h-8 rounded-lg px-2 text-sm text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
					onclick={() => {
						menuOpen = false;
						openSiteCommand();
					}}
				>
					Search
				</button>
			</div>
		</div>
	</SheetContent>
</Sheet>
