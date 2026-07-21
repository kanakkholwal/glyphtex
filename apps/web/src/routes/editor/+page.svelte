<script lang="ts">
	import { Workbench } from '@glyphx/ui/application';
	import { compileLatex, warmEngine, engineReady } from '$lib/compile';
	import { citationCommands } from '$lib/citations';
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
		void engineReady()
			.then((installed) => {
				ready = installed;
				if (installed) {
					// Already installed — warm the engine for an instant first compile.
					warmEngine();
				} else {
					showInstall = true;
				}
			})
			.catch(() => {
				// If we cannot tell whether the engine is installed, offer to install
				// it. Failing closed here is what produced the worst bug this page
				// has had: no dialog AND no compiler, with the status bar quietly
				// reading "Compiler not ready" and no way for the user to act on it.
				// Re-downloading an engine someone already has is a far smaller cost
				// than stranding them.
				ready = false;
				showInstall = true;
			});
	});

	// Bibliographies need BibTeX or Biber, which are separate programs the
	// in-browser engine has no way to run. Rather than let the citations quietly
	// render as [?], say so once, on the compile that used them. Detection runs
	// here (not in the engine) because desktop drives a real TeX installation and
	// does run bibtex — this is a web-only limitation.
	let unsupportedCitations = $state<string[]>([]);

	async function compileWithNotice(source: string) {
		unsupportedCitations = citationCommands(source);
		return compileLatex(source);
	}

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

{#if unsupportedCitations.length > 0}
	<div
		role="status"
		class="border-border bg-muted/40 text-muted-foreground flex items-center gap-2 border-b px-3 py-1.5 text-xs"
	>
		<span class="text-foreground/70 font-medium">Bibliography not generated</span>
		<span>
			{unsupportedCitations.join(', ')} needs BibTeX or Biber, which cannot run in the browser yet. The
			document still compiles; citations will show as [?].
		</span>
	</div>
{/if}

<Workbench
	platform="web"
	compile={ready ? compileWithNotice : undefined}
	statusNote={serverNote}
/>

<EngineInstallDialog bind:open={showInstall} ondone={onInstalled} />
