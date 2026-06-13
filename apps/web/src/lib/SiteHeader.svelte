<script lang="ts">
	import { resolve } from '$app/paths';
	import { Logo } from '@glyphx/ui/logo';
	import { ThemeToggle } from '@glyphx/ui/theme-toggle';
	import { IconArrowRight, IconBrandGithub, IconMenu2, IconX } from '@tabler/icons-svelte';

	// Shared marketing nav. Section links point back to the home page so they work
	// from the download page too.
	const home = resolve('/');
	const links = [
		{ href: `${home}#features`, label: 'Features' },
		{ href: `${home}#why`, label: 'Why we built it' },
		{ href: `${home}#compare`, label: 'Compare' },
		{ href: `${home}#faq`, label: 'FAQ' }
	];
	const repo = 'https://github.com/kanakkholwal/glyph';

	let menuOpen = $state(false);
</script>

<header class="border-hairline bg-canvas/80 sticky top-0 z-40 border-b backdrop-blur-xl">
	<div class="mx-auto flex h-16 max-w-[1140px] items-center gap-6 px-5 sm:px-6">
		<Logo href={home} size={28} class="text-lg tracking-tight" />

		<nav class="text-muted-foreground ml-3 hidden items-center gap-7 text-sm font-medium lg:flex">
			{#each links as l (l.href)}
				<a class="hover:text-foreground relative transition-colors" href={l.href}>{l.label}</a>
			{/each}
		</nav>

		<div class="ml-auto flex items-center gap-1.5 sm:gap-2">
			<a
				href={repo}
				target="_blank"
				rel="noreferrer"
				aria-label="GlyphX on GitHub"
				class="text-muted-foreground hover:text-foreground hover:bg-muted hidden size-9 place-items-center rounded-lg transition-colors sm:grid"
			>
				<IconBrandGithub class="size-[18px]" />
			</a>
			<ThemeToggle />
			<a
				href={resolve('/editor')}
				class="text-foreground hover:bg-muted hidden h-9 items-center rounded-lg px-3.5 text-sm font-semibold transition-colors sm:inline-flex"
				>Open the editor</a
			>
			<a
				href={resolve('/download')}
				class="bg-primary text-primary-foreground group inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
			>
				Download
				<IconArrowRight
					class="size-3.5 transition-transform group-hover:translate-x-0.5"
				/>
			</a>
			<button
				class="text-muted-foreground hover:text-foreground hover:bg-muted grid size-9 place-items-center rounded-lg transition-colors lg:hidden"
				aria-label={menuOpen ? 'Close menu' : 'Open menu'}
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				{#if menuOpen}<IconX class="size-5" />{:else}<IconMenu2 class="size-5" />{/if}
			</button>
		</div>
	</div>

	{#if menuOpen}
		<nav class="border-hairline bg-canvas border-t px-5 py-3 lg:hidden">
			<div class="mx-auto flex max-w-[1140px] flex-col">
				{#each links as l (l.href)}
					<a
						class="text-foreground hover:bg-muted -mx-2 rounded-md px-2 py-2.5 text-sm font-medium transition-colors"
						href={l.href}
						onclick={() => (menuOpen = false)}>{l.label}</a
					>
				{/each}
				<a
					class="text-foreground hover:bg-muted -mx-2 rounded-md px-2 py-2.5 text-sm font-medium transition-colors"
					href={resolve('/editor')}
					onclick={() => (menuOpen = false)}>Open the editor</a
				>
				<a
					class="text-muted-foreground hover:bg-muted -mx-2 flex items-center gap-2 rounded-md px-2 py-2.5 text-sm font-medium transition-colors"
					href={repo}
					target="_blank"
					rel="noreferrer"
				>
					<IconBrandGithub class="size-4" /> GitHub
				</a>
			</div>
		</nav>
	{/if}
</header>
