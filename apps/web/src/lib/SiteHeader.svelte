<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { track } from "$lib/analytics";
	import { navLinks, REPO_URL } from "$lib/landing/nav-data";
	import { Button } from "@glyphtex/ui/button";
	import { Logo } from "@glyphtex/ui/logo";
	import { ThemeToggle } from "@glyphtex/ui/theme-toggle";
	import { IconBrandGithub, IconMenu2, IconX } from "@tabler/icons-svelte";

	const home = resolve("/");
	const repo = REPO_URL;
	const format = new Intl.NumberFormat("en", { notation: "compact" });

	// Streamed from the root layout; null hides the count rather than showing a guess.
	const stars = $derived(page.data.stars as Promise<number | null> | undefined);

	let open = $state(false);
	let toggleRef = $state<HTMLButtonElement | null>(null);

	function close() {
		if (!open) return;
		open = false;
		// Otherwise focus drops to <body> and a keyboard user restarts from the top.
		toggleRef?.focus();
	}

	// The panel is a dismissible overlay, so focus moves into it and stays until it closes.
	function menuFocus(node: HTMLElement) {
		const focusables = () =>
			Array.from(node.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")).filter(
				(el) => el.offsetParent !== null
			);

		focusables()[0]?.focus();

		function onKeydown(event: KeyboardEvent) {
			if (event.key !== "Tab") return;
			const items = focusables();
			if (items.length === 0) return;
			const first = items[0];
			const last = items[items.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}

		node.addEventListener("keydown", onKeydown);
		return () => node.removeEventListener("keydown", onKeydown);
	}

	const resolveAny = resolve as (route: string) => string;
	function hrefFor(href: string, external = false): string {
		if (external) return href;
		// Internal paths must start with a single `/` and have no scheme.
		if (!href.startsWith("/") || href.startsWith("//")) return href;
		return resolveAny(href);
	}

	const isCurrent = (href: string) =>
		href.startsWith("/") && !href.includes("#") && page.url.pathname.startsWith(href);
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') close();
	}}
/>

<header class="fixed inset-x-0 top-0 z-50 border-b-2 border-dashed border-border bg-canvas">
	<nav
		aria-label="Primary"
		class="rail-column relative mx-auto flex items-center justify-between px-3 py-3 sm:px-4"
	>
		<a
			href={home}
			class="-m-1.5 flex items-center rounded-md p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
			aria-label="GlyphTeX home"
		>
			<Logo size={26} badge text={true} class="text-body-lg" />
		</a>

		<!-- One segmented track: the current page is the raised thumb, so it reads without colour. -->
		<ul
			class="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-lg bg-muted p-1 sm:flex"
		>
			{#each navLinks as link (link.href)}
				{@const current = isCurrent(link.href)}
				<li>
					<a
						href={hrefFor(link.href, link.external)}
						aria-current={current ? 'page' : undefined}
						class={[
							'inline-flex h-8 items-center rounded-md px-3.5 text-body outline-none transition-[color,background-color,box-shadow] duration-200 ease-craft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
							current
								? 'bg-card font-medium text-foreground shadow-xs dark:bg-background'
								: 'text-muted-foreground hover:text-foreground'
						]}
					>
						{link.label}
					</a>
				</li>
			{/each}
		</ul>

		<div class="flex items-center gap-2">
			<Button
				href={repo}
				target="_blank"
				rel="noopener noreferrer"
				variant="outline"
				class="gap-1.5 px-3"
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
			<ThemeToggle size="icon" class="hidden border border-border bg-card sm:inline-flex dark:bg-background" />
			<Button
				href={resolve('/workspace')}
				variant="default"
				class="hidden md:inline-flex"
				onclick={() => track('cta_clicked', { target: 'workspace', location: 'nav' })}
			>
				Open the workspace
			</Button>
			<button
				bind:this={toggleRef}
				type="button"
				onclick={() => (open ? close() : (open = true))}
				aria-expanded={open}
				aria-controls="mobile-nav"
				aria-label={open ? 'Close menu' : 'Open menu'}
				class="grid size-10 place-items-center rounded-md border border-border bg-card text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:hidden dark:bg-background"
			>
				{#if open}
					<IconX class="size-5" />
				{:else}
					<IconMenu2 class="size-5" />
				{/if}
			</button>
		</div>
	</nav>
</header>

{#if open}
	<!-- Presentational pointer shortcut: a full-page <button> here read as one giant control to screen readers. -->
	<div class="fixed inset-0 z-40 bg-fixed-dark/20 sm:hidden" aria-hidden="true" onclick={close}></div>
	<div
		id="mobile-nav"
		class="fixed inset-x-3 top-20 z-50 rounded-xl border border-border bg-popover p-2 shadow-lg sm:hidden"
		{@attach menuFocus}
	>
		<ul class="flex flex-col">
			{#each navLinks as link (link.href)}
				<li>
					<a
						href={hrefFor(link.href, link.external)}
						onclick={close}
						class="flex min-h-11 items-center rounded-lg px-3 text-body-lg font-medium text-foreground transition-colors hover:bg-muted"
					>
						{link.label}
					</a>
				</li>
			{/each}
			<li>
				<a
					href={resolve('/workspace')}
					onclick={() => {
						track('cta_clicked', { target: 'workspace', location: 'nav' });
						close();
					}}
					class="flex min-h-11 items-center rounded-lg px-3 text-body-lg font-medium text-foreground transition-colors hover:bg-muted"
				>
					Open the workspace
				</a>
			</li>
			<li class="flex min-h-11 items-center justify-between px-3">
				<span class="text-body-lg font-medium text-foreground">Theme</span>
				<ThemeToggle size="icon" />
			</li>
		</ul>
	</div>
{/if}
