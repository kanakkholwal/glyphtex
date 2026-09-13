<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { ProjectsHome, type Scope } from "@glyphtex/ui/application";
	import { Button } from "@glyphtex/ui/button";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconDatabaseOff, IconLoader2, IconUpload } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { bucket, track, type DocumentSource } from "$lib/analytics";
	import { cloneToProject } from "$lib/git";
	import StoragePanel from "$lib/StoragePanel.svelte";
	import { toProjectCard } from "$lib/storage/bridge";
	import {
		filesFromDataTransfer,
		importFolder,
		importZipFile,
		type ImportResult
	} from "$lib/storage/import";
	import {
		createProject,
		deleteProject,
		duplicateProject,
		listProjects,
		renameProject,
		setStarred,
		type StoredProject
	} from "$lib/storage/projects";
	import { requestPersistence, storageStatus } from "$lib/storage/quota";
	import { starterFiles } from "$lib/storage/template";

	let { scope = "all" }: { scope?: Scope } = $props();

	const scopeHrefs: Record<Scope, string> = {
		all: resolve("/workspace"),
		recent: resolve("/workspace/recent"),
		starred: resolve("/workspace/starred"),
		templates: resolve("/workspace/templates")
	};

	const titles: Record<Scope, string> = {
		all: "All projects",
		recent: "Recent",
		starred: "Starred",
		templates: "Templates"
	};

	let stored = $state<StoredProject[]>([]);
	let loading = $state(true);
	let failure = $state<string | undefined>(undefined);
	let storageOpen = $state(false);

	const projects = $derived(stored.map(toProjectCard));

	function report(error: unknown, fallback: string): void {
		const message = error instanceof Error ? error.message : fallback;
		toast.error(message);
		console.error("[GlyphTeX]", error);
	}

	// Whole-origin usage (engine cache included), not just documents: that is the
	// number that actually predicts eviction.
	let storage = $state<{ used: number; total: number } | undefined>(undefined);

	async function refresh(): Promise<void> {
		const [list, status] = await Promise.all([listProjects(), storageStatus()]);
		stored = list;
		storage =
			status.unknown || status.quota === 0
				? undefined
				: { used: status.usage, total: status.quota };
	}

	onMount(async () => {
		try {
			await refresh();
		} catch (error) {
			failure = error instanceof Error ? error.message : "Could not read saved documents.";
		} finally {
			loading = false;
		}
	});

	let zipInput = $state<HTMLInputElement>();
	let folderInput = $state<HTMLInputElement>();
	let importing = $state(false);
	let dragging = $state(false);

	async function runImport(
		load: () => Promise<ImportResult>,
		source: DocumentSource
	): Promise<void> {
		importing = true;
		try {
			const { files, name, skipped, ignored } = await load();
			if (files.length === 0) {
				toast.error(
					ignored > 0
						? "Everything in there was build output or ignored by .gitignore."
						: "Nothing in there could be imported."
				);
				track("document_import_failed", { source, reason: ignored > 0 ? "all_ignored" : "empty" });
				return;
			}
			const project = await createProject(name, files);
			track("document_created", { source, files: bucket(files.length), location: "workspace" });
			await refresh();
			void requestPersistence();
			// Ignored files are expected, so they get a count; skipped ones hit a limit and are named.
			const aside = ignored > 0 ? ` Ignored ${ignored} build/ignored files.` : "";
			if (skipped.length > 0) {
				toast.warning(
					`Imported ${files.length} files. Skipped ${skipped.length}: ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? "…" : ""}${aside}`
				);
			} else {
				toast.success(`Imported ${files.length} files.${aside}`);
			}
			open(project.id);
		} catch (error) {
			report(error, "Could not import that.");
			track("document_import_failed", { source, reason: "error" });
		} finally {
			importing = false;
		}
	}

	function pickZip(event: Event): void {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (file) void runImport(() => importZipFile(file), "import_zip");
		if (zipInput) zipInput.value = "";
	}

	function pickFolder(event: Event): void {
		const picked = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
		if (picked.length > 0) void runImport(() => importFolder(picked), "import_folder");
		if (folderInput) folderInput.value = "";
	}

	async function onDrop(event: DragEvent): Promise<void> {
		event.preventDefault();
		dragging = false;
		if (!event.dataTransfer) return;
		const dropped = Array.from(event.dataTransfer.files);
		// A single .zip imports as an archive; anything else (incl. a whole folder,
		// read recursively) imports as loose files preserving structure.
		if (dropped.length === 1 && /\.zip$/i.test(dropped[0].name)) {
			void runImport(() => importZipFile(dropped[0]), "import_zip");
			return;
		}
		const files = await filesFromDataTransfer(event.dataTransfer);
		if (files.length > 0) void runImport(() => importFolder(files), "import_folder");
	}

	function onDragOver(event: DragEvent): void {
		if (!event.dataTransfer?.types.includes("Files")) return;
		event.preventDefault();
		dragging = true;
	}

	async function handleCreate(): Promise<string | void> {
		try {
			const project = await createProject("Untitled", starterFiles());
			track("document_created", { source: "blank", location: "workspace" });
			await refresh();
			void requestPersistence();
			return project.id;
		} catch (error) {
			report(error, "Could not create the document.");
		}
	}

	/** Clone straight into a new document; the repo lands in browser storage. */
	async function cloneRepo(url: string): Promise<void> {
		try {
			const project = await cloneToProject(url);
			track("document_created", { source: "git_clone", location: "workspace" });
			track("git_action", { action: "clone" });
			await requestPersistence();
			open(project.id);
		} catch (error) {
			report(error, "Could not clone that repository.");
		}
	}

	function open(id: string): void {
		void goto(resolve(`/workspace/projects/${id}` as `/workspace/projects/${string}`));
	}

	// Optimistic for reversible local edits: patch the list now, swap in the stored
	// record on success, restore the previous one on failure.
	async function optimistic(
		id: string,
		change: Partial<StoredProject>,
		write: () => Promise<StoredProject>,
		fallback: string
	): Promise<boolean> {
		const before = $state.snapshot(stored.find((p) => p.id === id));
		if (!before) return false;
		const swap = (next: StoredProject) => {
			stored = stored.map((p) => (p.id === id ? next : p));
		};
		swap({ ...before, ...change });
		try {
			swap(await write());
			return true;
		} catch (error) {
			swap(before);
			report(error, fallback);
			return false;
		}
	}

	async function rename(id: string, name: string): Promise<void> {
		const ok = await optimistic(
			id,
			{ name: name.trim() || "Untitled" },
			() => renameProject(id, name),
			"Could not rename the document."
		);
		if (ok) track("document_renamed");
	}

	async function duplicate(id: string): Promise<void> {
		try {
			await duplicateProject(id);
			track("document_duplicated");
			await refresh();
		} catch (error) {
			report(error, "Could not duplicate the document.");
		}
	}

	async function star(id: string, starred: boolean): Promise<void> {
		const ok = await optimistic(
			id,
			{ starred },
			() => setStarred(id, starred),
			"Could not update the star."
		);
		if (ok) track("document_starred", { starred });
	}

	async function remove(id: string): Promise<void> {
		try {
			await deleteProject(id);
			track("document_deleted");
			await refresh();
		} catch (error) {
			report(error, "Could not delete the document.");
		}
	}
