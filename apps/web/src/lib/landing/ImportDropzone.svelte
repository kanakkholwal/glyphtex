<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { bucket, track, type DocumentSource } from "$lib/analytics";
	import type { ImportResult } from "$lib/storage/import";
	import {
		IconAlertTriangle,
		IconFileText,
		IconFolder,
		IconLoader2,
		IconUpload
	} from "@tabler/icons-svelte";

	// Import is the shortest path from "I have a project" to "I am writing in it",
	// so it lives on the homepage rather than one navigation away. Everything the
	// import touches is loaded on demand: the landing bundle stays as it was.

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
				return;
			}

			status = `Saving ${files.length} files…`;
			const { createProject } = await import("$lib/storage/projects");
			const project = await createProject(name.replace(/\.(tex|ltx)$/i, "") || "Imported", files);

			track("document_created", { source, files: bucket(files.length), location: "home" });
			const { requestPersistence } = await import("$lib/storage/quota");
			void requestPersistence();

			status = "Opening…";
			await goto(resolve(`/workspace/projects/${project.id}` as `/workspace/projects/${string}`));
		} catch (cause) {
			console.error("[GlyphTeX]", cause);
			error = cause instanceof Error ? cause.message : "Could not import that.";
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
	class="rounded-xl border border-dashed border-border bg-surface-soft/50 px-5 py-4 transition-colors {dragging
		? 'border-brand bg-brand-subtle/40'
		: ''}"
>
	<div class="flex flex-col items-center gap-x-5 gap-y-3 sm:flex-row sm:justify-between">
		<div class="flex items-center gap-3 text-left">
			<span class="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-strong">
				{#if importing}
					<IconLoader2 class="size-4.5 animate-spin text-foreground" stroke-width={1.75} />
				{:else}
					<IconUpload class="size-4.5 text-foreground" stroke-width={1.75} />
				{/if}
			</span>
			<span>
				<span class="block text-base font-semibold tracking-tight text-foreground">
					Already have a project?
				</span>
				<span class="block text-sm text-muted-foreground">
					{status || 'Drop it anywhere on this page, or pick one below.'}
				</span>
			</span>
		</div>

		<div class="flex shrink-0 flex-wrap items-center justify-center gap-2">
			<button
				type="button"
				disabled={importing}
				onclick={() => zipInput?.click()}
				class="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft disabled:opacity-50"
			>
				<IconUpload class="size-4" stroke-width={1.75} />
				Overleaf .zip
			</button>
			<button
				type="button"
				disabled={importing}
				onclick={() => folderInput?.click()}
				class="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft disabled:opacity-50"
			>
				<IconFolder class="size-4" stroke-width={1.75} />
				Folder
			</button>
			<button
				type="button"
				disabled={importing}
				onclick={() => texInput?.click()}
				class="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft disabled:opacity-50"
			>
				<IconFileText class="size-4" stroke-width={1.75} />
				.tex file
			</button>
		</div>
	</div>

	{#if error}
		<p
			role="alert"
			class="mt-3 flex items-start gap-2 text-left text-sm text-destructive sm:justify-center"
		>
			<IconAlertTriangle class="mt-0.5 size-4 shrink-0" stroke-width={1.75} />
			{error}
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
		class="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-background/80 backdrop-blur-sm"
		aria-hidden="true"
	>
		<div
			class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-brand bg-background px-10 py-8 shadow-notion"
		>
			<IconUpload class="size-7 text-brand" stroke-width={1.75} />
			<p class="text-lg font-semibold tracking-tight text-foreground">Drop to open it here</p>
			<p class="text-sm text-muted-foreground">
				An Overleaf .zip, a project folder, or loose .tex files.
			</p>
		</div>
	</div>
{/if}
