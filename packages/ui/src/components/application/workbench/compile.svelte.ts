/**
 * CompileStore — runs the LaTeX engine and owns the preview state.
 *
 * Live, debounced recompile-as-you-type. Tectonic is a heavier subprocess than
 * a WASM engine, so compiles are *coalesced*: while one is running we never
 * start a second — we mark the doc dirty and recompile once it lands. Holds the
 * rendered PDF (bytes + object URL), the SyncTeX map for forward/reverse sync,
 * the parsed diagnostics for the Problems panel, and the preview zoom state.
 *
 * No `$effect` here: the component arms the debounced auto-compile by calling
 * {@link armAutoCompile} from its own `$effect`, and disposes the object URL via
 * {@link disposePdf} from `onDestroy`.
 */
import {
  parseLatexLog,
  parseSyncTex,
  summarizeProblems,
  type SyncTexLocation,
  type SyncTexMap,
} from "@glyphx/ui/editor";
import { COMPILE_DEBOUNCE_MS, settings } from "@glyphx/ui/settings";
import { toast } from "@glyphx/ui/sonner";

import type { FileStore } from "./files.svelte";
import type { LayoutStore } from "./layout.svelte";
import { baseName } from "./paths";
import type {
  CompileFn,
  CompileProjectFn,
  CompileStatus,
  SaveFileFn,
} from "./types";

export type CompileDeps = {
  files: FileStore;
  layout: LayoutStore;
  compile?: CompileFn;
  compileProject?: CompileProjectFn;
  saveFile?: SaveFileFn;
};

export class CompileStore {
  readonly #files: FileStore;
  readonly #layout: LayoutStore;
  readonly #compile?: CompileFn;
  readonly #compileProject?: CompileProjectFn;
  readonly #saveFile?: SaveFileFn;

  compiling = $state(false);
  compileStatus = $state<CompileStatus>("idle");
  lastCompileMs = $state<number | null>(null);
  pdfUrl = $state<string | undefined>(undefined);
  pdfBytes = $state<Uint8Array | undefined>(undefined);
  synctex = $state<SyncTexMap | undefined>(undefined);
  compileError = $state<string | undefined>(undefined);
  compileLog = $state("");
  // Actionable hint for a recognized engine limitation (e.g. biber/biblatex
  // skew, 0-DPI JPEG) — shown as a banner above the Problems list.
  compileHint = $state<string | undefined>(undefined);
  showProblems = $state(false);

  // PDF preview zoom/page state — bound from PdfView, driven by the header.
  pdfScalePct = $state(100);
  pdfFitMode = $state(true);
  pdfNumPages = $state(0);
  pdfView = $state<{
    revealLocation: (loc: SyncTexLocation) => void;
    zoomIn: () => void;
    zoomOut: () => void;
    setZoomPct: (pct: number) => void;
    fitWidth: () => void;
    openFind: () => void;
  }>();

  // Coalescing bookkeeping (plain fields — not reactive).
  #pendingRecompile = false;
  #lastCompiledSource: string | null = null;

  constructor(deps: CompileDeps) {
    this.#files = deps.files;
    this.#layout = deps.layout;
    this.#compile = deps.compile;
    this.#compileProject = deps.compileProject;
    this.#saveFile = deps.saveFile;
  }

  // Parsed diagnostics for the Problems panel; recomputed on each compile.
  readonly problems = $derived(
    parseLatexLog(this.compileLog, this.compileError),
  );
  readonly problemSummary = $derived(summarizeProblems(this.problems));