</script>

<svelte:head>
	<title>{titles[scope]} · GlyphTeX</title>
	<meta name="description" content="Your GlyphTeX LaTeX documents, stored in this browser." />
</svelte:head>

{#if failure}
	<main
		id="main"
		class="bg-canvas flex min-h-dvh items-center justify-center px-4 py-10"
	>
		<div class="panel-card flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
			<span
				class="border-border bg-background text-destructive grid size-12 place-items-center rounded-xl border"
				aria-hidden="true"
			>
				<IconDatabaseOff size={24} />
			</span>
			<div class="flex flex-col gap-2">
				<h1 class="text-heading-sm font-medium">Local storage is unavailable</h1>
				<p class="text-body text-muted-foreground">
					Private windows and blocked site data both prevent saving. Allow site data for this site,
					or reopen GlyphTeX in a normal window.
				</p>
			</div>
			<Button class="w-full sm:w-auto" onclick={() => location.reload()}>Try again</Button>
			<details class="text-caption text-muted-foreground w-full text-left">
				<summary class="focus-visible:ring-ring rounded-sm text-center outline-none focus-visible:ring-2">
					Details
				</summary>
				<p class="bg-muted mt-2 rounded-lg p-3 font-mono break-words">{failure}</p>
			</details>
		</div>
	</main>
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
			activeScope={scope}
			{scopeHrefs}
			{loading}
			{projects}
			oncreate={handleCreate}
			onopen={open}
			onrename={rename}
			onduplicate={duplicate}
			ondelete={remove}
			onstar={star}
			{storage}
			helpHref="https://github.com/kanakkholwal/glyphtex#readme"
			onsettings={() => (storageOpen = true)}
			onimport={() => zipInput?.click()}
			onimportfolder={() => folderInput?.click()}
			onclone={cloneRepo}
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
<!-- `webkitdirectory` is the only way to pick a folder; every current browser
     supports it, and each File carries `webkitRelativePath` for the tree. -->
<input
	bind:this={folderInput}
	type="file"
	webkitdirectory
	multiple
	class="hidden"
	onchange={pickFolder}
/>

{#if dragging}
	<div
		class="border-primary bg-background/90 pointer-events-none fixed inset-4 z-50 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed"
		role="status"
	>
		<IconUpload size={28} class="text-primary" aria-hidden="true" />
		<p class="text-body-lg font-medium">Drop a folder or .zip to import a document</p>
	</div>
{/if}

{#if importing}
	<div class="bg-background/90 fixed inset-0 z-50 flex items-center justify-center" role="status">
		<p class="text-body flex items-center gap-2 font-medium">
			<IconLoader2 size={18} class="text-muted-foreground animate-spin" aria-hidden="true" />
			Importing…
		</p>
	</div>
{/if}

<StoragePanel bind:open={storageOpen} />
