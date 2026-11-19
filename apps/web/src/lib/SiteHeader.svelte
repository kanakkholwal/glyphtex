<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { track } from "$lib/analytics";
	import { REPO_URL } from "$lib/landing/nav-data";
	import DotArt from "$lib/landing/DotArt.svelte";
	import { art } from "$lib/landing/art";
	import { menus } from "$lib/site/menus";
	import RollText from "$lib/site/RollText.svelte";
	import { openSiteCommand } from "$lib/site/command";
	import { repoStars } from "$lib/stars.svelte";
	import { Button } from "@glyphtex/ui/button";
	import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@glyphtex/ui/collapsible";
	import { Logo } from "@glyphtex/ui/logo";
	import {
		NavigationMenu,
		NavigationMenuContent,
		NavigationMenuItem,
		NavigationMenuLink,
		NavigationMenuList,
		NavigationMenuTrigger
	} from "@glyphtex/ui/navigation-menu";
	import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@glyphtex/ui/sheet";
	import { shortcutCap } from "@glyphtex/ui/shortcut";
	import { ThemeToggle } from "@glyphtex/ui/theme-toggle";
	import { IconBrandGithub, IconMenu2, IconSearch } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	const home = resolve("/");
	const format = new Intl.NumberFormat("en", { notation: "compact" });

	// Client-side so every page, prerendered or not, shows the same live count; null hides it.
	const stars = $derived(repoStars.value);
	onMount(() => repoStars.load());

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

<header class="sticky top-3 z-40 px-3 sm:px-5 lg:px-8">
	<div class="mx-auto max-w-[72rem] rounded-full bg-card p-1 shadow-(--surface-shadow)">
		<div
			class="grid h-14 grid-cols-[1fr_auto] items-center gap-3 rounded-full bg-background pr-2 pl-5 lg:grid-cols-[auto_1fr_auto] dark:bg-popover"
		>
			<a
				href={home}
				class="-m-1.5 flex shrink-0 items-center rounded-md p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label="GlyphTeX home"
			>
				<Logo size={24} badge text={true} class="text-base" />
			</a>

			<div class="hidden justify-self-center lg:block">
				<NavigationMenu variant="framed" aria-label="Primary">
					<NavigationMenuList class="gap-1">
						{#each menus as menu (menu.label)}
							<NavigationMenuItem value={menu.label}>
								<NavigationMenuTrigger class="rounded-full text-muted-foreground">
									{menu.label}
								</NavigationMenuTrigger>
								<NavigationMenuContent>
									<div class="grid w-[min(44rem,calc(100vw-23rem))] grid-cols-[13rem_1fr] gap-1">
										<a
											href={resolveAny(menu.feature.href)}
											onclick={() => track('cta_clicked', { target: menu.feature.href, location: 'mega_menu_feature' })}
											class="group/feature relative flex min-h-64 flex-col justify-between gap-6 overflow-hidden rounded-xl bg-muted p-5 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<DotArt
												rows={[...art[menu.feature.art]]}
												class="h-16 w-auto self-start"
											/>
											<span class="block">
<span class="relative block text-lg leading-tight font-medium">{menu.feature.title}</span>
											<span class="relative mt-2 block text-sm text-pretty text-muted-foreground">{menu.feature.desc}</span>
											<span class="relative mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-ink">
												{menu.feature.cta}
												<span aria-hidden="true">→</span>
											</span>
										</span>
</a>
										<ul class={['grid content-start gap-x-2 gap-y-0.5 p-2', menu.items.length > 3 && 'sm:grid-cols-2']}>
											{#each menu.items as item (item.href + item.label)}
												<li>
													<NavigationMenuLink
														href={resolveAny(item.href)}
														class="flex-row items-start gap-3 rounded-xl p-3"
														onclick={() => track('cta_clicked', { target: item.href, location: 'mega_menu' })}
													>
														<span
															class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-accent-ink"
															aria-hidden="true"
														>
															<item.icon class="size-4" />
														</span>
														<span class="min-w-0">
															<span class="block text-sm font-medium text-foreground">{item.label}</span>
															<span class="mt-0.5 block text-xs text-pretty text-muted-foreground">{item.desc}</span>
														</span>
													</NavigationMenuLink>
												</li>
											{/each}
										</ul>
									</div>
									{#if menu.strip}
										<div class="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl bg-muted px-5 py-3 text-sm">
											<span class="text-muted-foreground">{menu.strip.label}</span>
											{#each menu.strip.links as link (link.href)}
												<a
													href={resolveAny(link.href)}
													class="text-foreground transition-colors duration-(--duration-fast) hover:text-accent-ink"
												>
													{link.label}
												</a>
											{/each}
										</div>
									{/if}
								</NavigationMenuContent>
							</NavigationMenuItem>
						{/each}
					</NavigationMenuList>
				</NavigationMenu>
			</div>

			<div class="flex items-center justify-end gap-1">
				<button
					type="button"
					onclick={openSiteCommand}
					class="hidden h-9 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground outline-none transition-[color,background-color,scale] duration-(--duration-fast) hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-(--press-scale-sm) sm:flex"
				>
					<IconSearch class="size-4" aria-hidden="true" />
					<span class="sr-only">Search</span>
					<span class="flex items-center gap-1 max-2xl:hidden" aria-hidden="true">
						<kbd class={shortcutCap()}>{mod}</kbd>
						<kbd class={shortcutCap()}>K</kbd>
					</span>
				</button>
				<span class="hidden sm:contents">{@render githubButton('nav')}</span>
				<ThemeToggle size="icon-sm" class="text-muted-foreground" />
				<Button
					href={resolve('/workspace')}
					variant="dark"
					size="default"
					class="ml-1 hidden rounded-full px-5 sm:inline-flex"
					onclick={() => track('cta_clicked', { target: 'workspace', location: 'nav' })}
				>
					Open the editor
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					class="lg:hidden"
					aria-label="Open menu"
					aria-expanded={menuOpen}
					onclick={() => (menuOpen = true)}
				>
					<IconMenu2 />
				</Button>
			</div>
		</div>
	</div>
</header>

<Sheet bind:open={menuOpen}>
	<SheetContent side="right" class="font-public flex w-[min(20rem,85vw)] flex-col gap-0 p-0">
		<SheetHeader class="border-b border-dashed border-border px-5 py-4">
			<SheetTitle>
				<Logo size={22} badge text={true} class="text-base" />
			</SheetTitle>
			<SheetClose class="-mr-2" />
		</SheetHeader>
		<nav aria-label="Mobile" class="flex-1 overflow-y-auto p-3">
			{#each menus as menu (menu.label)}
				<Collapsible class="border-b border-border last:border-b-0">
					<CollapsibleTrigger class="min-h-12 px-3 text-base">{menu.label}</CollapsibleTrigger>
					<CollapsibleContent>
						<ul class="flex flex-col pb-3 pl-3">
							{#each menu.items as item (item.href + item.label)}
								<li>
									<a
										href={resolveAny(item.href)}
										aria-current={isCurrent(item.href) ? 'page' : undefined}
										onclick={() => (menuOpen = false)}
										class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-foreground transition-colors hover:bg-foreground/[0.06] aria-[current=page]:bg-foreground/[0.06]"
									>
										<item.icon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
										{item.label}
									</a>
								</li>
							{/each}
						</ul>
					</CollapsibleContent>
				</Collapsible>
			{/each}
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
