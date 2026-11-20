<script lang="ts">
	import { afterNavigate, onNavigate } from "$app/navigation";
	import ConsentBanner from "$lib/analytics/ConsentBanner.svelte";
	import { connectWorkbench, initAnalytics, trackPageview } from "$lib/analytics";
	import { SITE_NAME } from "$lib/seo/site";
	import { NavProgress } from "@glyphtex/ui/nav-progress";
	import { settings } from "@glyphtex/ui/settings";
	import { TooltipProvider } from "@glyphtex/ui/tooltip";
	import { onMount } from "svelte";
	import "./layout.css";

	let { children } = $props();

	// Keep `.dark` on <html> in sync; re-runs on toggle and cross-window storage sync.
	$effect(() => {
		settings.apply();
	});

	// No-op unless a backend is configured and the visitor has said yes.
	onMount(() => {
		connectWorkbench();
		initAnalytics();
		const boot = document.getElementById("boot");
		if (!boot) return;
		boot.dataset.done = "";
		setTimeout(() => boot.remove(), 200);
	});

	// Pages cross-fade through the View Transitions API where it exists; reduced motion skips it.
	onNavigate((navigation) => {
		if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches)
			return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	// Every view is reported here, including the first: backends are configured
	// not to send their own, so this is the single source of page counts.
	afterNavigate((nav) => {
		trackPageview(nav.to?.url.pathname ?? location.pathname);
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" />
	<link
		rel="alternate"
		type="application/rss+xml"
		title="{SITE_NAME} Blog"
		href="/blog/rss.xml"
	/>
</svelte:head>
<NavProgress />
<!-- baby-ui tooltips need one provider above them; the old primitive made its own. -->
<TooltipProvider delayDuration={400}>
	{@render children()}
	<ConsentBanner />
</TooltipProvider>
