<script lang="ts">
	import { Workbench } from '@glyphx/ui/application';
	import { compileLatex, warmEngine, engineReady } from '$lib/compile';
	import EngineInstallDialog from '$lib/EngineInstallDialog.svelte';
	import { onMount } from 'svelte';

	// TeX packages are fetched through our own same-origin edge route (proxied +
	// cached), so there's no third-party server to surface here.
	const serverNote = 'Packages: cached at the edge';

	// First-run gate: the in-browser compiler (engine WASM + TeX files) must be
	// downloaded before anything compiles. Until it is, `compile` is withheld so
	// the Workbench never auto-compiles into a cold engine, and the install dialog
	// is shown (required — not dismissable).
	let ready = $state(false);
	let showInstall = $state(false);

	onMount(() => {
		ready = engineReady();
		if (ready) {
			// Already installed before — warm the engine for an instant first compile.
			warmEngine();
		} else {
			showInstall = true;
		}
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
