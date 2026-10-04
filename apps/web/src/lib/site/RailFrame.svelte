<script lang="ts">
	import SiteFooter from "$lib/SiteFooter.svelte";
	import SiteHeader from "$lib/SiteHeader.svelte";
	import { cn } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";
	import SiteCommand from "./SiteCommand.svelte";

	/** Public page shell: skip link, top bar, dashed column with hatched rails, footer. */
	let { class: className, children }: { class?: string; children: Snippet } = $props();
</script>

<div
	class={cn(
		"relative mx-auto flex min-h-dvh w-full max-w-[76rem] flex-col bg-background text-foreground lg:border-x lg:border-dashed lg:border-border",
		className
	)}
>
	<div
		aria-hidden="true"
		class="hatch absolute inset-y-0 right-full hidden w-6 border-l border-dashed border-border xl:block"
	></div>
	<div
		aria-hidden="true"
		class="hatch absolute inset-y-0 left-full hidden w-6 border-r border-dashed border-border xl:block"
	></div>

	<a
		href="#main"
		class="sr-only z-[60] rounded-md bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:ring-2 focus:ring-ring"
	>
		Skip to content
	</a>
	<SiteHeader />
	<main id="main" tabindex="-1" class="flex min-w-0 flex-1 flex-col outline-none">
		{@render children()}
	</main>
	<SiteFooter />
	<SiteCommand />
</div>
