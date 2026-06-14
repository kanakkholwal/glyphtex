<script lang="ts">
	import { goto, onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { launch } from '$lib/launch';
	import { projectHost } from '$lib/project';
	import { initTauriTheme } from '$lib/tauri-theme';
	import { NavProgress } from '@glyphx/ui/nav-progress';
	import { settings } from '@glyphx/ui/settings';
	import { onMount, tick } from 'svelte';
	import './layout.css';

	let { children } = $props();

	// Dismiss the boot splash (in app.html) once the app has mounted.
	onMount(async () => {
		await tick();
		const boot = document.getElementById('boot');
		if (!boot) return;
		boot.classList.add('boot-leaving');
		setTimeout(() => boot.remove(), 300);
	});

	// Page transitions via the View Transitions API. The projects home and the
	// editor share a per-project `view-transition-name`, so the clicked card
	// morphs into the editor (and collapses back on return). Skipped when the
	// API is unavailable or the user prefers reduced motion.
	onNavigate((navigation) => {
		if (typeof document === 'undefined' || !document.startViewTransition) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		// Tag the direction so CSS can react (e.g. the logo pulses when we land
		// back on the projects home).
		const toHome = navigation.to?.url.pathname === '/';
		document.documentElement.dataset.vt = toHome ? 'to-home' : 'to-editor';
		return new Promise((settle) => {
			const transition = document.startViewTransition(async () => {
				settle();
				await navigation.complete;
			});
			transition.finished.finally(() => {
				delete document.documentElement.dataset.vt;
			});
		});
	});

	// File association: open the folder / file GlyphX was launched with (and react
	// to later "Open with GlyphX" launches forwarded by the single-instance
	// plugin) by routing into the folder-mode editor.
	onMount(() => {
		let unlisten: (() => void) | undefined;
		void (async () => {
			try {
				const p = await projectHost.takeLaunchPath?.();
				if (p) {
					launch.path = p;
					await goto(resolve('/editor/folder'));
				}
			} catch {
				/* no launch path */
			}
			try {
				unlisten = await projectHost.onOpenPath?.((path) => {
					launch.path = path;
					void goto(resolve('/editor/folder'));
				});
			} catch {
				/* event bridge unavailable */
			}
		})();
		return () => unlisten?.();
	});

	// Keep `.dark` on <html> in sync with the resolved theme.
	$effect(() => {
		settings.apply();
	});

	// On desktop, let Tauri drive system-theme detection (overrides matchMedia).
	$effect(() => {
		let active = true;
		let cleanup = () => {};
		initTauriTheme().then((fn) => {
			if (active) cleanup = fn;
			else fn();
		});
		return () => {
			active = false;
			cleanup();
		};
	});
</script>

<svelte:head><link rel="icon" href="/favicon.ico" /></svelte:head>

<NavProgress color="var(--brand)" />

{@render children()}
