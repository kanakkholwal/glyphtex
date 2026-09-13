<script lang="ts">
	import { goto, onNavigate } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { launch } from "$lib/launch";
	import { prefetchCommonPackagesOnce } from "$lib/prefetch";
	import { projectHost } from "$lib/project";
	import { initTauriTheme } from "$lib/tauri-theme";
	import { updater } from "$lib/updater.svelte";
	import UpdaterCard from "$lib/updater-card.svelte";
	import { NavProgress } from "@glyphtex/ui/nav-progress";
	import { settings } from "@glyphtex/ui/settings";
	import { onMount, tick } from "svelte";
	import "./layout.css";

	let { children } = $props();

	// Dismiss the boot splash (in app.html) once the app has mounted.
	onMount(async () => {
		await tick();
		const boot = document.getElementById("boot");
		if (!boot) return;
		boot.classList.add("boot-leaving");
		setTimeout(() => boot.remove(), 300);
	});

	// Silent boot update check: the corner card appears only if a newer release exists.
	onMount(() => updater.init());

	// Warm the package cache once, after first paint, so the first offline compile works.
	// Best-effort: a failure retries on a later launch.
	onMount(() => {
		const t = setTimeout(() => void prefetchCommonPackagesOnce(), 2500);
		return () => clearTimeout(t);
	});

	// The home card and the editor share a per-project `view-transition-name`, so the card morphs.
	// Skipped without the API or under reduced motion.
	onNavigate((navigation) => {
		if (typeof document === "undefined" || !document.startViewTransition) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		// Direction tag for CSS, e.g. the logo pop on landing back home.
		const toHome = navigation.to?.url.pathname === "/";
		document.documentElement.dataset.vt = toHome ? "to-home" : "to-editor";
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

	// File association: open the launch path, and later ones forwarded by the single-instance plugin.
	onMount(() => {
		let unlisten: (() => void) | undefined;
		void (async () => {
			try {
				const p = await projectHost.takeLaunchPath?.();
				if (p) {
					launch.path = p;
					await goto(resolve("/editor/folder"));
				}
			} catch {
				/* no launch path */
			}
			try {
				unlisten = await projectHost.onOpenPath?.((path) => {
					launch.path = path;
					void goto(resolve("/editor/folder"));
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

<NavProgress color="var(--primary)" />

{@render children()}

<UpdaterCard />
