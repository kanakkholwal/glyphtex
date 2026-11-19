<script lang="ts">
	import SiteFooter from "$lib/SiteFooter.svelte";
	import SiteHeader from "$lib/SiteHeader.svelte";
	import { cn } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";
	import SiteCommand from "./SiteCommand.svelte";

	/** Public page shell: skip link, top bar, open column, footer. */
	let { class: className, children }: { class?: string; children: Snippet } = $props();
</script>

<div
	class={cn(
		"font-public relative mx-auto flex min-h-dvh w-full max-w-[76rem] flex-col bg-background text-foreground",
		className
	)}
>
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
