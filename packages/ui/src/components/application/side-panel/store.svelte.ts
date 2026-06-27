/**
 * SidePanelStore — local UI state + behaviour for the rail's side panel.
 *
 * Holds the Explorer tree state (open folders, selection, outline, collapse-all,
 * root drop target), the Source Control header state, the Settings shell-button
 * status, and the Search form state — plus the small actions that wrap the
 * host callbacks. Reactive inputs (files / folders / active file / source / view)
 * arrive as getters so the store always reads the parent's live props.
 *
 * No `$effect`: per-view components own their lifecycle (e.g. autofocus).
 */
import { baseLevel, parseOutline } from "../outline";
import { canDropInto, getDrag, setDrag } from "../file-dnd";
import type { TreeNode } from "../file-tree.svelte";
import type { ActivityView } from "../activity-bar.svelte";

import { buildTree, collectFolderPaths } from "./tree";
import type { FileMeta, SearchOptions, Sel } from "./types";

export type SidePanelDeps = {
  getView: () => ActivityView;
  getFiles: () => FileMeta[];
  getFolders: () => string[];
  getActiveId: () => string;
  getSource: () => string;
  getProjectName: () => string;
  onopen?: (id: string) => void;
  onnew?: () => void;
  onnewfolder?: () => void;
  onnewfilein?: (dir: string) => void;
  onnewfolderin?: (dir: string) => void;
  ondeletefile?: (id: string) => void;
  ondeletefolder?: (path: string) => void;
  onmovefile?: (id: string, targetDir: string) => void;
  onmovefolder?: (path: string, targetDir: string) => void;
  onsearch?: (o: SearchOptions) => void;
  onregistershell?: () => void | Promise<boolean>;
};

export class SidePanelStore {
  readonly #d: SidePanelDeps;

  // --- Source Control header (refresh + state reported by GitPanel) ----------
  gitRefreshKey = $state(0);
  gitState = $state<{ isRepo: boolean; loading: boolean }>({
    isRepo: false,
    loading: false,
  });

  // --- Explorer tree ---------------------------------------------------------
  treeOpen = $state<Record<string, boolean>>({});
  rootExpanded = $state(true);
  outlineExpanded = $state(true);
  // One thing is "selected" at a time (file or folder); header actions act on it.
  selected = $state<Sel | null>(null);
  rootDragOver = $state(false);

  // --- Settings: shell-integration button feedback ---------------------------
  shellStatus = $state<"idle" | "busy" | "done">("idle");

  // --- Find / replace form ---------------------------------------------------
  query = $state("");
  replace = $state("");
  matchCase = $state(false);
  wholeWord = $state(false);
  useRegex = $state(false);
  preserveCase = $state(false);
  showReplace = $state(false);
  resultsCollapsed = $state(false);
  searchInputEl = $state<HTMLInputElement>();

  constructor(deps: SidePanelDeps) {
    this.#d = deps;
  }

  // --- Derived ---------------------------------------------------------------
  // The inputs (view / files / source / …) arrive through the constructor-set
  // `#d`, so the views that read it are getters (not `$derived` fields) to avoid
  // referencing `#d` before its initialization. They still read reactive props.
  get heading(): string {
    return this.#d.getView() === "files"
      ? "Explorer"
      : this.#d.getView() === "search"
        ? "Search"
        : this.#d.getView() === "git"
          ? "Source Control"
          : "Settings";
  }

