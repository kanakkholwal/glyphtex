<script lang="ts">
	import { Workbench } from '@glyphx/ui/application';
	import type { PackDefinition } from '@glyphx/tex-engine';
	import { compileLatex, installPacks, warmEngine, engineReady } from '$lib/compile';
	import { citationCommands } from '$lib/citations';
	import EngineInstallDialog from '$lib/EngineInstallDialog.svelte';
	import EngineNotices from '$lib/EngineNotices.svelte';
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

<div class="flex h-dvh flex-col">
	<EngineNotices
		{missingPacks}
		{unsupportedFiles}
		{unsupportedCitations}
		installing={installingPacks}
		error={packError}
		onadd={addMissingPacks}
	/>

	<div class="min-h-0 flex-1">
		<Workbench
			platform="web"
			compile={ready ? compileWithNotice : undefined}
			statusNote={serverNote}
		/>
	</div>
</div>

<EngineInstallDialog bind:open={showInstall} ondone={onInstalled} />
