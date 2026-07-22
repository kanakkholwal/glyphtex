<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '@glyphtex/ui/button';
	import { Logo } from '@glyphtex/ui/logo';
	import { Toaster } from '@glyphtex/ui/sonner';
	import {
		IconArrowLeft,
		IconBolt,
		IconInfoCircle,
		IconPencil,
		IconPlug,
		IconSettings
	} from '@tabler/icons-svelte';

	let { children } = $props();

	// Section tabs. Cloud / sync integration will slot in here later.
	const nav = [
		{ href: '/settings/general', label: 'General', icon: IconSettings },
		{ href: '/settings/editor', label: 'Editor', icon: IconPencil },
		{ href: '/settings/engine', label: 'Engine', icon: IconBolt },
		{ href: '/settings/integrations', label: 'Integrations', icon: IconPlug },
		{ href: '/settings/about', label: 'About', icon: IconInfoCircle }
	] as const;
	const isActive = (href: string) => page.url.pathname === href;

	// A single indicator that glides under the active tab. The layout persists
	// across the section routes, so the slide animates on navigation instead of
	// re-mounting. First placement snaps (no fly-in); every move after glides.
	let tabsEl = $state<HTMLElement>();
	let indLeft = $state(0);
	let indWidth = $state(0);
	let placed = $state(false);
	let animate = $state(false);

	function measure() {
		const active = tabsEl?.querySelector<HTMLElement>('[data-active="true"]');
		if (!active) return;
		indLeft = active.offsetLeft;
		indWidth = active.offsetWidth;
		placed = true;
	}

	$effect(() => {
		void page.url.pathname;
		measure();
	});

	$effect(() => {
		// Enable the slide one tick after the first placement.
		if (placed && !animate) queueMicrotask(() => (animate = true));
	});

	$effect(() => {
		if (!tabsEl || typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver(() => measure());
		ro.observe(tabsEl);
		return () => ro.disconnect();
	});
</script>

<svelte:head><title>Settings · GlyphTeX</title></svelte:head>

<div class="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
	<!-- Top chrome: identity + the section tabs, both aligned to the centred
	     content column so the whole surface reads as one focused page. -->
	<header class="border-border shrink-0 border-b">
		<div class="mx-auto flex h-14 max-w-2xl items-center gap-2.5 px-6">
			<Button
				variant="ghost"
				size="icon-sm"
				class="-ml-1.5"
				title="Back to projects"
				aria-label="Back to projects"
				onclick={() => goto(resolve('/'))}
			>
				<IconArrowLeft size={16} />
			</Button>
			<Logo size={22} text={false} />
			<h1 class="font-display text-base tracking-tight">Settings</h1>
		</div>

		<nav
			bind:this={tabsEl}
			class="no-scrollbar relative mx-auto flex max-w-2xl gap-1 overflow-x-auto px-6"
			aria-label="Settings sections"
		>
			{#each nav as item (item.href)}
				{@const active = isActive(item.href)}
				{@const Icon = item.icon}
				<a
					href={resolve(item.href)}
					data-active={String(active)}
					aria-current={active ? 'page' : undefined}
					class="ease-craft flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-2.5 text-[13px] transition-colors duration-200 {active
						? 'text-foreground font-medium'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					<Icon size={16} class="shrink-0 {active ? 'text-brand' : ''}" />
					{item.label}
				</a>
			{/each}
			<span
				aria-hidden="true"
				class="bg-brand pointer-events-none absolute bottom-0 h-[2px] rounded-full {animate
					? 'ease-craft transition-[left,width] duration-300'
					: ''} {placed ? '' : 'opacity-0'}"
				style:left={`${indLeft}px`}
				style:width={`${indWidth}px`}
			></span>
		</nav>
	</header>

	<div class="min-h-0 flex-1 overflow-auto">
		<div class="mx-auto max-w-2xl px-6 py-10">
			{@render children()}
		</div>
	</div>
</div>

<Toaster />
