<script lang="ts">
  import { Button } from "@glyphtex/ui/button";
  import { ButtonGroup } from "@glyphtex/ui/button-group";
  import { Logo } from "@glyphtex/ui/logo";
  import { settings } from "@glyphtex/ui/settings";
  import { Spinner } from "@glyphtex/ui/spinner";
  import {
    IconAlertTriangle,
    IconChevronDown,
    IconCurrentLocation,
    IconDownload,
    IconLoader2,
    IconMinus,
    IconPlayerPlayFilled,
    IconPlus,
    IconSearch,
  } from '@tabler/icons-svelte';
  import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
  } from "@glyphtex/ui/dropdown-menu";

  import PdfView from "../pdf-view.svelte";
  import { shortcutLabel } from "../shortcuts";
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
    class="text-muted-foreground border-border bg-card flex h-9 shrink-0 items-center gap-1 border-b px-1.5 text-xs"
  >
    <!-- Compile is the header's job now; this bar reports and navigates. -->
    <Button
      variant="ghost"
      size="icon-sm"
      title="Sync to PDF (⌘/Ctrl+J)"
      aria-label="Sync to PDF"
      onclick={() => compile.syncToPdf()}
    >
      <IconCurrentLocation />
    </Button>
    <span
      class="inline-flex min-w-0 items-center gap-1.5 truncate {compile.compileStatus ===
      'error'
        ? 'text-destructive'
        : 'text-muted-foreground'}"
    >
      {#if compile.compileStatus === "compiling"}
        <IconLoader2 size={14} class="animate-spin" />
      {:else if compile.compileStatus === "error"}
        <IconAlertTriangle size={14} />
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
      <div class="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Find in PDF (Ctrl/Cmd+F)"
          aria-label="Find in PDF"
          onclick={() => compile.pdfView?.openFind()}
        >
          <IconSearch />
        </Button>
        <span class="bg-border/60 mx-1 h-5 w-px"></span>
        <span class="text-muted-foreground/70 px-1 tabular-nums">
          {compile.pdfNumPages || 1} page{(compile.pdfNumPages || 1) === 1
            ? ""
            : "s"}
        </span>
        <span class="bg-border/60 mx-1 h-5 w-px"></span>
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
                {compile.pdfFitMode ? "Fit" : `${compile.pdfScalePct}%`}
                <IconChevronDown size={14} class="opacity-60" />
              </Button>
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
        <Button
          variant="ghost"
          size="icon-sm"
          title="Zoom in"
          aria-label="Zoom in"
          onclick={() => compile.pdfView?.zoomIn()}
        >
          <IconPlus />
        </Button>
        <span class="bg-border/60 mx-1 h-5 w-px"></span>
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
                    ? "Start typing — GlyphTeX renders live, entirely on your device."
                    : "Press Compile (⌘/Ctrl+S) to render — entirely on your device."}
                </p>
              </div>
            {:else}
              <div class="flex flex-col items-center gap-1.5">
                <p class="text-foreground text-sm font-medium">
                  Setting up the compiler
                </p>
                <p
                  class="text-muted-foreground max-w-[18rem] text-xs leading-relaxed"
                >
                  GlyphTeX compiles on your device. Finish the one-time setup and
                  your document renders here.
                </p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</section>
