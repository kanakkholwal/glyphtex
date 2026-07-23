<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '@glyphtex/ui/button';
	import { Logo } from '@glyphtex/ui/logo';

	import type { PackDefinition } from 'glyphtex-engine';
	import {
		Workbench,
		type DownloadRequest,
		type GlyphFile,
		type WorkbenchController
	} from '@glyphtex/ui/application';
	import { toast } from '@glyphtex/ui/sonner';
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import { bucket, track, type DocumentSource } from '$lib/analytics';
	import { needsBiber } from '$lib/citations';
	import { compileFiles, engineReady, installPacks, warmEngine } from '$lib/compile';
	import EngineInstallDialog from '$lib/EngineInstallDialog.svelte';
	import EngineNotices from '$lib/EngineNotices.svelte';
	import { gitProvider, gitRootFor, onWorkingTreeChanged } from '$lib/git';
	import { binaryMap, toCompileFiles, toGlyphFiles, toNewFiles } from '$lib/storage/bridge';
	import {
		filesFromDataTransfer,
		importFolder,
		importLooseFiles,
		importZipFile,
		type ImportResult
	} from '$lib/storage/import';
	import {
		createProject,
		getProject,
		readFiles,
		renameProject,
		setEntry,
		writeFiles,
		type StoredProject
	} from '$lib/storage/projects';
	import { writeZip } from '$lib/storage/zip';

	const id = $derived(page.params.id ?? '');

	// One explicit status rather than a set of flags with loading as the fallback:
	// any combination the flags didn't anticipate used to render as "loading" forever.
	type LoadStatus = 'loading' | 'ready' | 'missing' | 'error';

	let project = $state<StoredProject | undefined>(undefined);
	let initialFiles = $state<GlyphFile[] | undefined>(undefined);
	let status = $state<LoadStatus>('loading');
	let loadError = $state('');
	let reloadToken = $state(0);
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
	let zipInput = $state<HTMLInputElement>();
	let folderInput = $state<HTMLInputElement>();
	let accept = $state('');

	let missingPacks = $state<PackDefinition[]>([]);
	let unsupportedFiles = $state<string[]>([]);
	let requiresBiber = $state(false);
	let installingPacks = $state(false);
	let packError = $state<string | undefined>(undefined);

	let lastCompiled: { files: GlyphFile[]; entry: string } | undefined;

	// Keyed on `id`, not mounted once: SvelteKit reuses this component when moving
	// between documents, so a mount-only load would keep showing the previous one.
	$effect(() => {
		const wanted = id;
		void reloadToken;
		let stale = false;

		void (async () => {
			status = 'loading';
			loadError = '';
			try {
				const found = await getProject(wanted);
				if (stale) return;
				if (!found) {
					status = 'missing';
					return;
				}
				const files = await readFiles(wanted);
				if (stale) return;
				binary = new SvelteMap(binaryMap(files));
				project = found;
				initialFiles = toGlyphFiles(files);
				latest = initialFiles;
				status = 'ready';
				track('document_opened', { files: bucket(files.length) });
			} catch (error) {
				if (stale) return;
				// An Error with an empty message would otherwise read as "no error".
				loadError = (error instanceof Error && error.message) || 'Could not open this document.';
				status = 'error';
			}
		})();

		// A slower response for the document we just navigated away from must not
		// overwrite the one we are now showing.
		return () => {
			stale = true;
		};
	});

	// The engine is global, not per-document, so this stays a one-time check.
	onMount(async () => {
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

	// Pull / clone / discard rewrite storage underneath the open session, so the
	// editor has to re-read rather than keep serving (and later re-saving) stale text.
	onMount(() =>
		onWorkingTreeChanged(async (changed) => {
			if (changed !== id || !ctrl) return;
			try {
				const files = await readFiles(id);
				binary = new SvelteMap(binaryMap(files));
				latest = toGlyphFiles(files);
				await ctrl.files.reloadFrom(latest.map((f) => ({ name: f.name, content: f.content })));
				const found = await getProject(id);
				if (found) project = found;
			} catch (error) {
				toast.error(error instanceof Error ? error.message : 'Could not reload this document.');
			}
		})
	);

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
			console.error('[GlyphTeX]', error);
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

	/** Leave for the documents list, where opening another document belongs. */
	function openProject(): void {
		void goto(resolve('/workspace'));
	}

	// "Open folder" / "Import project" make a NEW document rather than replacing the
	// open one — on web a document is browser storage, not a folder we can swap.
	async function importAsNewProject(
		load: () => Promise<ImportResult>,
		source: DocumentSource
	): Promise<void> {
		try {
			const { files, name, skipped } = await load();
			if (files.length === 0) {
				toast.error('Nothing in there could be imported.');
				return;
			}
			const created = await createProject(name, files);
			track('document_created', { source, files: bucket(files.length) });
			if (skipped.length > 0) toast.warning(`Skipped ${skipped.length} files.`);
			void goto(resolve(`/workspace/projects/${created.id}` as `/workspace/projects/${string}`));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not import that.');
		}
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
						? '% Binary file — edited outside GlyphTeX, included as-is.\n'
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

	function saveBlob(blob: Blob, filename: string): void {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		URL.revokeObjectURL(url);
	}

	/** Current bytes for a project-relative path — stored image/PDF data, else text. */
	function bytesOf(path: string, files: GlyphFile[]): Uint8Array {
		const data = binary.get(path);
		if (data) return data;
		const file = files.find((f) => f.name === path);
		return new TextEncoder().encode(file?.content ?? file?.saved ?? '');
	}

	async function exportZip(): Promise<void> {
		if (!project) return;
		try {
			const files = ctrl?.files.snapshotFiles() ?? latest;
			const zip = await writeZip(
				files.map((f) => ({ path: f.name, data: bytesOf(f.name, files) }))
			);
			saveBlob(
				new Blob([zip as BlobPart], { type: 'application/zip' }),
				`${project.name.replace(/[^\w.-]+/g, '-') || 'document'}.zip`
			);
			track('document_exported', { files: bucket(files.length) });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not export.');
		}
	}

	// Explorer "…" → Download. A single file saves as itself; a folder is zipped
	// re-rooted at its own name, so unzipping never scatters files into the CWD.
	async function download(request: DownloadRequest): Promise<void> {
		const files = ctrl?.files.snapshotFiles() ?? latest;
		try {
			if (request.kind === 'file') {
				const path = request.paths[0];
				if (!path) return;
				saveBlob(new Blob([bytesOf(path, files) as BlobPart]), request.name);
				return;
			}
			const root = request.root ?? '';
			const cut = root.lastIndexOf('/') + 1;
			const zip = await writeZip(
				request.paths.map((path) => ({ path: path.slice(cut), data: bytesOf(path, files) }))
			);
			saveBlob(
				new Blob([zip as BlobPart], { type: 'application/zip' }),
				`${request.name.replace(/[^\w.-]+/g, '-') || 'folder'}.zip`
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not download.');
		}
	}

	// The asset viewer reads images / PDFs by project-relative path.
	async function readFileBytes(path: string): Promise<Uint8Array> {
		const data = binary.get(path);
		if (!data) throw new Error(`${path} is not stored in this document.`);
		return data;
	}

	async function onDrop(event: DragEvent): Promise<void> {
		event.preventDefault();
		dragging = false;
		if (!event.dataTransfer) return;
		// Reads dropped folders recursively (works in Firefox/Chrome/Safari), so a
		// whole project directory can be dragged in, not just loose files.
		const files = await filesFromDataTransfer(event.dataTransfer);
		if (files.length > 0) void addFiles(files);
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
		requiresBiber = needsBiber(source?.saved ?? source?.content ?? '');

		const startedAt = performance.now();
		const outcome = await compileFiles(toCompileFiles(files, binary), main, id);
		missingPacks = outcome.missingPacks ?? [];
		unsupportedFiles = outcome.unsupportedFiles ?? [];
		track('compile_finished', {
			ok: Boolean(outcome.pdf),
			duration_ms: Math.round(performance.now() - startedAt),
			files: bucket(files.length),
			missing_packs: missingPacks.length,
			diagnostics: outcome.diagnostics?.length ?? 0
		});
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
		track('engine_installed');
	}
</script>

<svelte:head>
	<title>{project ? `${project.name} · GlyphTeX` : 'GlyphTeX'}</title>
</svelte:head>

{#if status === 'missing'}
	<div
		class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
	>
		<h1 class="text-lg font-semibold">This document no longer exists</h1>
		<p class="text-muted-foreground text-sm">
			It may have been deleted, or the browser cleared its storage.
		</p>
		<a class="text-sm underline" href={resolve('/workspace')}>Back to documents</a>
	</div>
{:else if status === 'error'}
	<div
		class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
	>
		<h1 class="text-lg font-semibold">Could not open this document</h1>
		<p class="text-muted-foreground text-sm">{loadError}</p>
		<div class="mt-1 flex items-center gap-3">
			<Button variant="outline" size="sm" onclick={() => (reloadToken += 1)}>Try again</Button>
			<a class="text-sm underline" href={resolve('/workspace')}>Back to documents</a>
		</div>
	</div>
{:else if status === 'loading'}
	<div class="flex min-h-dvh flex-col items-center justify-center gap-4">
		<Logo size="lg" />
		<p class="text-muted-foreground text-sm" role="status">Opening document…</p>
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
		<EngineNotices
			{missingPacks}
			{unsupportedFiles}
			{requiresBiber}
			installing={installingPacks}
			error={packError}
			onadd={addMissingPacks}
		/>

		<div class="min-h-0 flex-1">
			<!-- Remount per document: the Workbench captures `initialFiles` when it is
			     constructed, so navigating between documents must rebuild it. -->
			{#key id}
				<Workbench
					platform="web"
					projectName={project.name}
					{initialFiles}
					{saving}
					git={gitProvider}
					gitRoot={gitRootFor(project.id)}
					backHref={resolve('/workspace')}
					backLabel="Documents"
					onRenameProject={rename}
					onAddFiles={pickFiles}
					onOpenProject={openProject}
					onOpenFolder={() => folderInput?.click()}
					onImportProject={() => zipInput?.click()}
					onExportProject={exportZip}
					onDownload={download}
					{readFileBytes}
					onpersist={persist}
					onready={onReady}
					compileFiles={ready ? runCompile : undefined}
					statusNote="Engine: on-device"
				/>
			{/key}
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

	<input
		bind:this={zipInput}
		type="file"
		accept=".zip,application/zip"
		class="hidden"
		onchange={(e) => {
			const file = e.currentTarget.files?.[0];
			if (file) void importAsNewProject(() => importZipFile(file), 'import_zip');
			e.currentTarget.value = '';
		}}
	/>

	<input
		bind:this={folderInput}
		type="file"
		webkitdirectory
		multiple
		class="hidden"
		onchange={(e) => {
			const picked = Array.from(e.currentTarget.files ?? []);
			if (picked.length > 0) void importAsNewProject(() => importFolder(picked), 'import_folder');
			e.currentTarget.value = '';
		}}
	/>

	<EngineInstallDialog bind:open={showInstall} ondone={onInstalled} />
{:else}
	<div
		class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
	>
		<h1 class="text-lg font-semibold">Could not open this document</h1>
		<p class="text-muted-foreground text-sm">
			It loaded without any content, which shouldn’t happen.
		</p>
		<div class="mt-1 flex items-center gap-3">
			<Button variant="outline" size="sm" onclick={() => (reloadToken += 1)}>Try again</Button>
			<a class="text-sm underline" href={resolve('/workspace')}>Back to documents</a>
		</div>
	</div>
{/if}
