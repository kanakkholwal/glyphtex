<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { dev } from '$app/environment';
	import { settings } from '@glyphx/ui/settings';
	import { loadAnalytics, trackPageview } from '$lib/analytics';
	import './layout.css';

	let { children } = $props();

	// Keep `.dark` on <html> in sync with the resolved theme. Re-runs on toggle
	// and on cross-window storage sync (PersistedState updates `resolved`).
	$effect(() => {
		settings.apply();
	});

	// Google Analytics (no-op unless PUBLIC_GA_ID is set). gtag.js sends the
	// initial page_view on load; we report each subsequent client navigation.
	onMount(() => loadAnalytics());

	/**
	 * Register the service worker — production only (see `serviceWorker.register`
	 * in vite.config.ts for why).
	 *
	 * In development we go further and actively remove any worker a previous
	 * production build (or an earlier dev server on this port) left registered.
	 * Ports get reused across projects, and an orphaned worker happily serves
	 * stale modules and intercepts HMR, which presents as impossible bugs.
	 */
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
