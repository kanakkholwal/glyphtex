<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { settings } from '@glyphtex/ui/settings';
	import { loadAnalytics, trackPageview } from '$lib/analytics';
	import './layout.css';

	let { children } = $props();

	// Keep `.dark` on <html> in sync; re-runs on toggle and cross-window storage sync.
	$effect(() => {
		settings.apply();
	});

	// No-op unless PUBLIC_GA_ID is set; gtag.js sends the initial page_view itself.
	onMount(() => loadAnalytics());

	afterNavigate((nav) => {
		if (nav.type === 'enter') return; // initial load already counted by gtag config
		trackPageview(nav.to?.url.pathname ?? location.pathname);
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" />
</svelte:head>
{@render children()}
