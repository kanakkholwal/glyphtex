<script lang="ts">
	import { resolve } from '$app/paths';
	import { Logo } from '@glyphx/ui/logo';
	import { ThemeToggle } from '@glyphx/ui/theme-toggle';
	import { IconArrowUpRight, IconDownload, IconMenu2, IconX } from '@tabler/icons-svelte';

	// Editorial marketing nav (autosend register): a warm, sticky bar with a
	// mono-uppercase link row and a brand-blue pill CTA. Section links point back
	// to the home page so they still work from /download.
	const home = resolve('/');
	const repo = 'https://github.com/kanakkholwal/glyphx';

	const links = [
		{ label: 'Features', href: `${home}#features` },
		{ label: 'Compare', href: `${home}#compare` },
		{ label: 'FAQ', href: `${home}#faq` }
	];

	let open = $state(false);

	const navLink =
		'text-muted-foreground hover:text-foreground font-mono text-[11px] font-semibold tracking-[0.14em] uppercase transition-colors';
</script>

<header class="border-hairline bg-canvas/75 sticky top-0 z-50 border-b backdrop-blur-xl">
	<nav class="mx-auto flex h-16 max-w-[1140px] items-center gap-6 px-5 sm:px-6">
		<Logo href={home} size={24} class="text-base tracking-tight" />

		<!-- desktop links -->
		<div class="ml-4 hidden items-center gap-7 md:flex">
			{#each links as l (l.href)}
				<a href={l.href} class={navLink}>{l.label}</a>
			{/each}
			<a href={repo} target="_blank" rel="noopener noreferrer" class="{navLink} inline-flex items-center gap-1">
				GitHub <IconArrowUpRight class="size-3" />
			</a>
		</div>

		<!-- right actions -->
		<div class="ml-auto flex items-center gap-2.5">
			<ThemeToggle />
			<a
				href={resolve('/editor')}
				class="border-hairline bg-card text-foreground hover:bg-muted hidden h-9 items-center rounded-lg border px-3.5 font-mono text-[11px] font-semibold tracking-wider uppercase transition-colors sm:inline-flex"
			>
				Open editor
			</a>
			<a
				href={resolve('/download')}
				class="bg-brand text-brand-foreground inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 font-mono text-[11px] font-semibold tracking-wider uppercase transition-all hover:opacity-90 active:scale-[0.98]"
			>
				<IconDownload class="size-3.5" /> Download
			</a>
			<button
				type="button"
				class="text-foreground hover:bg-muted grid size-9 place-items-center rounded-lg transition-colors md:hidden"
				onclick={() => (open = !open)}
				aria-label={open ? 'Close menu' : 'Open menu'}
				aria-expanded={open}
			>
				{#if open}<IconX class="size-5" />{:else}<IconMenu2 class="size-5" />{/if}
			</button>
		</div>
	</nav>

	<!-- mobile dropdown -->
	{#if open}
		<div class="border-hairline bg-canvas flex flex-col gap-1 border-t px-5 py-3 md:hidden">
			{#each links as l (l.href)}
				<a href={l.href} class="{navLink} py-2.5" onclick={() => (open = false)}>{l.label}</a>
			{/each}
			<a
				href={repo}
				target="_blank"
				rel="noopener noreferrer"
				class="{navLink} inline-flex items-center gap-1 py-2.5"
				onclick={() => (open = false)}
			>
				GitHub <IconArrowUpRight class="size-3" />
			</a>
		</div>
	{/if}
</header>