  // Getters (not `$derived`) so they can reference the constructor-assigned
  // `#files` / `#compile*` deps without tripping field-initialization order.
  // They still read reactive `$state` (e.g. `#files.projectRoot`), so callers
  // reading them in a reactive context re-run correctly.
  get projectCompile(): boolean {
    return Boolean(
      this.#compileProject && this.#files.projectRoot && this.#files.mainId,
    );
  }
  get canCompile(): boolean {
    return Boolean(this.#compile) || this.projectCompile;
  }

  readonly compileLabel = $derived(
    !this.canCompile
      ? "Desktop only"
      : this.compileStatus === "compiling"
        ? "Compiling…"
        : this.compileStatus === "error"
          ? "Compile error"
          : this.compileStatus === "success"
            ? this.lastCompileMs != null
              ? `Compiled in ${(this.lastCompileMs / 1000).toFixed(1)}s`
              : "Compiled"
            : "Ready",
  );

  #base64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /** Double-click in the PDF → jump the editor to the matching source line. */
  onReverse(loc: { page: number; x: number; y: number }): void {
    const hit = this.synctex?.locate(loc.page, loc.x, loc.y);
    if (hit) this.#layout.editor?.goToLine(hit.line);
  }

  /**
   * Save the compiled PDF from the preview toolbar. On desktop the host injects
   * `saveFile` (Tauri's dialog + fs plugins → a real native "Save As"); on the
   * web we fall back to a normal browser download.
   */
  async downloadPdf(): Promise<void> {
    const bytes = this.pdfBytes;
    if (!bytes) return;
    const srcName =
      this.#files.files.find((f) => f.id === this.#files.mainId)?.name ??
      this.#files.activeFile?.name ??
      "document";
    const base = baseName(srcName).replace(/\.[^./\\]+$/, "") || "document";
    const filename = `${base}.pdf`;
    try {
      if (this.#saveFile) {
        const saved = await this.#saveFile(bytes, {
          filename,
          extensions: ["pdf"],
        });
        if (saved) toast.success(`Saved ${filename}`);
        return; // false = user cancelled the dialog → stay quiet
      }
      if (!this.pdfUrl) return;
      const a = document.createElement("a");
      a.href = this.pdfUrl;
      a.download = filename;
      a.click();
      toast.success(`Downloaded ${filename}`);
    } catch (e) {
      toast.error(`Could not save the PDF — ${e}`);
    }
  }

  /** Forward sync: caret line → scroll/flash the matching region in the PDF. */
  syncToPdf(): void {
    if (!this.synctex) {
      toast.info("Compile first to sync to the PDF.");
      return;
    }
    const loc = this.synctex.forward(this.#layout.cursor.line);
    if (!loc) {
      toast.info(`No PDF location for line ${this.#layout.cursor.line}.`);
      return;
    }
    if (this.#layout.viewMode === "editor") this.#layout.viewMode = "split";
    this.pdfView?.revealLocation(loc);
  }

  /** Content the engine compiles in single-file mode: the active file's last
   *  *saved* version (project mode compiles the saved files straight off disk). */
  #compileSource(): string {
    const f =
      this.#files.files.find((x) => x.id === this.#files.activeId) ??
      this.#files.activeFile;
    return f?.saved ?? f?.content ?? this.#files.source;
  }

  async runCompile(manual = false): Promise<void> {
    if (!this.canCompile) {
      this.compileError =
        "The compiler isn't ready yet — finish the one-time setup to compile.";
      this.compileStatus = "error";
      if (manual && this.#layout.viewMode === "editor")
        this.#layout.viewMode = "split";
      return;
    }
    // A manual compile commits the current edits first, so it always reflects
    // what's on screen. Auto-compile only ever sees already-saved content.
    if (manual) await this.#files.saveActive(false);
    // Coalesce: a compile is already in flight — queue exactly one rerun.
    if (this.compiling) {
      this.#pendingRecompile = true;
      return;
    }
    if (manual && this.#layout.viewMode === "editor")
      this.#layout.viewMode = "split";
    this.compiling = true;
    try {
      do {
        this.#pendingRecompile = false;
        // Compile the last *saved* content (project mode reads it from disk).
        const snapshot = this.#compileSource();
        const useProject = this.projectCompile;
        // Skip redundant auto-recompiles of already-rendered content. Only in
        // single-file mode — in a project, an edit to a non-active file (saved
        // on switch) wouldn't change `source`, so we always recompile there.
        if (!manual && !useProject && snapshot === this.#lastCompiledSource)
          break;
        this.compileStatus = "compiling";
        const started = performance.now();
        const root = this.#files.projectRoot;
        const out =
          useProject && this.#compileProject && root
            ? await this.#compileProject(
                root,
                this.#files.files.find((f) => f.id === this.#files.mainId)
                  ?.name ?? "",
              )
            : this.#compile
              ? await this.#compile(snapshot)
              : { error: "No compiler available." };
        this.lastCompileMs = Math.round(performance.now() - started);
        this.compileLog = out.log ?? "";
        this.compileHint = out.hint;
        if (this.compileHint) this.showProblems = true; // make the hint visible

        // Mirror to the devtools console so logs are readable/debuggable.
        if (out.error) {
          console.error(
            `[GlyphX] LaTeX compilation failed (${this.lastCompileMs}ms): ${out.error}`,
          );
          if (out.log) console.error(out.log);
        } else {
          console.info(`[GlyphX] compiled in ${this.lastCompileMs}ms`);
          if (out.log?.trim()) console.debug(out.log);
        }
        if (out.pdf) {
          if (this.pdfUrl) URL.revokeObjectURL(this.pdfUrl);
          const bytes = this.#base64ToBytes(out.pdf);
          this.pdfBytes = bytes;
          this.pdfUrl = URL.createObjectURL(
            new Blob([bytes as BlobPart], { type: "application/pdf" }),
          );
          this.synctex = out.synctex ? parseSyncTex(out.synctex) : undefined;
          this.compileError = undefined;
          this.compileStatus = "success";
          this.#lastCompiledSource = snapshot;
          // A best-effort PDF can still carry errors (e.g. an undefined macro
          // that the engine recovered from). Surface them like Overleaf does.
          if (this.problemSummary.errors > 0) this.showProblems = true;
        } else {
          this.compileError = out.error ?? "Compilation failed.";
          this.compileStatus = "error";
          this.showProblems = true; // surface failures immediately
        }
      } while (this.#pendingRecompile);
    } catch (e) {
      this.compileError = String(e);
      this.compileHint = undefined;
      this.compileStatus = "error";
      this.showProblems = true;
      console.error("[GlyphX] compile threw:", e);
    } finally {
      this.compiling = false;
    }
  }

  /**
   * Debounced auto-compile: re-arm whenever the *saved* content changes (a save
   * lands → `savedTick` bumps) or the main file changes. Called from the
   * component inside a `$effect`; returns its cleanup. With auto-save off,
   * nothing here fires until you save — so the preview shows the last saved
   * version. Disabled when auto-compile is off or no engine is wired.
   */
  armAutoCompile(): (() => void) | void {
    void this.#files.savedTick; // re-run after each save
    void this.#files.mainId; // recompile when the main file changes
    const auto = settings.autoCompile;
    if (!this.canCompile || !auto) return;
    const timer = setTimeout(() => this.runCompile(false), COMPILE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }

  /** Revoke the object URL on teardown (called from `onDestroy`). */
  disposePdf(): void {
    if (this.pdfUrl) URL.revokeObjectURL(this.pdfUrl);
  }
}
