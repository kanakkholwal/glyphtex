<script lang="ts">
	import { afterNavigate } from "$app/navigation";
	import { initAnalytics, trackPageview } from "$lib/analytics";
	import { SITE_NAME } from "$lib/seo/site";
	import { settings } from "@glyphtex/ui/settings";
	import { onMount } from "svelte";
	import "./layout.css";

	let { children } = $props();

	// Keep `.dark` on <html> in sync; re-runs on toggle and cross-window storage sync.
	$effect(() => {
		settings.apply();
	});

	// No-op unless a backend is configured and the visitor hasn't opted out.
	onMount(() => initAnalytics());

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
{@render children()}
