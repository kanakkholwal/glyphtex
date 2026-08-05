import type { ActivityView } from "../activity-bar.svelte";
import { classifyFile, editorLanguage } from "../file-kinds";
import type { GitProvider } from "../git-panel.svelte";
import { settings } from "@glyphtex/ui/settings";
import { toast } from "@glyphtex/ui/sonner";

import type {
  DiffTarget,
  DockTab,
  EditorApi,
  SplitDirection,
  ViewMode,
} from "./types";

export type LayoutDeps = {
  git?: GitProvider;
  getProjectRoot: () => string | null;
};

const ACTIVITY_BAR_PX = 48; // the w-12 rail beside the panel
const DOCK_MIN_PX = 120;
const NOTES_MIN_PX = 220;
const NOTES_MAX_PX = 460;

/** The Workbench's chrome + geometry, plus the editor `bind:this` handle shared with
 *  the search and compile stores. The component calls {@link observeShell}. */
export class LayoutStore {
  readonly #git?: GitProvider;
  readonly #getProjectRoot: () => string | null;

  activeView = $state<ActivityView>("files");
  panelCollapsed = $state(false);
  viewMode = $state<ViewMode>("split");

  // Editor handle (bound from CodeEditor), shared with search + compile.
  editor = $state<EditorApi>();
  // Whether the editor currently has anything to undo / redo (bound from CodeEditor).
  canUndo = $state(false);
  canRedo = $state(false);

  cursor = $state({ line: 1, column: 1 });

  // Help / quick-open dialogs.
  paletteOpen = $state(false);
  aboutOpen = $state(false);
  shortcutsOpen = $state(false);

  // --- Diff view ------------------------------------------------------------
  diffTarget = $state<DiffTarget | null>(null);

  // --- Resizable split ------------------------------------------------------
  /** Size of the editor pane, as a % of the split axis. */
  splitPct = $state(52);
  /** `horizontal` = side by side; `vertical` = editor above, preview below. */
  splitDir = $state<SplitDirection>("horizontal");
  dragging = $state(false);
  bodyEl = $state<HTMLElement>();

  // --- Resizable sidebar (drag the edge; capped at 30% of the shell width) --
  shellEl = $state<HTMLElement>();
  shellW = $state(2560);
  sidebarW = $state(300);
  resizingSidebar = $state(false);

  // --- Bottom dock (Problems / Logs / History) ------------------------------
  dockTab = $state<DockTab>("problems");
  dockH = $state(224);
  resizingDock = $state(false);
  mainEl = $state<HTMLElement>();

  // --- Notes, docked to the right of the bottom dock ------------------------
  notesOpen = $state(false);
  notesW = $state(300);
  resizingNotes = $state(false);

  /** PDF thumbnail rail, on the preview's outer edge. */
  thumbsOpen = $state(true);

  constructor(deps: LayoutDeps) {
    this.#git = deps.git;
    this.#getProjectRoot = deps.getProjectRoot;
  }

  readonly maxSidebar = $derived(Math.max(200, Math.round(this.shellW * 0.3)));
  readonly sidebarWidth = $derived(Math.min(this.sidebarW, this.maxSidebar));
  readonly notesWidth = $derived(
    Math.min(NOTES_MAX_PX, Math.max(NOTES_MIN_PX, this.notesW)),
  );
  // VS Code-style: the activity bar + side panel can dock on either edge.
  readonly sidebarRight = $derived(settings.sidebarPosition === "right");

  readonly diffLanguage = $derived(
    this.diffTarget
      ? editorLanguage(classifyFile(this.diffTarget.path))
      : "plain",
  );

  /** Observe the shell width so the sidebar cap tracks the window. Called from
   *  the component inside a `$effect`; returns its cleanup. */
  observeShell(): (() => void) | void {
    if (!this.shellEl || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (this.shellEl) this.shellW = this.shellEl.getBoundingClientRect().width;
    });
    ro.observe(this.shellEl);
    return () => ro.disconnect();
  }

  startResize(): void {
    if (this.viewMode === "split") this.dragging = true;
  }
  startSidebarResize(): void {
    this.resizingSidebar = true;
  }
  startDockResize(): void {
    this.resizingDock = true;
  }
  startNotesResize(): void {
    this.resizingNotes = true;
  }
  onPointerMove(e: PointerEvent): void {
    if (this.resizingDock && this.mainEl) {
      const rect = this.mainEl.getBoundingClientRect();
      // Leave room for the toolbar + a usable editor above the dock.
      const max = Math.max(DOCK_MIN_PX, rect.height - 180);
      this.dockH = Math.min(max, Math.max(DOCK_MIN_PX, rect.bottom - e.clientY));
      return;
    }
    if (this.resizingNotes && this.mainEl) {
      const rect = this.mainEl.getBoundingClientRect();
      this.notesW = Math.min(
        Math.min(NOTES_MAX_PX, Math.max(NOTES_MIN_PX, rect.width - 260)),
        Math.max(NOTES_MIN_PX, rect.right - e.clientX),
      );
      return;
    }
    if (this.resizingSidebar && this.shellEl) {
      const rect = this.shellEl.getBoundingClientRect();
      // Docked right, the panel grows as the cursor moves left, so measure from
      // the opposite edge (both layouts skip the fixed-width activity bar).
      const w = this.sidebarRight
        ? rect.right - ACTIVITY_BAR_PX - e.clientX
        : e.clientX - rect.left - ACTIVITY_BAR_PX;
      this.sidebarW = Math.min(this.maxSidebar, Math.max(200, w));
      return;
    }
    if (!this.dragging || this.viewMode !== "split" || !this.bodyEl) return;
    const rect = this.bodyEl.getBoundingClientRect();
    const pct =
      this.splitDir === "vertical"
        ? ((e.clientY - rect.top) / rect.height) * 100
        : ((e.clientX - rect.left) / rect.width) * 100;
    this.splitPct = Math.min(72, Math.max(28, pct));
  }
  stopResize(): void {
    this.dragging = false;
    this.resizingSidebar = false;
    this.resizingDock = false;
    this.resizingNotes = false;
  }

  selectView(view: ActivityView): void {
    if (view === this.activeView) this.panelCollapsed = !this.panelCollapsed;
    else {
      this.activeView = view;
      this.panelCollapsed = false;
    }
  }

  // --- Diff (VS Code-style read-only comparison over the editor pane) -------
  async openDiff(path: string, staged: boolean): Promise<void> {
    const root = this.#getProjectRoot();
    if (!this.#git || !root) return;
    try {
      const v = await this.#git.fileVersions(root, path, staged);
      this.diffTarget = { path, staged, ...v };
      if (this.viewMode === "preview") this.viewMode = "split"; // reveal the editor pane
    } catch (e) {
      toast.error(`Could not open diff — ${e}`);
    }
  }
  closeDiff(): void {
    this.diffTarget = null;
  }
  async refreshDiff(): Promise<void> {
    if (this.diffTarget)
      await this.openDiff(this.diffTarget.path, this.diffTarget.staged);
  }
}
