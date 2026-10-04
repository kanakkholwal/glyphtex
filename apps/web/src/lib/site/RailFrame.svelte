<script lang="ts">
	import SiteFooter from "$lib/SiteFooter.svelte";
	import SiteHeader from "$lib/SiteHeader.svelte";
	import { cn } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";

	/** Public page shell: skip link, navbar, dashed column rails, footer. Pages never render these directly. */
	let { class: className, children }: { class?: string; children: Snippet } = $props();
</script>

<div class={cn('relative flex min-h-dvh w-full flex-col overflow-x-clip bg-canvas text-foreground', className)}>
	<a
		href="#main"
		class="sr-only z-[60] rounded-md bg-background px-3 py-2 text-body font-medium focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:ring-2 focus:ring-ring"
	>
		Skip to content
	</a>
	<SiteHeader />
	<main id="main" tabindex="-1" class="flex flex-1 flex-col outline-none">
		{@render children()}
	</main>
	<SiteFooter />
	<div
		aria-hidden="true"
		class="rail-column rail-dash pointer-events-none fixed inset-y-0 left-1/2 z-30 -translate-x-1/2 border-x-2"
	></div>
</div>
