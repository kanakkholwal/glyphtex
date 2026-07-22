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
	const close = () => (open = false);

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
		'fixed inset-x-0 top-0 z-50 py-4 transition-[background-color,backdrop-filter,box-shadow,border-color,padding] duration-300 ease-out',
		scrolled
			? 'bg-canvas/75 backdrop-blur-xl border-b border-hairline/70 landing-glass-strong'
			: 'bg-transparent border-b border-transparent '
	]}
>
	<nav
		aria-label="Primary"
		class={[
			'max-w-7xl px-6 lg:px-10 mx-auto flex items-center gap-2 transition-[max-width,padding,border-radius,background-color,box-shadow,border-color] duration-300 ease-out'
		]}
	>
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
			<a
				href={repo}
				target="_blank"
				rel="noopener noreferrer"
				aria-label="GlyphTeX on GitHub"
				class="hidden size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground md:grid"
			>
				<IconBrandGithub class="size-4" />
			</a>
			<ThemeToggle size="icon-sm" />
			<Button href={resolve('/download')} size="sm" variant="default" class="gap-1.5">
				Download
			</Button>
			<button
				type="button"
				onclick={() => (open = !open)}
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
	<!-- Click-away backdrop (mobile only). -->
	<button
		type="button"
		class="fixed inset-0 z-40 md:hidden"
		aria-label="Close menu"
		tabindex="-1"
		onclick={close}
	></button>
	<div
		id="mobile-nav"
		class="landing-glass-strong fixed inset-x-4 top-19 z-50 rounded-2xl p-2 md:hidden"
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
					class="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
				>
					GitHub
				</a>
			</li>
		</ul>
	</div>
{/if}
