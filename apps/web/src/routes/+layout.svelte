<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { dev } from '$app/environment';
	import { settings } from '@glyphx/ui/settings';
	import { loadAnalytics, trackPageview } from '$lib/analytics';
	import './layout.css';

	let { children } = $props();

	// Keep `.dark` on <html> in sync; re-runs on toggle and cross-window storage sync.
	$effect(() => {
		settings.apply();
	});

	// No-op unless PUBLIC_GA_ID is set; gtag.js sends the initial page_view itself.
	onMount(() => loadAnalytics());

	// Production only. In dev, unregister leftover workers: a reused port can serve
	// stale modules and intercept HMR, which presents as impossible bugs.
	onMount(() => {
		if (!('serviceWorker' in navigator)) return;

		if (dev) {
			void navigator.serviceWorker
				.getRegistrations()
				.then((regs) => Promise.all(regs.map((r) => r.unregister())))
				.catch(() => {
					/* nothing to clean up, or the browser refuses — either is fine */
				});
			return;
		}

		void navigator.serviceWorker.register('/service-worker.js', { type: 'module' }).catch(() => {
			/* offline support is an enhancement; the app works without it */
		});
	});
	afterNavigate((nav) => {
		if (nav.type === 'enter') return; // initial load already counted by gtag config
		trackPageview(nav.to?.url.pathname ?? location.pathname);
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" />
</svelte:head>
{@render children()}
