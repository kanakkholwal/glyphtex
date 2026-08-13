<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '@glyphtex/ui/dropdown-menu';
	import { Logo } from '@glyphtex/ui/logo';
	import { settings } from '@glyphtex/ui/settings';
	import { Spinner } from '@glyphtex/ui/spinner';
	import {
		IconChevronDown,
		IconChevronLeft,
		IconChevronRight,
		IconCurrentLocation,
		IconDownload,
		IconLayoutSidebarRightExpand,
		IconMinus,
		IconPlus,
		IconSearch
	} from '@tabler/icons-svelte';

	import PdfView from '../pdf-view.svelte';
	import { shortcutLabel } from '../shortcuts';
	import type { WorkbenchController } from './controller.svelte';
	import { ZOOM_PRESETS } from './types';

	/**
	 * Preview pane: the PDF column. Its toolbar navigates the rendered document
	 * (sync, find, zoom, page); building it is the workbench toolbar's job.
	 */
	let { ctrl }: { ctrl: WorkbenchController } = $props();
	const compile = $derived(ctrl.compile);
	const layout = $derived(ctrl.layout);

	const pages = $derived(compile.pdfNumPages || 0);

	function jump(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const n = Number(input.value);
		if (Number.isFinite(n)) compile.goToPage(n);
		input.value = String(compile.pdfPage);
	}
</script>

<section class="bg-muted/40 flex min-h-0 min-w-0 flex-1 flex-col">
	<div
		class="text-muted-foreground border-border bg-card flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b px-1.5 text-xs"
	>
		<Button
			variant="ghost"
			size="icon-sm"
			title="Sync to PDF ({shortcutLabel('sync-pdf')})"
			aria-label="Sync to PDF"
			onclick={() => compile.syncToPdf()}
		>
			<IconCurrentLocation />
		</Button>

		{#if compile.pdfBytes}
			<Button
				variant="ghost"
				size="icon-sm"
				title="Find in PDF"
				aria-label="Find in PDF"
				onclick={() => compile.pdfView?.openFind()}
			>
				<IconSearch />
			</Button>

			<span class="bg-border/60 mx-1 h-5 w-px shrink-0"></span>

			<!-- Zoom -->
			<Button
				variant="ghost"
				size="icon-sm"
				title="Zoom out"
				aria-label="Zoom out"
				onclick={() => compile.pdfView?.zoomOut()}
			>
				<IconMinus />
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="sm"
							class="px-2 tabular-nums"
							title="Zoom level"
						>
							{compile.pdfFitMode ? 'Fit' : `${compile.pdfScalePct}%`}
							<IconChevronDown size={14} class="opacity-60" />
						</Button>
					{/snippet}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="center" class="w-36">
					<DropdownMenuItem onclick={() => compile.pdfView?.fitWidth()}>Fit width</DropdownMenuItem>
					<DropdownMenuSeparator />
					{#each ZOOM_PRESETS as pct (pct)}
						<DropdownMenuItem onclick={() => compile.pdfView?.setZoomPct(pct)}>
							{pct}%
						</DropdownMenuItem>
					{/each}
				</DropdownMenuContent>
			</DropdownMenu>
			<Button
				variant="ghost"
				size="icon-sm"
				title="Zoom in"
				aria-label="Zoom in"
				onclick={() => compile.pdfView?.zoomIn()}
			>
				<IconPlus />
			</Button>

			<span class="bg-border/60 mx-1 h-5 w-px shrink-0"></span>

			<!-- Page -->
			<Button
				variant="ghost"
				size="icon-sm"
				title="Previous page"
				aria-label="Previous page"
				disabled={compile.pdfPage <= 1}
				onclick={() => compile.goToPage(compile.pdfPage - 1)}
			>
				<IconChevronLeft />
			</Button>
			<label class="flex shrink-0 items-center gap-1">
				<span class="sr-only">Page</span>
				<input
					class="border-border bg-input focus:ring-ring/50 h-6 w-9 rounded border text-center tabular-nums outline-none focus:ring-2"
					type="text"
					inputmode="numeric"
					value={compile.pdfPage}
					onchange={jump}
					onkeydown={(e) => {
						if (e.key === 'Enter') e.currentTarget.blur();
					}}
				/>
				<span class="text-faint whitespace-nowrap tabular-nums">/ {pages || 1}</span>
			</label>
			<Button
				variant="ghost"
				size="icon-sm"
				title="Next page"
				aria-label="Next page"
				disabled={compile.pdfPage >= pages}
				onclick={() => compile.goToPage(compile.pdfPage + 1)}
			>
				<IconChevronRight />
			</Button>

			<div class="ml-auto flex items-center gap-0.5">
				{#if pages > 1}
					<Button
						variant={layout.thumbsOpen ? 'secondary' : 'ghost'}
						size="icon-sm"
						title="Page thumbnails"
						aria-label="Page thumbnails"
						aria-pressed={layout.thumbsOpen}
						onclick={() => (layout.thumbsOpen = !layout.thumbsOpen)}
					>
						<IconLayoutSidebarRightExpand />
					</Button>
				{/if}
				<Button
					variant="ghost"
					size="icon-sm"
					title="Download PDF"
					aria-label="Download PDF"
					onclick={() => compile.downloadPdf()}
				>
					<IconDownload />
				</Button>
			</div>
		{/if}
	</div>

	<div class="min-h-0 flex-1">
		{#if compile.pdfBytes}
			<PdfView
				bind:this={compile.pdfView}
				data={compile.pdfBytes}
				onreverse={(loc) => compile.onReverse(loc)}
				bind:scalePct={compile.pdfScalePct}
				bind:fitMode={compile.pdfFitMode}
				bind:numPages={compile.pdfNumPages}
				bind:page={compile.pdfPage}
				showThumbnails={layout.thumbsOpen}
			/>
		{:else}
			<div class="h-full overflow-auto p-6">
				{#if compile.compileError}
					<div
						class="border-destructive/30 bg-destructive/5 mx-auto max-w-prose rounded-lg border p-4"
					>
						<p class="text-destructive text-sm font-medium">
							{compile.compileError}
						</p>
						{#if compile.compileLog}
							<pre
								class="text-muted-foreground mt-3 max-h-72 overflow-auto font-mono text-xs whitespace-pre-wrap">{compile.compileLog}</pre>
						{/if}
					</div>
				{:else}
					<div
						class="glyphtex-print-area flex h-full flex-col items-center justify-center gap-6 text-center"
					>
						<!-- No badge: at watermark size the filled square reads as a black
                 block, not a mark. -->
						<Logo text={false} badge={false} size={56} class="text-muted-foreground opacity-40" />
						{#if compile.compileStatus === 'compiling'}
							<div class="text-muted-foreground flex items-center gap-2.5 text-sm">
								<Spinner class="size-4" />
								<span>Rendering your document…</span>
							</div>
						{:else if compile.canCompile}
							<div class="flex flex-col items-center gap-1.5">
								<p class="text-foreground text-sm font-medium">Nothing to preview yet</p>
								<p class="text-muted-foreground max-w-[18rem] text-xs leading-relaxed">
									{settings.autoCompile
										? 'Start typing: GlyphTeX renders live, entirely on your device.'
										: `Press Compile (${shortcutLabel('compile')}) to render: entirely on your device.`}
								</p>
							</div>
						{:else}
							<div class="flex flex-col items-center gap-1.5">
								<p class="text-foreground text-sm font-medium">Setting up the compiler</p>
								<p class="text-muted-foreground max-w-[18rem] text-xs leading-relaxed">
									GlyphTeX compiles on your device. Finish the one-time setup and your document
									renders here.
								</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</section>
