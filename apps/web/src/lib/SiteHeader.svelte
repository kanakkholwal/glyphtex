<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '@glyphtex/ui/button';
	import { Logo } from '@glyphtex/ui/logo';
	import { ThemeToggle } from '@glyphtex/ui/theme-toggle';
	import { navLinks, REPO_URL } from '$lib/landing/nav-data';
	import { IconBrandGithub, IconMenu2, IconX } from '@tabler/icons-svelte';

	const home = resolve('/');
	const repo = REPO_URL;

	let open = $state(false);
	let toggleRef = $state<HTMLButtonElement | null>(null);

	function close() {
		if (!open) return;
		open = false;
		// Without this, dismissing the menu drops focus to <body> and a keyboard
		// user restarts the tab order from the top of the document.
		toggleRef?.focus();
	}

	// The panel is a dismissible overlay, so focus moves into it and stays there
	// until it closes.
	function menuFocus(node: HTMLElement) {
		const focusables = () =>
			Array.from(node.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')).filter(
				(el) => el.offsetParent !== null
			);

		focusables()[0]?.focus();

		function onKeydown(event: KeyboardEvent) {
			if (event.key !== 'Tab') return;
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

		node.addEventListener('keydown', onKeydown);
		return () => node.removeEventListener('keydown', onKeydown);
	}

	// The nav-data hrefs are typed as `string`. Internal routes need
	// resolve() so the type-safe router is happy and the lint is silent;
	// external links pass through untouched. The cast widens resolve's
	// type-safe signature (literal route union) to plain string so data-
	// driven hrefs can flow through, and the explicit protocol check below
	// keeps us from handing non-routes (mailto:, tel:, http(s)://, //cdn…)
	// to resolve() at runtime — SvelteKit's runtime guard rejects those.
	const resolveAny = resolve as (route: string) => string;
	function hrefFor(href: string, external = false): string {
		if (external) return href;
		// Internal paths must start with a single `/` and have no scheme.
		if (!href.startsWith('/') || href.startsWith('//')) return href;
		return resolveAny(href);
	}

	// The nav starts surface-mounted (looks like a normal nav at the
	// top of the page) and floats once the user scrolls past the hero.
	// Threshold chosen to roughly match the hero card's height.
	let scrolled = $state(false);

	$effect(() => {
		if (typeof window === 'undefined') return;
		const onScroll = () => {
			scrolled = window.scrollY > 80;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') close();
	}}
/>

<!--
  Surface vs floating. At scrollY=0 the nav reads as part of the page
  (full-width, transparent, no chrome). Once the user scrolls past the
  hero it lifts off: narrower max-width, glass background, hairline
  border, shadow. The inner <nav> carries the transition so the
  container itself doesn't reflow.
-->
<header
	class={[
		'fixed inset-x-0 top-0 z-50 py-4 transition-[background-color,box-shadow,border-color] duration-300 ease-out',
		scrolled
			? 'landing-glass-strong border-b border-hairline'
			: 'border-b border-transparent bg-transparent'
	]}
>
	<!-- No transition on `max-width`/`padding`: neither value changes between the
	     two states, and animating layout properties is a reflow per frame. -->
	<nav aria-label="Primary" class="mx-auto flex max-w-7xl items-center gap-2 px-6 lg:px-10">
		<a
			href={home}
			class="group/logo flex items-center gap-2.5 rounded-xl px-2 py-1 transition-transform active:scale-[0.97]"
			aria-label="GlyphTeX home"
		>
			<Logo size="sm" badge text={true} tone="gradient" />
		</a>

		<!-- Inline links, centred (desktop only). -->
		<ul class="hidden flex-1 items-center justify-center gap-0.5 md:flex">
			{#each navLinks as link (link.href)}
				<li>
					<a
						href={hrefFor(link.href, link.external)}
						class="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
					>
						{link.label}
					</a>
				</li>
			{/each}
		</ul>

		<div class="ml-auto flex items-center gap-1.5 md:ml-0">
			<Button
				href={repo}
				target="_blank"
				rel="noopener noreferrer"
				size="sm"
				variant="ghost"
				class="hidden gap-1.5 text-muted-foreground hover:text-foreground md:inline-flex"
			>
				<IconBrandGithub class="size-4" />
				Star the repo
			</Button>
			<ThemeToggle size="icon-sm" />
			<!-- Was "Download". The desktop app is still a prototype, so the header
			     points at the workspace until there is a release worth shipping.
			     The label matches the page CTAs exactly — two names for one URL
			     reads as two destinations. -->
			<Button href={resolve('/workspace')} size="sm" variant="brand" class="gap-1.5">
				Open the workspace
			</Button>
			<button
				bind:this={toggleRef}
				type="button"
				onclick={() => (open ? close() : (open = true))}
				aria-expanded={open}
				aria-controls="mobile-nav"
				aria-label={open ? 'Close menu' : 'Open menu'}
				class="grid size-9 place-items-center rounded-lg text-foreground transition-colors hover:bg-foreground/5 md:hidden"
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
	<!--
	  Click-away backdrop. Presentational, not a control: the previous version was
	  a full-viewport <button aria-label="Close menu">, which reaches the
	  accessibility tree as an interactive element covering the whole page.
	  Escape and the toggle are the real dismissals; this is a pointer shortcut.
	-->
	<div class="fixed inset-0 z-40 bg-canvas/40 md:hidden" aria-hidden="true" onclick={close}></div>
	<div
		id="mobile-nav"
		class="landing-glass-strong fixed inset-x-4 top-19 z-50 rounded-2xl p-2 md:hidden"
		{@attach menuFocus}
	>
		<ul class="flex flex-col">
			{#each navLinks as link (link.href)}
				<li>
					<a
						href={hrefFor(link.href, link.external)}
						onclick={close}
						class="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
					>
						{link.label}
					</a>
				</li>
			{/each}
			<li>
				<a
					href={repo}
					target="_blank"
					rel="noopener noreferrer"
					onclick={close}
					class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
				>
					<IconBrandGithub class="size-4" />
					Star the repo
				</a>
			</li>
		</ul>
	</div>
{/if}
