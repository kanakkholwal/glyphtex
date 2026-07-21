<script lang="ts">
	import { Workbench } from '@glyphx/ui/application';
	import { compileLatex, warmEngine, engineReady } from '$lib/compile';
	import EngineInstallDialog from '$lib/EngineInstallDialog.svelte';
	import { onMount } from 'svelte';

	// The engine and its TeX bundle are served from our own origin and cached on
	// the device, so once installed there is no server in the compile path.
	const serverNote = 'Engine: on-device';

	// First-run gate: the in-browser compiler (engine WASM + TeX bundle) must be
	// downloaded before anything compiles. Until it is, `compile` is withheld so
	// the Workbench never auto-compiles into a cold engine, and the install dialog
	// is shown (required — not dismissable).
	let ready = $state(false);
	let showInstall = $state(false);

	onMount(() => {
		// Asks the cache directly, so clearing site data correctly brings the
		// prompt back rather than leaving us claiming an engine we don't have.
		void engineReady().then((installed) => {
			ready = installed;
			if (installed) {
				// Already installed — warm the engine for an instant first compile.
				warmEngine();
			} else {
				showInstall = true;
			}
		});
	});

	function onInstalled() {
		// The engine is already booted + warmed by the install; flipping `ready`
		// wires `compile`, and the Workbench's auto-compile takes over.
		ready = true;
		showInstall = false;
	}
</script>

<svelte:head>
	<title>GlyphX — Editor</title>
</svelte:head>

<Workbench platform="web" compile={ready ? compileLatex : undefined} statusNote={serverNote} />

<EngineInstallDialog bind:open={showInstall} ondone={onInstalled} />
