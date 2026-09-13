<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { bucket, track, type DocumentSource } from "$lib/analytics";
	import type { ImportResult } from "$lib/storage/import";
	import { Button } from "@glyphtex/ui/button";
	import {
		IconAlertTriangle,
		IconFileText,
		IconFolder,
		IconLoader2,
		IconUpload
	} from "@tabler/icons-svelte";

	// Import lives on the homepage as the shortest path to writing; everything it
	// touches loads on demand so the landing bundle stays as it was.

	let zipInput = $state<HTMLInputElement>();
	let folderInput = $state<HTMLInputElement>();
	let texInput = $state<HTMLInputElement>();

	let importing = $state(false);
	let dragging = $state(false);
	let error = $state<string | null>(null);
	let status = $state("");

	async function run(
		load: (mod: typeof import("$lib/storage/import")) => Promise<ImportResult>,
		source: DocumentSource
	): Promise<void> {
		if (importing) return;
		importing = true;
		error = null;
		status = "Reading your files…";
		try {
			const mod = await import("$lib/storage/import");
			const { files, name, ignored } = await load(mod);
			if (files.length === 0) {
				error =
					ignored > 0
						? "Everything in there was build output or ignored by .gitignore."
						: "Nothing in there could be imported.";
				track("document_import_failed", { source, reason: ignored > 0 ? "all_ignored" : "empty" });
				return;
			}

			status = `Saving ${files.length} files…`;
			const [{ createProject }, { requestPersistence }] = await Promise.all([
				import("$lib/storage/projects"),
				import("$lib/storage/quota")
			]);
			const project = await createProject(name.replace(/\.(tex|ltx)$/i, "") || "Imported", files);

			track("document_created", { source, files: bucket(files.length), location: "home" });
			void requestPersistence();

			status = "Opening…";
			await goto(resolve(`/workspace/projects/${project.id}` as `/workspace/projects/${string}`));
		} catch (cause) {
			console.error("[GlyphTeX]", cause);
			error = cause instanceof Error ? cause.message : "Could not import that.";
			track("document_import_failed", { source, reason: "error" });
		} finally {
			importing = false;
			status = "";
		}
	}

	function pickZip(event: Event): void {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (file) void run((m) => m.importZipFile(file), "import_zip");
		if (zipInput) zipInput.value = "";
	}

	function pickFolder(event: Event): void {
		const picked = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
		if (picked.length > 0) void run((m) => m.importFolder(picked), "import_folder");
		if (folderInput) folderInput.value = "";
	}

	function pickTex(event: Event): void {
		const picked = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
		if (picked.length > 0) void run((m) => m.importFolder(picked), "import_folder");
		if (texInput) texInput.value = "";
	}

	const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

	function onDragOver(event: DragEvent): void {
		if (!carriesFiles(event)) return;
		// Without this the browser navigates away to the dropped file.
		event.preventDefault();
		dragging = true;
	}

	function onDragLeave(event: DragEvent): void {
		if (event.relatedTarget) return;
		dragging = false;
	}

	async function onDrop(event: DragEvent): Promise<void> {
		if (!carriesFiles(event)) return;
		event.preventDefault();
		dragging = false;
		const dt = event.dataTransfer;
		if (!dt) return;

		const dropped = Array.from(dt.files);
		if (dropped.length === 1 && /\.zip$/i.test(dropped[0].name)) {
			void run((m) => m.importZipFile(dropped[0]), "import_zip");
			return;
		}
		// A dropped folder arrives as a directory entry, so walk it before reading.
		const mod = await import("$lib/storage/import");
		const files = await mod.filesFromDataTransfer(dt);
		if (files.length > 0) void run((m) => m.importFolder(files), "import_folder");
	}
</script>

<svelte:window ondragover={onDragOver} ondragleave={onDragLeave} ondrop={onDrop} />

<div
	class="@container rounded-2xl border border-dashed p-5 transition-colors {dragging
		? 'border-primary bg-primary/5'
		: 'border-border bg-card dark:bg-background'}"
>
	<div class="flex flex-col gap-4 @2xl:flex-row @2xl:items-center">
		<div class="flex min-w-0 flex-1 items-center gap-3">
			<span
				class="border-border bg-background grid size-10 shrink-0 place-items-center rounded-lg border"
				aria-hidden="true"
			>
				{#if importing}
					<IconLoader2 class="text-foreground size-5 animate-spin" stroke-width={1.75} />
				{:else}
					<IconUpload class="text-primary size-5" stroke-width={1.75} />
				{/if}
			</span>
			<div class="min-w-0">
				<h3 class="text-body-lg text-foreground font-medium">
					{dragging ? 'Drop to open' : 'Already have a project?'}
				</h3>
				<p class="text-body text-muted-foreground @2xl:truncate">
					{status || 'Drop it here or choose one. Nothing is uploaded.'}
				</p>
			</div>
		</div>

		<div class="flex flex-wrap gap-2 @2xl:shrink-0 @2xl:flex-nowrap">
			<Button variant="outline" disabled={importing} onclick={() => zipInput?.click()}>
				<IconUpload stroke-width={1.75} aria-hidden="true" />
				Overleaf .zip
			</Button>
			<Button variant="outline" disabled={importing} onclick={() => folderInput?.click()}>
				<IconFolder stroke-width={1.75} aria-hidden="true" />
				Folder
			</Button>
			<Button variant="outline" disabled={importing} onclick={() => texInput?.click()}>
				<IconFileText stroke-width={1.75} aria-hidden="true" />
				.tex files
			</Button>
		</div>
	</div>

	{#if error}
		<p role="alert" class="text-body text-destructive mt-3 flex items-start gap-2">
			<IconAlertTriangle class="mt-0.5 size-4 shrink-0" stroke-width={1.75} aria-hidden="true" />
			<span><span class="font-medium">Import failed.</span> {error}</span>
		</p>
	{/if}

	<p aria-live="polite" class="sr-only">{status}</p>
</div>

<input
	bind:this={zipInput}
	type="file"
	accept=".zip,application/zip"
	onchange={pickZip}
	class="hidden"
/>
<input
	bind:this={folderInput}
	type="file"
	webkitdirectory
	multiple
	onchange={pickFolder}
	class="hidden"
/>
<input
	bind:this={texInput}
	type="file"
	accept=".tex,.ltx,.bib,.cls,.sty"
	multiple
	onchange={pickTex}
	class="hidden"
/>

{#if dragging}
	<div
		class="bg-background/90 pointer-events-none fixed inset-0 z-60 grid place-items-center p-4"
		aria-hidden="true"
	>
		<div
			class="border-primary bg-card flex flex-col items-center gap-3 rounded-3xl border border-dashed px-10 py-8 text-center shadow-lg"
		>
			<IconUpload class="text-primary size-7" stroke-width={1.75} />
			<p class="text-body-xl text-foreground font-medium">Drop to open it here</p>
			<p class="text-body text-muted-foreground">
				An Overleaf .zip, a project folder, or loose .tex files.
			</p>
		</div>
	</div>
{/if}
