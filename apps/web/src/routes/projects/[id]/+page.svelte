<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { PackDefinition } from '@glyphx/tex-engine';
	import { Workbench, type GlyphFile, type WorkbenchController } from '@glyphx/ui/application';
	import { toast } from '@glyphx/ui/sonner';
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import { citationCommands } from '$lib/citations';
	import { compileFiles, engineReady, installPacks, warmEngine } from '$lib/compile';
	import EngineInstallDialog from '$lib/EngineInstallDialog.svelte';
	import EngineNotices from '$lib/EngineNotices.svelte';
	import WorkspaceBar from '$lib/WorkspaceBar.svelte';
	import { binaryMap, toCompileFiles, toGlyphFiles, toNewFiles } from '$lib/storage/bridge';
	import { importLooseFiles } from '$lib/storage/import';
	import {
		getProject,
		readFiles,
		renameProject,
		setEntry,
		writeFiles,
		type StoredProject
	} from '$lib/storage/projects';
	import { writeZip } from '$lib/storage/zip';

	const id = $derived(page.params.id ?? '');

	let project = $state<StoredProject | undefined>(undefined);
	let initialFiles = $state<GlyphFile[] | undefined>(undefined);
	let missing = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let saving = $state(false);

	// Bytes for binary assets, keyed by path. The editor holds only a placeholder
	// for these, so they are carried separately through save and compile.
	let binary = new SvelteMap<string, Uint8Array>();
	let ctrl = $state<WorkbenchController | undefined>(undefined);
	let latest: GlyphFile[] = [];

	let ready = $state(false);
	let showInstall = $state(false);
	let dragging = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let accept = $state('');

	let missingPacks = $state<PackDefinition[]>([]);
	let unsupportedFiles = $state<string[]>([]);
	let unsupportedCitations = $state<string[]>([]);
	let installingPacks = $state(false);
	let packError = $state<string | undefined>(undefined);

	let lastCompiled: { files: GlyphFile[]; entry: string } | undefined;

	const texFiles = $derived(
		(ctrl?.files.files ?? initialFiles ?? [])
			.map((f) => f.name)
			.filter((n) => n.endsWith('.tex'))
			.sort()
	);

	onMount(async () => {
		try {
			const found = await getProject(id);
			if (!found) {
				missing = true;
				return;
			}
			const files = await readFiles(id);
			binary = new SvelteMap(binaryMap(files));
			project = found;
			initialFiles = toGlyphFiles(files);
			latest = initialFiles;
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

	// The workbench owns `mainId`; mirror the stored entry into it once mounted so
	// the Explorer's "main" badge and the compile entry agree.
	function onReady(controller: WorkbenchController): void {
		ctrl = controller;
		const entry = project?.entry;
		const match = controller.files.files.find((f) => f.name === entry);
		if (match) void controller.files.setMain(match.id);
	}

	// `setMain` is also reachable from the Explorer, so the store is the source of
	// truth and the stored entry follows it.
	$effect(() => {
		const mainId = ctrl?.files.mainId;
		if (!mainId || !project) return;
		const name = ctrl?.files.files.find((f) => f.id === mainId)?.name;
		if (!name || name === project.entry) return;
		void setEntry(project.id, name)
			.then((next) => (project = next))
			.catch(() => {
				/* the compile fallback still resolves an entry */
			});
	});

	async function persist(files: GlyphFile[]): Promise<void> {
		if (!project) return;
		latest = files;
		saving = true;
		try {
			await writeFiles(project.id, toNewFiles(files, binary));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not save.');
			console.error('[GlyphX]', error);
		} finally {
			saving = false;
		}
	}

	async function rename(name: string): Promise<void> {
		if (!project) return;
		try {
			project = await renameProject(project.id, name);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not rename.');
		}
	}

	function chooseEntry(path: string): void {
		const match = ctrl?.files.files.find((f) => f.name === path);
		if (match) void ctrl?.files.setMain(match.id);
	}

	function pickFiles(want: string): void {
		accept = want;
		// Let `accept` land on the input before it opens the picker.
		queueMicrotask(() => fileInput?.click());
	}

	async function addFiles(list: FileList | File[]): Promise<void> {
		if (!project) return;
		try {
			const { files, skipped } = await importLooseFiles(list);
			if (files.length === 0) {
				toast.error(skipped[0] ? `Skipped ${skipped[0]}` : 'Nothing to add.');
				return;
			}
			for (const f of files) if (f.data) binary.set(f.path, f.data);

			// Into the live session first, so the tree updates without a reload; the
			// debounced persist then writes the merged set.
			ctrl?.files.addFiles(
				files.map((f) => ({
					name: f.path,
					content: f.data
						? '% Binary file — edited outside GlyphX, included as-is.\n'
						: (f.text ?? '')
				}))
			);
			if (ctrl) await persist(ctrl.files.snapshotFiles());
			toast.success(`Added ${files.length} file${files.length === 1 ? '' : 's'}.`);
			if (skipped.length > 0) toast.warning(`Skipped ${skipped.join(', ')}`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not add those files.');
		}
	}

	async function exportZip(): Promise<void> {
		if (!project) return;
		try {
			const files = ctrl?.files.snapshotFiles() ?? latest;
			const encoder = new TextEncoder();
			const zip = await writeZip(
				files.map((f) => ({
					path: f.name,
					data: binary.get(f.name) ?? encoder.encode(f.saved ?? f.content)
				}))
			);
			const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
			const link = document.createElement('a');
			link.href = url;
			link.download = `${project.name.replace(/[^\w.-]+/g, '-') || 'document'}.zip`;
			link.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not export.');
		}
	}

	function onDrop(event: DragEvent): void {
		event.preventDefault();
		dragging = false;
		const list = event.dataTransfer?.files;
		if (list && list.length > 0) void addFiles(list);
	}

	function onDragOver(event: DragEvent): void {
		// Only external file drags; the Explorer handles its own internal moves.
		if (!event.dataTransfer?.types.includes('Files')) return;
		event.preventDefault();
		dragging = true;
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
		<p class="text-muted-foreground text-sm">
			It may have been deleted, or the browser cleared its storage.
		</p>
		<a class="text-sm underline" href={resolve('/projects')}>Back to documents</a>
	</div>
{:else if loadError}
	<div
		class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
	>
		<h1 class="text-lg font-semibold">Could not open this document</h1>
		<p class="text-muted-foreground text-sm">{loadError}</p>
		<a class="text-sm underline" href={resolve('/projects')}>Back to documents</a>
	</div>
{:else if project && initialFiles}
	<div
		class="flex h-dvh flex-col"
		ondragover={onDragOver}
		ondragleave={() => (dragging = false)}
		ondrop={onDrop}
		role="application"
		aria-label="{project.name} workspace"
	>
		<WorkspaceBar
			name={project.name}
			entry={project.entry}
			{texFiles}
			{saving}
			onrename={rename}
			onsetentry={chooseEntry}
			onaddfiles={pickFiles}
			onexport={exportZip}
		/>

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
				projectName={project.name}
				{initialFiles}
				onpersist={persist}
				onready={onReady}
				compileFiles={ready ? runCompile : undefined}
				statusNote="Engine: on-device"
			/>
		</div>

		{#if dragging}
			<div
				class="border-brand bg-background/80 pointer-events-none fixed inset-3 z-50 flex items-center justify-center rounded-xl border-2 border-dashed backdrop-blur-sm"
				role="status"
			>
				<p class="text-sm font-medium">Drop files to add them to this document</p>
			</div>
		{/if}
	</div>

	<input
		bind:this={fileInput}
		type="file"
		multiple
		{accept}
		class="hidden"
		onchange={(e) => {
			const list = e.currentTarget.files;
			if (list && list.length > 0) void addFiles(list);
			e.currentTarget.value = '';
		}}
	/>

	<EngineInstallDialog bind:open={showInstall} ondone={onInstalled} />
{:else}
	<div class="flex min-h-dvh items-center justify-center">
		<p class="text-muted-foreground text-sm" role="status">Opening document…</p>
	</div>
{/if}
