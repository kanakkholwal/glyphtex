<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { Spinner } from "@glyphtex/ui/spinner";
	import {
		IconAlertTriangle,
		IconEyeOff,
		IconFileOff,
		IconFolderShare,
		IconRefresh
	} from "@tabler/icons-svelte";
	import { Image } from "@unpic/svelte";

	import type { FileKind } from "./file-kinds";
	import PdfView from "./pdf-view.svelte";

	/** Renders a non-text file (image, PDF, or an unpreviewable fallback card). Bytes
	 *  are read lazily through the host; without a reader everything falls back. */
	let {
		kind,
		name,
		assetKey,
		readBytes,
		loadError,
		onretry,
		onreveal
	}: {
		kind: FileKind;
		name: string;
		/** Key handed to `readBytes`: absolute path (desktop) or relative (web). */
		assetKey?: string;
		readBytes?: (key: string) => Promise<Uint8Array>;
		/** Why opening the file as text failed, when that is what sent it here. */
		loadError?: string;
		/** Read the file again. Absent hides Retry. */
		onretry?: () => void;
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
		tiff: "image/tiff"
	};

	let bytes = $state<Uint8Array | undefined>(undefined);
	let imgUrl = $state<string | undefined>(undefined);
	// Intrinsic size, so the image reserves its space instead of reflowing in.
	// 0 for an SVG with no width/height, which then falls back to a plain <img>.
	let imgSize = $state({ w: 0, h: 0 });
	let loading = $state(false);
	let error = $state<string | undefined>(undefined);

	async function measure(url: string): Promise<{ w: number; h: number }> {
		const probe = new window.Image();
		probe.src = url;
		try {
			await probe.decode();
		} catch {
			return { w: 0, h: 0 };
		}
		return { w: probe.naturalWidth, h: probe.naturalHeight };
	}

	// Must never read the state it writes (bytes/imgUrl/error/loading): a tracked read
	// of a written signal re-triggers the effect on every write and spins forever.
	$effect(() => {
		const p = assetKey;
		const k = kind;
		const reader = readBytes;
		const mime = IMG_MIME[ext] ?? `image/${ext}`;

		bytes = undefined;
		error = undefined;
		imgUrl = undefined;
		imgSize = { w: 0, h: 0 };

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
					const size = await measure(createdUrl);
					if (cancelled) return;
					imgSize = size;
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

	/**
	 * Why there is nothing to render. These are three different problems and used
	 * to share one message: "we can't read it", "we won't render it", and "this
	 * host can't hand us bytes at all" need different next steps from the user.
	 */
	const fallback = $derived<"unreadable" | "no-viewer" | "no-reader" | null>(
		error || loadError
			? "unreadable"
			: kind === "binary"
				? "no-viewer"
				: !assetKey || !readBytes
					? "no-reader"
					: null
	);
	const reason = $derived(error ?? loadError);
</script>

<div class="bg-muted/30 flex h-full min-h-0 flex-col">
	{#if loading}
		<div class="text-muted-foreground flex flex-1 items-center justify-center gap-2.5 text-sm">
			<Spinner class="size-4" />
			<span>Opening {leaf}…</span>
		</div>
	{:else if fallback}
		<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
			<div
				class="grid size-14 place-items-center rounded-2xl {fallback === 'unreadable'
					? 'bg-destructive/10 text-destructive'
					: 'bg-muted text-muted-foreground'}"
			>
				{#if fallback === 'unreadable'}
					<IconAlertTriangle size={28} />
				{:else if fallback === 'no-reader'}
					<IconEyeOff size={28} />
				{:else}
					<IconFileOff size={28} />
				{/if}
			</div>
			<div class="flex flex-col items-center gap-1.5">
				<p class="text-foreground text-sm font-medium">
					{#if fallback === 'unreadable'}
						Couldn't read this file
					{:else if fallback === 'no-reader'}
						Preview unavailable here
					{:else}
						No preview for this format
					{/if}
				</p>
				<p class="text-muted-foreground max-w-[22rem] text-xs leading-relaxed">
					{#if fallback === 'unreadable'}
						<span class="font-mono">{leaf}</span> is on disk, but reading it failed. It may be
						binary, locked by another program, or still being written.
					{:else if fallback === 'no-reader'}
						<span class="font-mono">{leaf}</span> can't be opened as text, and this window has no
						way to read its contents to preview it.
					{:else}
						<span class="font-mono">{leaf}</span> isn't text, an image, or a PDF, so GlyphTeX won't
						render it without an external app.
					{/if}
				</p>
				{#if reason}
					<!-- The host's own words: "permission denied" is actionable, our paraphrase is not. -->
					<p class="text-faint mt-0.5 max-w-[22rem] font-mono text-[11px] break-words">
						{reason}
					</p>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				{#if fallback === 'unreadable' && onretry}
					<Button variant="outline" size="sm" onclick={() => onretry?.()}>
						<IconRefresh />
						Try again
					</Button>
				{/if}
				{#if onreveal}
					<Button
						variant={fallback === 'unreadable' ? 'ghost' : 'outline'}
						size="sm"
						onclick={() => onreveal?.()}
					>
						<IconFolderShare />
						Reveal in folder
					</Button>
				{/if}
			</div>
		</div>
	{:else if kind === 'image' && imgUrl}
		<!-- Checkered mat so transparent PNGs/SVGs read correctly. -->
		<div class="glyphtex-checker flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
			{#if imgSize.w > 0}
				<!-- unpic's `constrained` layout writes `width:100%`, which overflows a short
				     wide pane. `style` is appended last, so capping both axes here wins. -->
				<Image
					src={imgUrl}
					width={imgSize.w}
					height={imgSize.h}
					layout="constrained"
					alt={leaf}
					class="shadow-craft-lg"
					style="width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain"
				/>
			{:else}
				<!-- No intrinsic size (typically a viewBox-only SVG): unpic needs one. -->
				<img src={imgUrl} alt={leaf} class="max-h-full max-w-full object-contain shadow-craft-lg" />
			{/if}
		</div>
		{#if imgSize.w > 0}
			<div
				class="text-muted-foreground/70 border-border shrink-0 border-t px-3 py-1 text-center font-mono text-xs tabular-nums"
			>
				{imgSize.w} × {imgSize.h}
			</div>
		{/if}
	{:else if kind === 'pdf' && bytes}
		<PdfView data={bytes} />
	{/if}
</div>

<style>
	.glyphtex-checker {
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
