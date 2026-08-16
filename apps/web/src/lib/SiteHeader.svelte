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

	const resolveAny = resolve as (route: string) => string;
	function hrefFor(href: string, external = false): string {
		if (external) return href;
		// Internal paths must start with a single `/` and have no scheme.
		if (!href.startsWith('/') || href.startsWith('//')) return href;
		return resolveAny(href);
	}

	// The bottom hairline only appears once content can pass under the bar.
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

<header
	class={[
		'fixed inset-x-0 top-0 z-50 bg-background py-3 transition-[border-color] duration-200 ease-out',
		scrolled ? 'border-b border-hairline' : 'border-b border-transparent'
	]}
>
	<!-- Full-bleed, three columns. The two side tracks are equal `1fr`, so the auto
	     centre track lands on the viewport midline whatever the logo and the action
	     cluster weigh. `auto 1fr auto` centres the links inside the leftover space
	     instead, which drifts left the moment the right side is heavier. -->
	<nav
		aria-label="Primary"
		class="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 sm:px-8 lg:px-10"
	>
		<a
			href={home}
			class="group/logo -ml-1 flex items-center rounded-lg px-1 py-1 transition-transform active:scale-[0.97]"
			aria-label="GlyphTeX home"
		>
			<Logo size={26} badge text={true} tone="gradient" class="text-base" />
		</a>

		<ul class="hidden items-center justify-center gap-2 md:flex">
			{#each navLinks as link (link.href)}
				<li>
					<a
						href={hrefFor(link.href, link.external)}
						class="inline-flex items-center rounded-lg px-3.5 py-2 text-base text-foreground transition-colors hover:bg-surface-soft"
					>
						{link.label}
					</a>
				</li>
			{/each}
		</ul>

		<div class="col-start-3 flex items-center justify-end gap-1.5">

			<Button href={resolve('/workspace')} variant="default" class="min-w-0 px-4">
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
	<div class="fixed inset-0 z-40 bg-ink/15 md:hidden" aria-hidden="true" onclick={close}></div>
	<div
		id="mobile-nav"
		class="fixed inset-x-4 top-16 z-50 rounded-xl border border-hairline bg-background p-2 shadow-notion md:hidden"
		{@attach menuFocus}
	>
		<ul class="flex flex-col">
			{#each navLinks as link (link.href)}
				<li>
					<a
						href={hrefFor(link.href, link.external)}
						onclick={close}
						class="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-surface-soft"
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
					class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-surface-soft"
				>
					<IconBrandGithub class="size-4" />
					GitHub
				</a>
			</li>
		</ul>
	</div>
{/if}
