<script lang="ts">
  import { Logo } from "@glyphx/ui/logo";
  import { settings } from "@glyphx/ui/settings";
  import { Spinner } from "@glyphx/ui/spinner";
  import {
    IconAlertTriangle,
    IconChevronDown,
    IconCurrentLocation,
    IconDownload,
    IconLoader2,
    IconMinus,
    IconPlus,
    IconSearch,
  } from "@tabler/icons-svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@glyphx/ui/dropdown-menu";

  import PdfView from "../pdf-view.svelte";
  import type { WorkbenchController } from "./controller.svelte";
  import { ZOOM_PRESETS } from "./types";

  /**
   * Preview pane — the PDF column when not editor-only. Header carries
   * sync-to-PDF, compile status, and (when a PDF exists) find / page count /
   * zoom / download. Body shows the rendered PDF, a compile-error card, or a
   * friendly empty state.
   */
  let { ctrl }: { ctrl: WorkbenchController } = $props();
  const compile = $derived(ctrl.compile);
</script>

<section class="bg-muted/40 flex min-h-0 min-w-0 flex-1 flex-col">
  <div
    class="text-muted-foreground border-border flex h-9 shrink-0 items-center gap-1.5 border-b px-2 text-xs"
  >
    <button
      class="hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded transition-colors"
      title="Sync to PDF (⌘/Ctrl+J)"
      aria-label="Sync to PDF"
      onclick={() => compile.syncToPdf()}
    >
      <IconCurrentLocation size={15} />
    </button>
    <!-- Status + recompile -->
    <span
      class="inline-flex min-w-0 items-center gap-1.5 truncate pl-1 {compile.compileStatus ===
      'error'
        ? 'text-destructive'
        : 'text-muted-foreground/80'}"
    >
      {#if compile.compileStatus === "compiling"}
        <IconLoader2 size={12} class="animate-spin" />
      {:else if compile.compileStatus === "error"}
        <IconAlertTriangle size={12} />
      {:else}
        <span
          class="size-1.5 rounded-full {compile.compileStatus === 'success'
            ? 'bg-success'
            : 'bg-muted-foreground/40'}"
        ></span>
      {/if}
      {compile.compileLabel}
    </span>

    {#if compile.pdfBytes}
      <!-- Find + page count + zoom + download -->
      <div class="ml-auto flex items-center gap-1">
        <button
          class="hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded transition-colors"
          title="Find in PDF (Ctrl/Cmd+F)"
          aria-label="Find in PDF"
          onclick={() => compile.pdfView?.openFind()}
        >
          <IconSearch size={14} />
        </button>
        <span class="bg-border mx-1 h-4 w-px"></span>
        <span class="text-muted-foreground/70 tabular-nums">
          {compile.pdfNumPages || 1} page{(compile.pdfNumPages || 1) === 1
            ? ""
            : "s"}
        </span>
        <span class="bg-border mx-1 h-4 w-px"></span>
        <button
          class="hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded transition-colors"
          title="Zoom out"
          aria-label="Zoom out"
          onclick={() => compile.pdfView?.zoomOut()}
        >
          <IconMinus size={14} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger>
            {#snippet child({ props })}
              <button
                {...props}
                class="hover:bg-muted hover:text-foreground flex h-6 items-center gap-1 rounded px-1.5 tabular-nums transition-colors"
                title="Zoom level"
              >
                {compile.pdfFitMode ? "Fit" : `${compile.pdfScalePct}%`}
                <IconChevronDown size={12} class="opacity-60" />
              </button>
            {/snippet}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-36">
            <DropdownMenuItem onclick={() => compile.pdfView?.fitWidth()}>
              Fit width
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {#each ZOOM_PRESETS as pct (pct)}
              <DropdownMenuItem onclick={() => compile.pdfView?.setZoomPct(pct)}>
                {pct}%
              </DropdownMenuItem>
            {/each}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          class="hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded transition-colors"
          title="Zoom in"
          aria-label="Zoom in"
          onclick={() => compile.pdfView?.zoomIn()}
        >
          <IconPlus size={14} />
        </button>
        <span class="bg-border mx-1 h-4 w-px"></span>
        <button
          class="hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded transition-colors"
          title="Download PDF"
          aria-label="Download PDF"
          onclick={() => compile.downloadPdf()}
        >
          <IconDownload size={14} />
        </button>
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
                class="text-muted-foreground mt-3 max-h-72 overflow-auto font-mono text-[11px] whitespace-pre-wrap">{compile.compileLog}</pre>
            {/if}
          </div>
        {:else}
          <div
            class="glyphx-print-area flex h-full flex-col items-center justify-center gap-6 text-center"
          >
            <Logo text={false} badge size={64} class="opacity-95" />
            {#if compile.compileStatus === "compiling"}
              <div
                class="text-muted-foreground flex items-center gap-2.5 text-sm"
              >
                <Spinner class="size-4" />
                <span>Rendering your document…</span>
              </div>
            {:else if compile.canCompile}
              <div class="flex flex-col items-center gap-1.5">
                <p class="text-foreground text-sm font-medium">
                  Nothing to preview yet
                </p>
                <p
                  class="text-muted-foreground max-w-[18rem] text-xs leading-relaxed"
                >
                  {settings.autoCompile
                    ? "Start typing — GlyphX renders live, entirely on your device."
                    : "Press Compile (⌘/Ctrl+S) to render — entirely on your device."}
                </p>
              </div>
            {:else}
              <div class="flex flex-col items-center gap-1.5">
                <p class="text-foreground text-sm font-medium">
                  Preview is desktop-only
                </p>
                <p
                  class="text-muted-foreground max-w-[18rem] text-xs leading-relaxed"
                >
                  Compilation runs in the GlyphX desktop app — fully offline.
                </p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</section>
