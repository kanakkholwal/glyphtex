<script lang="ts">
	import { onMount } from "svelte";
	import { afterNavigate } from "$app/navigation";
	import { env } from "$env/dynamic/public";
	import { settings } from "@glyphtex/ui/settings";
	import { initAnalytics, trackPageview } from "$lib/analytics";
	import { SITE_NAME } from "$lib/seo/site";
	import "./layout.css";

	// Set in wrangler `vars` (or .env) to verify the property in Search Console.
	const gscToken = env.PUBLIC_GSC_VERIFICATION ?? "";

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
	{#if gscToken}
		<meta name="google-site-verification" content={gscToken} />
	{/if}
</svelte:head>
{@render children()}
