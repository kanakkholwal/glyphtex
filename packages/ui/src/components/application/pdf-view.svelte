<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  // PDF.js layer styles (canvas/text/annotation positioning + selection). This is
  // the *component* stylesheet only — NOT the full pdf.js viewer app, so there is
  // no browser PDF toolbar/chrome. We re-theme the bits we care about below.
  import "pdfjs-dist/web/pdf_viewer.css";

  import {
    PdfViewController,
    type ForwardLoc,
    type ReverseLoc,
  } from "./pdf-view/controller.svelte";
  import FindBar from "./pdf-view/find-bar.svelte";

  /**
   * PdfView — headless PDF preview built on PDF.js' `PDFViewer` component, the
   * same engine Overleaf uses. Renders, per page, a canvas + a selectable text
   * layer + a clickable annotation layer, virtualized. No toolbar — every control
   * here is ours. This component is a thin shell; the engine + behaviour live in
   * {@link PdfViewController} (imported lazily so pdf.js never runs during SSR).
   */
  let {
    data,
    onreverse,
    scalePct = $bindable(100),
    fitMode = $bindable(true),
    numPages = $bindable(0),
  }: {
    data?: Uint8Array;
    onreverse?: (loc: ReverseLoc) => void;
    /** Current zoom (%) — bindable so the host toolbar can display it. */
    scalePct?: number;
    /** True while fit-to-width is active. */
    fitMode?: boolean;
    /** Page count of the rendered document. */
    numPages?: number;
  } = $props();

  // svelte-ignore state_referenced_locally
  const ctrl = new PdfViewController({
    getData: () => data,
    setScalePct: (n) => (scalePct = n),
    getFitMode: () => fitMode,
    setFitMode: (b) => (fitMode = b),
    setNumPages: (n) => (numPages = n),
    onreverse,
  });

  onMount(() => void ctrl.init());
  onDestroy(() => ctrl.destroy());

  // Reload when the PDF bytes change (or once the engine becomes ready).
  $effect(() => {
    void data;
    void ctrl.ready;
    ctrl.reload();
  });

  // --- Imperative API (accessed via bind:this from the host toolbar) --------
  export function revealLocation(loc: ForwardLoc) {
    ctrl.revealLocation(loc);
  }
  export function zoomIn() {
    ctrl.zoomIn();
  }
  export function zoomOut() {
    ctrl.zoomOut();
  }
  export function setZoomPct(pct: number) {
    ctrl.setZoomPct(pct);
  }
  export function fitWidth() {
    ctrl.fitWidth();
  }
  export function openFind() {
    ctrl.openFind();
  }
</script>

<div class="relative flex h-full min-h-0 flex-col">
  <div class="relative min-h-0 flex-1">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={ctrl.containerEl}
      class="glyphx-pdf-container absolute inset-0 overflow-auto"
      tabindex="-1"
      ondblclick={(e) => ctrl.onDblClick(e)}
      onwheel={(e) => ctrl.onWheel(e)}
      onkeydown={(e) => ctrl.onContainerKeydown(e)}
    >
      <div bind:this={ctrl.viewerEl} class="pdfViewer"></div>
    </div>

    {#if ctrl.findOpen}
      <FindBar {ctrl} />
    {/if}

    {#if ctrl.errorMsg}
      <div class="bg-muted/40 absolute inset-0 overflow-auto p-6">
        <div
          class="border-destructive/30 bg-destructive/5 mx-auto max-w-prose rounded-lg border p-4"
        >
          <p class="text-destructive text-sm font-medium">
            Could not display the PDF.
          </p>
          <pre
            class="text-muted-foreground mt-2 overflow-auto font-mono text-[11px] whitespace-pre-wrap">{ctrl.errorMsg}</pre>
        </div>
      </div>
    {/if}

    {#if ctrl.loading && !ctrl.hasRendered}
      <div
        class="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-xs"
      >
        Rendering…
      </div>
    {/if}
  </div>
</div>

<style>
  /* Reserve the scrollbar gutter so it never reflows the fit-width calc. */
  .glyphx-pdf-container {
    scrollbar-gutter: stable;
    background: var(--color-muted, transparent);
  }

  /* Page chrome — we own it (PDFViewer renders borderless via removePageBorders). */
  :global(.glyphx-pdf-container .pdfViewer .page) {
    margin: 1.25rem auto;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    background: var(--color-card);
    box-shadow: 0 1px 3px color-mix(in srgb, var(--color-foreground) 12%, transparent);
    overflow: clip;
  }

  /* Selection tint via our brand token (not a hardcoded colour). */
  :global(.glyphx-pdf-container .textLayer ::selection) {
    background: color-mix(in srgb, var(--color-primary) 30%, transparent);
  }

  /* Forward-sync flash (source → PDF). */
  :global(.glyphx-sync-flash) {
    position: absolute;
    z-index: 5;
    pointer-events: none;
    border-radius: 3px;
    background: color-mix(in srgb, var(--color-primary) 30%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 45%, transparent);
    animation: glyphx-sync-fade 1.5s ease-out forwards;
  }
  @keyframes -global-glyphx-sync-fade {
    0% {
      opacity: 0;
    }
    12% {
      opacity: 1;
    }
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
