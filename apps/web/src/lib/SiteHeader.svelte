<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '@glyphx/ui/button';
	import { Logo } from '@glyphx/ui/logo';
	import { ThemeToggle } from '@glyphx/ui/theme-toggle';
	import { IconArrowUpRight, IconMenu2, IconX } from '@tabler/icons-svelte';

	const home = resolve('/');
	const repo = 'https://github.com/kanakkholwal/glyphx';

	const links = [
		{ label: 'Features', href: `${home}#features` },
		{ label: 'Workflow', href: `${home}#workflow` },
		{ label: 'Compare', href: `${home}#compare` },
		{ label: 'FAQ', href: `${home}#faq` }
	];

	let open = $state(false);
</script>

<header class="landing-site-header">
	<div class="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
		<div class="flex items-center gap-10">
			<Logo href={home} size="md" badge={false} tone="mono" class="text-ink" />

			<nav class="landing-site-header__nav hidden items-center gap-7 lg:flex">
				{#each links as link (link.href)}
					<a
						href={link.href}
						class="text-sm font-medium tracking-[-0.01em] text-ink-muted transition-colors hover:text-ink"
					>
						{link.label}
					</a>
				{/each}
				<a
					href={repo}
					target="_blank"
					rel="noopener noreferrer"
					class="group flex items-center gap-1 text-sm font-medium tracking-[-0.01em] text-ink-muted transition-colors hover:text-ink"
				>
					GitHub
					<IconArrowUpRight class="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
				</a>
			</nav>
		</div>

		<div class="flex items-center gap-3">
			<ThemeToggle />

			<Button
				
				href={resolve('/download')}
				class="hidden sm:inline-flex"
			>
				Download desktop app
			</Button>

			<button
				type="button"
				class="inline-flex size-10 items-center justify-center rounded-full border border-hairline bg-surface-card text-ink transition-colors hover:bg-surface-soft lg:hidden"
				onclick={() => (open = !open)}
				aria-label={open ? 'Close menu' : 'Open menu'}
				aria-expanded={open}
			>
				{#if open}
					<IconX class="size-5" />
				{:else}
					<IconMenu2 class="size-5" />
				{/if}
			</button>
		</div>
	</div>

	{#if open}
		<div class="border-t border-hairline bg-canvas px-6 py-5 lg:hidden">
			<nav class="flex flex-col gap-2">
				{#each links as link (link.href)}
					<a
						href={link.href}
						class="rounded-2xl px-4 py-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
						onclick={() => (open = false)}
					>
						{link.label}
					</a>
				{/each}
				<a
					href={resolve('/download')}
					class="mt-2 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-canvas"
					onclick={() => (open = false)}
				>
					Download desktop app
				</a>
				<a
					href={repo}
					target="_blank"
					rel="noopener noreferrer"
					class="rounded-2xl px-4 py-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
					onclick={() => (open = false)}
				>
					GitHub
				</a>
			</nav>
		</div>
	{/if}
</header>
