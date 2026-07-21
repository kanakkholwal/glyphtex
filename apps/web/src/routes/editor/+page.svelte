<script lang="ts">
	import { Workbench } from '@glyphx/ui/application';
	import { Button } from '@glyphx/ui/button';
	import type { PackDefinition } from '@glyphx/tex-engine';
	import { compileLatex, installPacks, warmEngine, engineReady } from '$lib/compile';
	import { citationCommands } from '$lib/citations';
	import EngineInstallDialog from '$lib/EngineInstallDialog.svelte';
	import { onMount } from 'svelte';

	const serverNote = 'Engine: on-device';

	// Until installed, `compile` is withheld so the Workbench never auto-compiles
	// into a cold engine.
	let ready = $state(false);
	let showInstall = $state(false);

	onMount(() => {
		void engineReady()
			.then((installed) => {
				ready = installed;
				if (installed) {
					warmEngine();
				} else {
					showInstall = true;
				}
			})
			.catch(() => {
				// Fail open: failing closed here strands the user with no dialog and no
				// compiler. A redundant re-download costs less.
				ready = false;
				showInstall = true;
			});
	});

	// Web-only limitation: BibTeX/Biber cannot run in the browser, so warn instead
	// of silently rendering [?]. Detected here, not in the engine — desktop runs it.
	let unsupportedCitations = $state<string[]>([]);

	let missingPacks = $state<PackDefinition[]>([]);
	let unsupportedFiles = $state<string[]>([]);
	let installingPacks = $state(false);
	let packError = $state<string | undefined>(undefined);

	const packSizeMB = $derived((missingPacks.reduce((n, p) => n + p.bytes, 0) / 1048576).toFixed(2));

	let lastSource = '';

	async function compileWithNotice(source: string) {
		unsupportedCitations = citationCommands(source);
		lastSource = source;
		const outcome = await compileLatex(source);
		missingPacks = outcome.missingPacks ?? [];
		unsupportedFiles = outcome.unsupportedFiles ?? [];
		return outcome;
	}

	async function addMissingPacks() {
		installingPacks = true;
		packError = undefined;
		try {
			// resolveMissing already expanded dependencies, so this is the complete set.
			await installPacks(missingPacks.map((p) => p.id));
			missingPacks = [];
			// Recompile now rather than waiting on the debounced auto-compile.
			if (lastSource) await compileWithNotice(lastSource);
		} catch (e) {
			packError = e instanceof Error ? e.message : String(e);
		} finally {
			installingPacks = false;
		}
	}

	function onInstalled() {
		// The install already booted the engine, so `compile` can be wired straight away.
		ready = true;
		showInstall = false;
	}
</script>

<svelte:head>
	<title>GlyphX — Editor</title>
</svelte:head>

{#if missingPacks.length > 0}
	<div
		role="status"
		class="border-border bg-muted/40 text-muted-foreground flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-xs"
	>
		<span class="text-foreground/70 font-medium">Missing packages</span>
		<span>
			This document needs {missingPacks.map((p) => p.label).join(', ')} ({packSizeMB} MB).
		</span>
		<Button
			size="sm"
			variant="outline"
			class="h-6 px-2 text-xs"
			onclick={addMissingPacks}
			disabled={installingPacks}
		>
			{installingPacks ? 'Adding…' : 'Add'}
		</Button>
		{#if packError}
			<span class="text-destructive">{packError}</span>
		{/if}
	</div>
{/if}

{#if unsupportedFiles.length > 0}
	<div
		role="status"
		class="border-border bg-muted/40 text-muted-foreground flex items-center gap-2 border-b px-3 py-1.5 text-xs"
	>
		<span class="text-foreground/70 font-medium">Unavailable packages</span>
		<span>
			No package set provides {unsupportedFiles.slice(0, 3).join(', ')}{unsupportedFiles.length > 3
				? ` and ${unsupportedFiles.length - 3} more`
				: ''}. These are not supported in the browser yet.
		</span>
	</div>
{/if}

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

<Workbench platform="web" compile={ready ? compileWithNotice : undefined} statusNote={serverNote} />

<EngineInstallDialog bind:open={showInstall} ondone={onInstalled} />
