<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { PackDefinition } from '@glyphx/tex-engine';
	import { Workbench, type GlyphFile } from '@glyphx/ui/application';
	import { toast } from '@glyphx/ui/sonner';
	import { onMount } from 'svelte';

	import { citationCommands } from '$lib/citations';
	import { compileFiles, engineReady, installPacks, warmEngine } from '$lib/compile';
	import EngineInstallDialog from '$lib/EngineInstallDialog.svelte';
	import EngineNotices from '$lib/EngineNotices.svelte';
	import { binaryMap, toCompileFiles, toGlyphFiles, toNewFiles } from '$lib/storage/bridge';
	import { getProject, readFiles, writeFiles, type StoredProject } from '$lib/storage/projects';

	const id = $derived(page.params.id ?? '');

	let project = $state<StoredProject | undefined>(undefined);
	let initialFiles = $state<GlyphFile[] | undefined>(undefined);
	let missing = $state(false);
	let loadError = $state<string | undefined>(undefined);

	// Bytes for binary assets, keyed by path. The editor holds only a placeholder
	// for these, so they must be carried separately through save and compile.
	let binary = new Map<string, Uint8Array>();

	let ready = $state(false);
	let showInstall = $state(false);

	let missingPacks = $state<PackDefinition[]>([]);
	let unsupportedFiles = $state<string[]>([]);
	let unsupportedCitations = $state<string[]>([]);
	let installingPacks = $state(false);
	let packError = $state<string | undefined>(undefined);

	let lastCompiled: { files: GlyphFile[]; entry: string } | undefined;

	onMount(async () => {
		try {
			const found = await getProject(id);
			if (!found) {
				missing = true;
				return;
			}
			const files = await readFiles(id);
			binary = binaryMap(files);
			project = found;
			initialFiles = toGlyphFiles(files);
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Could not open this document.';
			return;
		}

		try {
			const installed = await engineReady();
			ready = installed;
			if (installed) warmEngine();
			else showInstall = true;
		} catch {
			// Fail open: failing closed strands the user with no dialog and no compiler.
			ready = false;
			showInstall = true;
		}
	});

	async function persist(files: GlyphFile[]): Promise<void> {
		if (!project) return;
		try {
			await writeFiles(project.id, toNewFiles(files, binary));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not save.');
			console.error('[GlyphX]', error);
		}
	}

	async function runCompile(files: GlyphFile[], entry: string) {
		const main = entry || project?.entry || 'main.tex';
		lastCompiled = { files, entry: main };

		const source = files.find((f) => f.name === main);
		unsupportedCitations = citationCommands(source?.saved ?? source?.content ?? '');

		const outcome = await compileFiles(toCompileFiles(files, binary), main);
		missingPacks = outcome.missingPacks ?? [];
		unsupportedFiles = outcome.unsupportedFiles ?? [];
		return outcome;
	}

	async function addMissingPacks(): Promise<void> {
		installingPacks = true;
		packError = undefined;
		try {
			await installPacks(missingPacks.map((p) => p.id));
			missingPacks = [];
			if (lastCompiled) await runCompile(lastCompiled.files, lastCompiled.entry);
		} catch (error) {
			packError = error instanceof Error ? error.message : String(error);
		} finally {
			installingPacks = false;
		}
	}

	function onInstalled(): void {
		ready = true;
		showInstall = false;
	}
</script>

<svelte:head>
	<title>{project ? `${project.name} · GlyphX` : 'GlyphX'}</title>
</svelte:head>

{#if missing}
	<div
		class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
	>
		<h1 class="text-lg font-semibold">This document no longer exists</h1>
		<p class="text-sm text-muted-foreground">
			It may have been deleted, or the browser cleared its storage.
		</p>
		<a class="text-sm underline" href={resolve('/projects')}>Back to documents</a>
	</div>
{:else if loadError}
	<div
		class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
	>
		<h1 class="text-lg font-semibold">Could not open this document</h1>
		<p class="text-sm text-muted-foreground">{loadError}</p>
		<a class="text-sm underline" href={resolve('/projects')}>Back to documents</a>
	</div>
{:else if project && initialFiles}
	<EngineNotices
		{missingPacks}
		{unsupportedFiles}
		{unsupportedCitations}
		installing={installingPacks}
		error={packError}
		onadd={addMissingPacks}
	/>

	<Workbench
		platform="web"
		projectName={project.name}
		{initialFiles}
		onpersist={persist}
		compileFiles={ready ? runCompile : undefined}
		statusNote="Engine: on-device"
	/>

	<EngineInstallDialog bind:open={showInstall} ondone={onInstalled} />
{:else}
	<div class="flex min-h-dvh items-center justify-center">
		<p class="text-sm text-muted-foreground" role="status">Opening document…</p>
	</div>
{/if}
