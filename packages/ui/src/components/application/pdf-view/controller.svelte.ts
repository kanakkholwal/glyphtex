/**
 * PdfViewController — owns the headless PDF.js engine (`PDFViewer` + link /
 * find controllers) and all preview behaviour: lazy engine init, document
 * (re)load with scroll preservation, zoom, double-click reverse-sync, forward
 * sync (scroll + flash), and find-in-PDF.
 *
 * The `.svelte` component is a thin shell: it binds DOM refs + props/effects to
 * these methods and re-exports the imperative API via `bind:this`. The DOM refs
 * and the reactive UI flags are `$state`; the pdf.js handles are plain fields.
 *
 * pdf.js' viewer entry points (`pdfjs-dist/web/pdf_viewer.mjs`) ship no
 * first-class types at this import path, so the dynamically-imported module and
 * engine handles are an untyped external boundary (AGENTS.md rule #7 — justified
 * scoped exception). Event payloads *are* narrowed where consumed.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type ReverseLoc = { page: number; x: number; y: number };
export type ForwardLoc = {
  page: number;
  h: number;
  v: number;
  width: number;
  height: number;
  depth: number;
};

export type PdfViewCallbacks = {
  getData: () => Uint8Array | undefined;
  setScalePct: (n: number) => void;
  getFitMode: () => boolean;
  setFitMode: (b: boolean) => void;
  setNumPages: (n: number) => void;
  onreverse?: (loc: ReverseLoc) => void;
};

export class PdfViewController {
  // DOM refs (bound from the component).
  containerEl = $state<HTMLDivElement>();
  viewerEl = $state<HTMLDivElement>();

  // Reactive UI flags.
  ready = $state(false); // engine constructed
  hasRendered = $state(false); // first document painted
  loading = $state(false);
  errorMsg = $state<string | undefined>(undefined);

  // Find-in-PDF state.
  findOpen = $state(false);
  findQuery = $state("");
  findCaseSensitive = $state(false);
  findCurrent = $state(0);
  findTotal = $state(0);
  findInputEl = $state<HTMLInputElement>();

  // pdf.js handles (untyped external boundary).
  #pdfjs: any = null;
  #viewerMod: any = null;
  #pdfViewer: any = null;
  #eventBus: any = null;
  #linkService: any = null;
  #findController: any = null;
  #doc: any = null;
  #loadToken = 0;
  #resizeObserver: ResizeObserver | undefined;
  #flashEl: HTMLDivElement | null = null;
  #flashTimer: ReturnType<typeof setTimeout> | undefined;
  #restoreRatio: number | null = null;

  readonly #cb: PdfViewCallbacks;

  constructor(cb: PdfViewCallbacks) {
    this.#cb = cb;
  }

  /** Lazily import pdf.js and construct the viewer. Call from `onMount`. */
  async init(): Promise<void> {
    this.#pdfjs = await import("pdfjs-dist");
    this.#viewerMod = await import("pdfjs-dist/web/pdf_viewer.mjs");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    this.#pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

    const containerEl = this.containerEl;
    const viewerEl = this.viewerEl;
    if (!containerEl || !viewerEl) return;

    this.#eventBus = new this.#viewerMod.EventBus();
    this.#linkService = new this.#viewerMod.PDFLinkService({
      eventBus: this.#eventBus,
      externalLinkTarget: this.#viewerMod.LinkTarget.BLANK,
      externalLinkRel: "noopener",
    });
    this.#findController = new this.#viewerMod.PDFFindController({
      eventBus: this.#eventBus,
      linkService: this.#linkService,
    });
    this.#pdfViewer = new this.#viewerMod.PDFViewer({
      container: containerEl,
      viewer: viewerEl,
      eventBus: this.#eventBus,
      linkService: this.#linkService,
      findController: this.#findController,
      annotationMode: this.#pdfjs.AnnotationMode.ENABLE, // clickable links
      annotationEditorMode: this.#pdfjs.AnnotationEditorType.DISABLE,
      removePageBorders: true, // we draw page chrome ourselves
      maxCanvasPixels: 8192 * 8192,
    });
    this.#linkService.setViewer(this.#pdfViewer);

    this.#eventBus.on("pagesinit", () => {
      this.#pdfViewer.currentScaleValue = this.#cb.getFitMode()
        ? "page-width"
        : this.#pdfViewer.currentScale;
      // Restore scroll position across recompiles (don't jump to top).
      if (this.#restoreRatio != null && containerEl) {
        const max = containerEl.scrollHeight - containerEl.clientHeight;
        containerEl.scrollTop = Math.max(0, this.#restoreRatio * max);
        this.#restoreRatio = null;
      }
      this.#cb.setNumPages(this.#pdfViewer.pagesCount ?? 0);
      this.hasRendered = true;
      this.loading = false;
    });
    this.#eventBus.on("scalechanging", (e: { scale?: number }) => {
      if (typeof e?.scale === "number")
        this.#cb.setScalePct(Math.round(e.scale * 100));
    });
    const onMatches = (e: {
      matchesCount?: { current?: number; total?: number };
    }) => {
      this.findCurrent = e?.matchesCount?.current ?? 0;
      this.findTotal = e?.matchesCount?.total ?? 0;
    };
    this.#eventBus.on("updatefindmatchescount", onMatches);
    this.#eventBus.on("updatefindcontrolstate", onMatches);

    // Refit on container resize while in a fit mode.
    this.#resizeObserver = new ResizeObserver(() => {
      if (this.#pdfViewer && this.#cb.getFitMode())
        this.#pdfViewer.currentScaleValue = "page-width";
    });
    this.#resizeObserver.observe(containerEl);

    this.ready = true;
    await this.loadDoc();
  }

  /** Tear down on unmount. */
  destroy(): void {
    this.#loadToken++;
    this.#resizeObserver?.disconnect();
    clearTimeout(this.#flashTimer);
    try {
      this.#pdfViewer?.setDocument(null);
      this.#linkService?.setDocument(null);
    } catch {
      /* ignore */
    }
    if (this.#doc) {
      try {
        this.#doc.destroy();
      } catch {
        /* ignore */
      }
    }
  }

  /** Reload after the PDF bytes change (only once the engine is up). */
  reload(): void {
    if (this.ready) void this.loadDoc();
  }

  async loadDoc(): Promise<void> {
    const pdfjs = this.#pdfjs;
    const pdfViewer = this.#pdfViewer;
    if (!pdfjs || !pdfViewer) return;
    const token = ++this.#loadToken;
    this.errorMsg = undefined;

    const data = this.#cb.getData();
    if (!data || data.length === 0) {
      try {
        pdfViewer.setDocument(null);
        this.#linkService.setDocument(null);
      } catch {
        /* ignore */
      }
      if (this.#doc) {
        try {
          this.#doc.destroy();
        } catch {
          /* ignore */
        }
        this.#doc = null;
      }
      this.hasRendered = false;
      return;
    }

    // Preserve scroll position for the upcoming document (live recompiles).
    if (this.containerEl && this.hasRendered) {
      const max = this.containerEl.scrollHeight - this.containerEl.clientHeight;
      this.#restoreRatio = max > 0 ? this.containerEl.scrollTop / max : 0;
    }

    if (!this.hasRendered) this.loading = true;
    try {
      const bytes = data.slice(); // pdfjs detaches the buffer
      const task = pdfjs.getDocument({ data: bytes });
      const next = await task.promise;
      if (token !== this.#loadToken) {
        next.destroy();
        return;
      }
      const prev = this.#doc;
      this.#doc = next;
      pdfViewer.setDocument(this.#doc);
      this.#linkService.setDocument(this.#doc, null);
      this.#findController?.setDocument(this.#doc);
      if (this.findOpen && this.findQuery) this.runFind(); // re-apply across recompiles
      if (prev) {
        try {
          prev.destroy();
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      if (token === this.#loadToken) {
        this.errorMsg = String(e);
        this.loading = false;
      }
    }
  }

  onDblClick(e: MouseEvent): void {
    const onreverse = this.#cb.onreverse;
    const pdfViewer = this.#pdfViewer;
    if (!onreverse || !pdfViewer) return;
    const pageEl = (e.target as HTMLElement).closest<HTMLElement>(".page");
    if (!pageEl) return;
    const pageNumber = parseInt(pageEl.dataset.pageNumber ?? "", 10);
    const pageView = pdfViewer.getPageView(pageNumber - 1);
    const viewport = pageView?.viewport;
    if (!viewport) return;

    const canvas = pageEl.querySelector("canvas") ?? pageEl;
    const rect = canvas.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * viewport.width;
    const vy = ((e.clientY - rect.top) / rect.height) * viewport.height;
    const [pdfX, pdfY] = viewport.convertToPdfPoint(vx, vy);
    const heightPt = viewport.viewBox[3] - viewport.viewBox[1];
    onreverse({ page: pageNumber, x: pdfX, y: heightPt - pdfY });
  }

  /** Forward sync: scroll to a PDF region (big-points, `v` from top) and flash. */
  revealLocation(loc: ForwardLoc): void {
    const pdfViewer = this.#pdfViewer;
    if (!pdfViewer || !this.containerEl) return;
    const pageView = pdfViewer.getPageView(loc.page - 1);
    const viewport = pageView?.viewport;
    const pageDiv: HTMLElement | undefined = pageView?.div;
    if (!viewport || !pageDiv) {
      pdfViewer.currentPageNumber = loc.page;
      return;
    }
    const s = viewport.scale;
    const topPx = Math.max(0, (loc.v - loc.height) * s);
    const hPx = Math.max(12, (loc.height + loc.depth) * s);
    const leftPx = Math.max(0, loc.h * s);
    const wPx =
      loc.width > 0 ? loc.width * s : Math.max(24, pageDiv.clientWidth - leftPx);

    if (this.#flashEl) this.#flashEl.remove();
    const el = document.createElement("div");
    el.className = "glyphx-sync-flash";
    el.style.left = `${leftPx}px`;
    el.style.top = `${topPx}px`;
    el.style.width = `${wPx}px`;
    el.style.height = `${hPx}px`;
    pageDiv.appendChild(el);
    this.#flashEl = el;
    clearTimeout(this.#flashTimer);
    this.#flashTimer = setTimeout(() => {
      el.remove();
      if (this.#flashEl === el) this.#flashEl = null;
    }, 1500);

    this.containerEl.scrollTo({
      top: Math.max(0, pageDiv.offsetTop + topPx - 100),
      behavior: "smooth",
    });
  }

  // --- Zoom -----------------------------------------------------------------
  #fit(): void {
    this.#cb.setFitMode(true);
    if (this.#pdfViewer) this.#pdfViewer.currentScaleValue = "page-width";
  }
  #zoomTo(scale: number): void {
    if (!this.#pdfViewer) return;
    this.#cb.setFitMode(false);
    this.#pdfViewer.currentScale = Math.min(
      4,
      Math.max(0.25, +scale.toFixed(2)),
    );
  }
  zoomIn(): void {
    this.#zoomTo((this.#pdfViewer?.currentScale ?? 1) + 0.1);
  }
  zoomOut(): void {
    this.#zoomTo((this.#pdfViewer?.currentScale ?? 1) - 0.1);
  }
  setZoomPct(pct: number): void {
    this.#zoomTo(pct / 100);
  }
  fitWidth(): void {
    this.#fit();
  }
  onWheel(e: WheelEvent): void {
    if (!(e.ctrlKey || e.metaKey) || !this.#pdfViewer) return;
    e.preventDefault();
    this.#zoomTo(this.#pdfViewer.currentScale - e.deltaY * 0.002);
  }

  // --- Find in PDF (PDFFindController) ---------------------------------------
  runFind(again = false, findPrevious = false): void {
    this.#eventBus?.dispatch("find", {
      source: null,
      type: again ? "again" : "",
      query: this.findQuery,
      caseSensitive: this.findCaseSensitive,
      entireWord: false,
      highlightAll: true,
      findPrevious,
      matchDiacritics: false,
    });
  }
  findNext(): void {
    if (this.findQuery) this.runFind(true, false);
  }
  findPrev(): void {
    if (this.findQuery) this.runFind(true, true);
  }
  onFindInput(): void {
    if (this.findQuery) this.runFind(false, false);
    else {
      this.findCurrent = 0;
      this.findTotal = 0;
      this.#eventBus?.dispatch("findbarclose", { source: null });
    }
  }
  toggleFindCase(): void {
    this.findCaseSensitive = !this.findCaseSensitive;
    this.onFindInput();
  }
  onFindKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) this.findPrev();
      else this.findNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.closeFind();
    }
  }
  /** Open the find bar (called from the host preview toolbar). */
  openFind(): void {
    this.findOpen = true;
    queueMicrotask(() => this.findInputEl?.select());
  }
  closeFind(): void {
    this.findOpen = false;
    this.#eventBus?.dispatch("findbarclose", { source: null });
    this.containerEl?.focus?.();
  }
  onContainerKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      e.stopPropagation();
      this.openFind();
    }
  }
}
