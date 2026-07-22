<script lang="ts">
	import { Button } from "@glyphx/ui/button";
	import { Spinner } from "@glyphx/ui/spinner";
	import { IconFileOff, IconFolderShare } from '@glyphx/ui/icons';

	import type { FileKind } from "./file-kinds";
	import PdfView from "./pdf-view.svelte";

	/**
	 * AssetViewer — renders a non-text file in the editor pane:
	 *  - images load straight into an <img> (object-contained, checkered mat),
	 *  - PDFs reuse the project's PdfView,
	 *  - anything we can't show without a heavy library falls back to a clear
	 *    "can't preview here" card with a "Reveal in folder" action.
	 * Bytes are read lazily through the host (desktop = Tauri fs). On the web,
	 * where there's no file host, everything degrades to the fallback card.
	 */
	let {
		kind,
		name,
		path,
		readBytes,
		onreveal,
	}: {
		kind: FileKind;
		name: string;
		/** Absolute path (desktop). Drives lazy byte loading + reveal. */
		path?: string;
		readBytes?: (abs: string) => Promise<Uint8Array>;
		onreveal?: () => void;
	} = $props();

	const leaf = $derived(name.slice(name.lastIndexOf("/") + 1));
	const ext = $derived(leaf.slice(leaf.lastIndexOf(".") + 1).toLowerCase());

	const IMG_MIME: Record<string, string> = {
		svg: "image/svg+xml",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		ico: "image/x-icon",
		tif: "image/tiff",
		tiff: "image/tiff",
	};

	let bytes = $state<Uint8Array | undefined>(undefined);
	let imgUrl = $state<string | undefined>(undefined);
	let loading = $state(false);
	let error = $state<string | undefined>(undefined);

	// Load the file's bytes whenever the target or its kind changes. IMPORTANT:
	// this effect must only *read* `path` / `kind` / `readBytes` and never read
	// the state it writes (bytes / imgUrl / error / loading) — reading a written
	// signal here would re-trigger the effect on every write and spin forever.
	// The previous object URL is revoked in the cleanup, not by reading `imgUrl`.
	$effect(() => {
		const p = path;
		const k = kind;
		const reader = readBytes;
		const mime = IMG_MIME[ext] ?? `image/${ext}`;

		// Reset for the new target (writes only — not tracked).
		bytes = undefined;
		error = undefined;
		imgUrl = undefined;

		if (k === "binary" || !p || !reader) {
			loading = false;
			return;
		}
		loading = true;
		let cancelled = false;
		let createdUrl: string | undefined;
		void (async () => {
			try {
				const b = await reader(p);
				if (cancelled) return;
				bytes = b;
				if (k === "image") {
					createdUrl = URL.createObjectURL(new Blob([b as BlobPart], { type: mime }));
					imgUrl = createdUrl;
				}
			} catch (e) {
				if (!cancelled) error = String(e);
			} finally {
				if (!cancelled) loading = false;
			}
		})();
		return () => {
			cancelled = true;
			if (createdUrl) URL.revokeObjectURL(createdUrl);
		};
	});

	const unsupported = $derived(
		kind === "binary" || !path || !readBytes || !!error,
	);
</script>

<div class="bg-muted/30 flex h-full min-h-0 flex-col">
	{#if loading}
		<div class="text-muted-foreground flex flex-1 items-center justify-center gap-2.5 text-sm">
			<Spinner class="size-4" />
			<span>Opening {leaf}…</span>
		</div>
	{:else if unsupported}
		<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
			<div class="bg-muted text-muted-foreground grid size-14 place-items-center rounded-2xl">
				<IconFileOff size={28} />
			</div>
			<div class="flex flex-col items-center gap-1.5">
				<p class="text-foreground text-sm font-medium">Can't preview this file here</p>
				<p class="text-muted-foreground max-w-[22rem] text-xs leading-relaxed">
					{#if error}
						{leaf} couldn't be opened in the editor.
					{:else}
						<span class="font-mono">{leaf}</span> isn't a text, image, or PDF file, so GlyphX
						won't render it without an external app.
					{/if}
					Open it in your file manager instead.
				</p>
			</div>
			{#if onreveal}
				<Button variant="outline" size="sm" onclick={() => onreveal?.()}>
					<IconFolderShare />
					Reveal in folder
				</Button>
			{/if}
		</div>
	{:else if kind === "image" && imgUrl}
		<!-- Checkered mat so transparent PNGs/SVGs read correctly. -->
		<div class="glyphx-checker flex flex-1 items-center justify-center overflow-auto p-6">
			<img src={imgUrl} alt={leaf} class="max-h-full max-w-full object-contain shadow-craft-lg" />
		</div>
	{:else if kind === "pdf" && bytes}
		<PdfView data={bytes} />
	{/if}
</div>

<style>
	/* Subtle checkerboard for transparent images. */
	.glyphx-checker {
		background-image:
			linear-gradient(45deg, var(--muted) 25%, transparent 25%),
			linear-gradient(-45deg, var(--muted) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, var(--muted) 75%),
			linear-gradient(-45deg, transparent 75%, var(--muted) 75%);
		background-size: 18px 18px;
		background-position:
			0 0,
			0 9px,
			9px -9px,
			-9px 0;
	}
</style>
