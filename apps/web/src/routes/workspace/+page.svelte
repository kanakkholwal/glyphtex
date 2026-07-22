<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ProjectsHome } from '@glyphtex/ui/application';
	import { toast } from '@glyphtex/ui/sonner';
	import { onMount } from 'svelte';

	import StoragePanel from '$lib/StoragePanel.svelte';
	import { toProjectCard } from '$lib/storage/bridge';
	import {
		filesFromDataTransfer,
		importFolder,
		importZipFile,
		type ImportResult
	} from '$lib/storage/import';
	import {
		createProject,
		deleteProject,
		duplicateProject,
		listProjects,
		renameProject,
		type StoredProject
	} from '$lib/storage/projects';
	import { requestPersistence } from '$lib/storage/quota';
	import { starterFiles } from '$lib/storage/template';
	import { Logo } from '@glyphtex/ui/logo';

	let stored = $state<StoredProject[]>([]);
	let loading = $state(true);
	let failure = $state<string | undefined>(undefined);
	let storageOpen = $state(false);

	const projects = $derived(stored.map(toProjectCard));

	function report(error: unknown, fallback: string): void {
		const message = error instanceof Error ? error.message : fallback;
		toast.error(message);
		console.error('[GlyphTeX]', error);
	}

	async function refresh(): Promise<void> {
		stored = await listProjects();
	}

	onMount(async () => {
		try {
			await refresh();
			// Only ask once there is something worth keeping; a prompt on an empty
			// app is noise, and Firefox shows a real permission dialog.
			if (stored.length > 0) void requestPersistence();
		} catch (error) {
			failure = error instanceof Error ? error.message : 'Could not read saved documents.';
		} finally {
			loading = false;
		}
	});

	let zipInput = $state<HTMLInputElement>();
	let importing = $state(false);
	let dragging = $state(false);

	async function runImport(load: () => Promise<ImportResult>): Promise<void> {
		importing = true;
		try {
			const { files, name, skipped } = await load();
			if (files.length === 0) {
				toast.error('Nothing in there could be imported.');
				return;
			}
			const project = await createProject(name, files);
			await refresh();
			void requestPersistence();
			if (skipped.length > 0) {
				toast.warning(
					`Imported ${files.length} files. Skipped ${skipped.length}: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}`
				);
			} else {
				toast.success(`Imported ${files.length} files.`);
			}
			open(project.id);
		} catch (error) {
			report(error, 'Could not import that.');
		} finally {
			importing = false;
		}
	}

	function pickZip(event: Event): void {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (file) void runImport(() => importZipFile(file));
		if (zipInput) zipInput.value = '';
	}

	async function onDrop(event: DragEvent): Promise<void> {
		event.preventDefault();
		dragging = false;
		if (!event.dataTransfer) return;
		const dropped = Array.from(event.dataTransfer.files);
		// A single .zip imports as an archive; anything else (incl. a whole folder,
		// read recursively) imports as loose files preserving structure.
		if (dropped.length === 1 && /\.zip$/i.test(dropped[0].name)) {
			void runImport(() => importZipFile(dropped[0]));
			return;
		}
		const files = await filesFromDataTransfer(event.dataTransfer);
		if (files.length > 0) void runImport(() => importFolder(files));
	}

	function onDragOver(event: DragEvent): void {
		if (!event.dataTransfer?.types.includes('Files')) return;
		event.preventDefault();
		dragging = true;
	}

	async function handleCreate(): Promise<string | void> {
		try {
			const project = await createProject('Untitled', starterFiles());
			await refresh();
			void requestPersistence();
			return project.id;
		} catch (error) {
			report(error, 'Could not create the document.');
		}
	}

	function open(id: string): void {
		void goto(resolve(`/projects/${id}` as `/projects/${string}`));
	}

	async function rename(id: string, name: string): Promise<void> {
		try {
			await renameProject(id, name);
			await refresh();
		} catch (error) {
			report(error, 'Could not rename the document.');
		}
	}

	async function duplicate(id: string): Promise<void> {
		try {
			await duplicateProject(id);
			await refresh();
		} catch (error) {
			report(error, 'Could not duplicate the document.');
		}
	}

	async function remove(id: string): Promise<void> {
		try {
			await deleteProject(id);
			await refresh();
		} catch (error) {
			report(error, 'Could not delete the document.');
		}
	}
</script>

<svelte:head>
	<title>Documents · GlyphTeX</title>
	<meta name="description" content="Your GlyphTeX LaTeX documents, stored in this browser." />
</svelte:head>

{#if loading}
	<div class="flex min-h-dvh items-center justify-center flex-col gap-4 text-center">
		<Logo size="lg" />
		<p class="text-sm text-muted-foreground" role="status">Loading your documents…</p>
	</div>
{:else if failure}
	<div
		class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
	>
		<h1 class="text-lg font-semibold">Local storage is unavailable</h1>
		<p class="text-sm text-muted-foreground">{failure}</p>
		<p class="text-sm text-muted-foreground">
			Private windows and blocked site data both prevent saving. The
			<a class="underline" href={resolve('/editor')}>scratch editor</a> still works.
		</p>
	</div>
{:else}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="min-h-dvh"
		ondragover={onDragOver}
		ondragleave={() => (dragging = false)}
		ondrop={onDrop}
	>
		<ProjectsHome
			platform="web"
			{projects}
			oncreate={handleCreate}
			onopen={open}
			onrename={rename}
			onduplicate={duplicate}
			ondelete={remove}
			onsettings={() => (storageOpen = true)}
			onimport={() => zipInput?.click()}
		/>
	</div>
{/if}

<!-- Kept out of the tree above so a re-render never drops a pending pick. -->
<input
	bind:this={zipInput}
	type="file"
	accept=".zip,application/zip"
	class="hidden"
	onchange={pickZip}
/>

{#if dragging}
	<div
		class="border-brand bg-background/80 pointer-events-none fixed inset-4 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed backdrop-blur-sm"
		role="status"
	>
		<p class="text-base font-medium">Drop a folder or .zip to import a document</p>
	</div>
{/if}

{#if importing}
	<div
		class="bg-background/70 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
		role="status"
	>
		<p class="text-sm font-medium">Importing…</p>
	</div>
{/if}

<StoragePanel bind:open={storageOpen} />