  get rootNodes(): TreeNode[] {
    return buildTree(this.#d.getFiles(), this.#d.getFolders());
  }

  // Fall back to the open file when nothing was explicitly clicked.
  get effectiveSel(): Sel | null {
    return (
      this.selected ??
      (this.#d.getActiveId()
        ? { type: "file", id: this.#d.getActiveId() }
        : null)
    );
  }
  readonly selectedFolderPath = $derived(
    this.selected?.type === "folder" ? this.selected.path : null,
  );

  // Directory new items land in: the selected folder, the selected file's
  // parent, or '' (project root).
  get targetDir(): string {
    const s = this.effectiveSel;
    if (!s) return "";
    if (s.type === "folder") return s.path;
    const name = this.#d.getFiles().find((f) => f.id === s.id)?.name ?? "";
    const i = name.lastIndexOf("/");
    return i === -1 ? "" : name.slice(0, i);
  }

  // Outline (sectioning) — pure derive from the active file's text.
  get outline() {
    return parseOutline(this.#d.getSource());
  }
  readonly outlineBase = $derived(baseLevel(this.outline));

  readonly folderPaths = $derived(collectFolderPaths(this.rootNodes));
  readonly anyFolderOpen = $derived(
    this.folderPaths.some((p) => this.isPathOpen(p)),
  );

  // The file the matches belong to (search runs over the active document).
  get activeFileName(): string {
    const name =
      this.#d.getFiles().find((f) => f.id === this.#d.getActiveId())?.name ?? "";
    const i = name.lastIndexOf("/");
    return (i === -1 ? name : name.slice(i + 1)) || this.#d.getProjectName();
  }

  readonly findOptions = $derived([
    {
      key: "case",
      label: "Aa",
      title: "Match case",
      on: this.matchCase,
      toggle: () => {
        this.matchCase = !this.matchCase;
        this.emitSearch();
      },
    },
    {
      key: "word",
      label: "W",
      title: "Whole word",
      on: this.wholeWord,
      toggle: () => {
        this.wholeWord = !this.wholeWord;
        this.emitSearch();
      },
    },
    {
      key: "regex",
      label: ".*",
      title: "Regular expression",
      on: this.useRegex,
      toggle: () => {
        this.useRegex = !this.useRegex;
        this.emitSearch();
      },
    },
  ]);

  // --- Explorer actions ------------------------------------------------------
  isPathOpen(p: string): boolean {
    return this.treeOpen[p] ?? true;
  }
  selectFile(id: string): void {
    this.selected = { type: "file", id };
    this.#d.onopen?.(id);
  }
  selectFolder(path: string): void {
    this.selected = { type: "folder", path };
  }
  createFileHere(): void {
    const dir = this.targetDir;
    if (dir) this.treeOpen[dir] = true;
    if (this.#d.onnewfilein) this.#d.onnewfilein(dir);
    else this.#d.onnew?.();
  }
  createFolderHere(): void {
    const dir = this.targetDir;
    if (dir) this.treeOpen[dir] = true;
    if (this.#d.onnewfolderin) this.#d.onnewfolderin(dir);
    else this.#d.onnewfolder?.();
  }
  deleteSelected(): void {
    const s = this.effectiveSel;
    if (!s) return;
    if (s.type === "folder") this.#d.ondeletefolder?.(s.path);
    else this.#d.ondeletefile?.(s.id);
    this.selected = null;
  }
  /** Open a folder created inside `dir` and reveal it in the tree. */
  newFileIn(dir: string): void {
    this.treeOpen[dir] = true;
    this.#d.onnewfilein?.(dir);
  }
  newFolderIn(dir: string): void {
    this.treeOpen[dir] = true;
    this.#d.onnewfolderin?.(dir);
  }
  toggleCollapseAll(): void {
    const collapse = this.anyFolderOpen; // any open → collapse all, else expand all
    const next: Record<string, boolean> = { ...this.treeOpen };
    for (const p of this.folderPaths) next[p] = !collapse;
    this.treeOpen = next;
  }

  // --- Drop onto the project root (move an item out to the top level) --------
  rootDragOverHandler(e: DragEvent): void {
    if (!getDrag()) return;
    const ok = canDropInto("");
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = ok ? "move" : "none";
    this.rootDragOver = ok;
  }
  rootDrop(e: DragEvent): void {
    e.preventDefault();
    this.rootDragOver = false;
    const it = getDrag();
    setDrag(null);
    if (!it || !canDropInto("")) return;
    if (it.kind === "file") this.#d.onmovefile?.(it.id, "");
    else this.#d.onmovefolder?.(it.path, "");
  }

  // --- Settings: shell integration -------------------------------------------
  async addShellIntegration(): Promise<void> {
    if (this.shellStatus === "busy" || !this.#d.onregistershell) return;
    this.shellStatus = "busy";
    const ok = await this.#d.onregistershell();
    this.shellStatus = ok ? "done" : "idle";
  }

  // --- Search ----------------------------------------------------------------
  emitSearch(): void {
    this.#d.onsearch?.({
      query: this.query,
      replace: this.replace,
      caseSensitive: this.matchCase,
      wholeWord: this.wholeWord,
      regexp: this.useRegex,
      preserveCase: this.preserveCase,
    });
  }
  refreshResults(): void {
    if (this.query) this.emitSearch();
  }
  clearSearchView(): void {
    this.query = "";
    this.emitSearch(); // empty query → host clears matches + highlight
    this.resultsCollapsed = false;
    this.searchInputEl?.focus();
  }
  togglePreserveCase(): void {
    this.preserveCase = !this.preserveCase;
    this.emitSearch();
  }
}
