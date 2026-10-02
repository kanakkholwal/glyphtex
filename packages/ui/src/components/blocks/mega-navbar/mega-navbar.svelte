<script lang="ts">
	import type { Snippet } from "svelte";
	import { IconChevronDown, IconMenu2 } from "@tabler/icons-svelte";
	import Collapsible from "../../ui/collapsible/collapsible.svelte";
	import CollapsibleContent from "../../ui/collapsible/collapsible-content.svelte";
	import Sheet from "../../ui/sheet/sheet.svelte";
	import SheetContent from "../../ui/sheet/sheet-content.svelte";
	import SheetHeader from "../../ui/sheet/sheet-header.svelte";
	import SheetTitle from "../../ui/sheet/sheet-title.svelte";
	import { cn } from "@glyphtex/ui/utils";
	import MegaMenu from "./mega-menu.svelte";
	import type { MegaMenuGroup, MegaNavLink } from "./types";
	import { megaNavbar, type MegaNavbarVariant } from "./variants";

	let {
		brand,
		groups,
		links = [],
		actions,
		mobileActions,
		active,
		sticky = true,
		blur = true,
		variant = "solid",
		class: className
	}: {
		brand?: Snippet;
		groups: MegaMenuGroup[];
		links?: MegaNavLink[];
		actions?: Snippet;
		mobileActions?: Snippet;
		active?: string;
		sticky?: boolean;
		blur?: boolean;
		variant?: MegaNavbarVariant;
		class?: string;
	} = $props();

	function isCurrent(href: string) {
		if (!active) return false;
		return active === href || active.startsWith(`${href}/`);
	}

	let scrolled = $state(false);
	const styles = $derived(
		megaNavbar({
			variant,
			sticky,
			surface: scrolled ? (blur ? "blurred" : "opaque") : "clear"
		})
	);
	let mobileOpen = $state(false);
	let openMobileGroup = $state(0);

	// Navigating from inside the sheet should leave it closed.
	$effect(() => {
		void active;
		mobileOpen = false;
	});

	const footerActions = $derived(mobileActions ?? actions);
</script>

<svelte:window
	onscroll={() => {
		if (sticky) scrolled = window.scrollY > 8;
	}}
/>

{#snippet brandSlot()}
	{#if brand}
		<span class="flex shrink-0 items-center gap-2.5 py-1 pr-2">{@render brand()}</span>
	{/if}
{/snippet}

{#snippet desktopMenu()}
	<MegaMenu {groups} {active} {variant} class="hidden @3xl:flex" />
{/snippet}

{#snippet linkList()}
	<ul class="flex items-center gap-1">
		{#each links as link (link.href)}
			<li>
				<a
					href={link.href}
					target={link.external ? '_blank' : undefined}
					rel={link.external ? 'noreferrer' : undefined}
					aria-current={isCurrent(link.href) ? 'page' : undefined}
					class={styles.link({ current: isCurrent(link.href) })}
				>
					{link.label}
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet menuButton()}
	<button
		type="button"
		onclick={() => (mobileOpen = true)}
		aria-expanded={mobileOpen}
		aria-label="Open menu"
		class={styles.menuButton()}
	>
		<IconMenu2 class="size-5" aria-hidden="true" />
	</button>
{/snippet}

<div data-slot="mega-navbar" data-variant={variant} class={cn(styles.root(), className)}>
	<nav aria-label="Primary" class={styles.nav()}>
		{@render brandSlot()}
		<div class="hidden flex-1 items-center justify-center @3xl:flex">
			{@render desktopMenu()}
			{@render linkList()}
		</div>
		<div class="ml-auto flex shrink-0 items-center gap-2 @3xl:ml-0">
			{#if actions}
				<span class="hidden items-center gap-2 @3xl:flex">{@render actions()}</span>
			{/if}
			{@render menuButton()}
		</div>
	</nav>
</div>

<Sheet bind:open={mobileOpen}>
	<SheetContent side="right" class={styles.sheet()}>
		<SheetHeader class="border-border border-b px-5 py-4">
			<SheetTitle class="flex items-center gap-2.5">
				{#if brand}{@render brand()}{/if}
			</SheetTitle>
		</SheetHeader>
		<nav aria-label="Mobile" class="flex-1 overflow-y-auto px-3 py-3">
			{#each groups as group, i (group.label)}
				{@const isOpen = openMobileGroup === i}
				<Collapsible open={isOpen} class="border-border border-b last:border-b-0">
					<button
						type="button"
						aria-expanded={isOpen}
						onclick={() => (openMobileGroup = openMobileGroup === i ? -1 : i)}
						class="flex min-h-12 w-full items-center justify-between gap-4 px-2 text-left font-medium text-foreground"
					>
						{group.label}
						<IconChevronDown class={styles.mobileChevron({ open: isOpen })} aria-hidden="true" />
					</button>
					<CollapsibleContent class="px-0 pb-2">
						<ul>
							{#each group.items as item (item.href)}
								<li>
									<a
										href={item.href}
										target={item.external ? '_blank' : undefined}
										rel={item.external ? 'noreferrer' : undefined}
										onclick={() => (mobileOpen = false)}
										aria-current={isCurrent(item.href) ? 'page' : undefined}
										class={styles.mobileItem({ current: isCurrent(item.href) })}
									>
										{#if item.icon}
											<span class="shrink-0 text-muted-foreground [&_svg]:size-4">
												{@render item.icon()}
											</span>
										{/if}
										<span class="min-w-0 flex-1">
											<span class="flex items-center gap-1 font-medium text-foreground text-sm">
												{item.label}
											</span>
											{#if item.description}
												<span class="mt-0.5 block text-muted-foreground text-xs">{item.description}</span>
											{/if}
										</span>
									</a>
								</li>
							{/each}
						</ul>
					</CollapsibleContent>
				</Collapsible>
			{/each}
			<ul class="mt-1 pt-1">
				{#each links as link (link.href)}
					<li>
						<a
							href={link.href}
							target={link.external ? '_blank' : undefined}
							rel={link.external ? 'noreferrer' : undefined}
							onclick={() => (mobileOpen = false)}
							aria-current={isCurrent(link.href) ? 'page' : undefined}
							class={styles.mobileLink({ current: isCurrent(link.href) })}
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
		{#if footerActions}
			<div class="mt-auto flex flex-col gap-2 border-border border-t px-5 py-4">
				{@render footerActions()}
			</div>
		{/if}
	</SheetContent>
</Sheet>
