<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { Button } from "@glyphtex/ui/button";
	import { Toaster } from "@glyphtex/ui/sonner";
	import {
		IconArrowLeft,
		IconBolt,
		IconInfoCircle,
		IconPencil,
		IconPlug,
		IconSettings
	} from "@tabler/icons-svelte";

	let { children } = $props();

	const nav = [
		{ href: "/settings/general", label: "General", icon: IconSettings },
		{ href: "/settings/editor", label: "Editor", icon: IconPencil },
		{ href: "/settings/engine", label: "Engine", icon: IconBolt },
		{ href: "/settings/integrations", label: "Integrations", icon: IconPlug },
		{ href: "/settings/about", label: "About", icon: IconInfoCircle }
	] as const;

	// Capture phase: runs before bits-ui closes an open overlay, so Esc there only closes the overlay.
	function onkeydowncapture(e: KeyboardEvent) {
		if (e.key !== "Escape" || e.defaultPrevented) return;
		if (document.querySelector("[role='dialog'], [role='listbox'], [role='menu']")) return;
		if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]"))
			return;
		void goto(resolve("/"));
	}
</script>

<svelte:window {onkeydowncapture} />

<a
	href="#settings-main"
	class="sr-only fixed top-2 left-2 z-50 rounded-md bg-background px-3 py-2 text-body font-medium text-foreground outline-none focus:not-sr-only focus-visible:ring-2 focus-visible:ring-ring"
>
	Skip to settings
</a>

<div class="flex h-dvh overflow-hidden bg-background text-foreground">
	<aside class="flex w-56 shrink-0 flex-col gap-4 border-r border-border bg-sidebar p-3">
		<Button
			variant="ghost"
			size="sm"
			class="w-fit text-muted-foreground"
			title="Back to projects (Esc)"
			onclick={() => goto(resolve('/'))}
		>
			<IconArrowLeft />
			Projects
		</Button>

		<nav aria-labelledby="settings-nav-title" class="flex flex-col gap-1">
			<p id="settings-nav-title" class="px-3 pb-1 text-xs font-medium text-muted-foreground">
				Settings
			</p>
			<ul class="flex flex-col gap-0.5">
				{#each nav as item (item.href)}
					{@const active = page.url.pathname === item.href}
					<li>
						<a
							href={resolve(item.href)}
							aria-current={active ? 'page' : undefined}
							class="flex h-10 items-center gap-2.5 rounded-lg px-3 text-body outline-none transition-colors duration-150 ease-craft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset {active
								? 'bg-muted font-medium text-foreground'
								: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
						>
							<item.icon size={18} class="shrink-0 {active ? 'text-primary' : ''}" aria-hidden="true" />
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</aside>

	<main id="settings-main" tabindex="-1" class="min-h-0 flex-1 overflow-auto outline-none">
		<div class="mx-auto flex max-w-2xl flex-col gap-6 px-8 py-10">
			{@render children()}
		</div>
	</main>
</div>

<Toaster />
