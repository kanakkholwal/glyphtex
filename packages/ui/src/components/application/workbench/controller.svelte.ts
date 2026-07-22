import type { EngineManager } from "../engine-settings.svelte";
import type { GitProvider } from "../git-panel.svelte";
import type { Menu } from "../menu-bar.svelte";
import type { ProjectHost } from "../project";
import { matchShortcut, shortcutLabel } from "../shortcuts";
import { AUTO_SAVE_DELAY_MS, settings } from "@glyphx/ui/settings";

import { CompileStore } from "./compile.svelte";
import { FileStore } from "./files.svelte";
import { LayoutStore } from "./layout.svelte";
import { SearchStore } from "./search.svelte";
import type {
  CompileFilesFn,
  CompileFn,
  CompileProjectFn,
  GlyphFile,
  SaveFileFn,
} from "./types";

/** A file or folder the user asked to save out of the workbench. */
export type DownloadRequest = {
  kind: "file" | "folder";
  /** Suggested download name — the leaf; a folder arrives zipped. */
  name: string;
  /** Project-relative paths to include. */
  paths: string[];
  /** Folder requests only: the folder's path, so the host can re-root the zip. */
  root?: string;
};

export type WorkbenchProps = {
  platform?: "web" | "desktop";
  compile?: CompileFn;
  /** Compile a multi-file project on disk (desktop), so `\input` /
   *  `\includegraphics` / `\bibliography` resolve. */
  compileProject?: CompileProjectFn;
  /** In-memory multi-file compile (web projects); same resolution, no disk. */
  compileFiles?: CompileFilesFn;
  engine?: EngineManager;
  /** Host-injected Git backend (desktop = gitoxide). Enables Source Control. */
  git?: GitProvider;
  /** Host-injected file save (desktop = Tauri dialog + fs). Browser download on web. */
  saveFile?: SaveFileFn;
  /** Folder-based project bridge (desktop = Tauri fs / zip). Absent on web. */
  project?: ProjectHost;
  /** A folder / `.tex` / `.glyx` path to open on mount (file-association launch). */
  openPathOnMount?: string;
  /** Workspace name shown in the command centre / explorer. */
  projectName?: string;
  /** Files to open with (a project's files). Defaults to a demo document. */
  initialFiles?: GlyphFile[];
  /** Called (debounced) whenever files change, so the host can persist. */
  onpersist?: (files: GlyphFile[]) => void;
  /** Small free-text note shown in the status bar (e.g. web package server). */
  statusNote?: string;
  /** Persistence indicator shown beside the document name. */
  saving?: boolean;
  /** Handed the controller once, so a host can drive the file store directly. */
  onready?: (ctrl: WorkbenchController) => void;
  /** Back link in the header (web: the documents list). */
  backHref?: string;
  backLabel?: string;
  /** Rename the open document from the header (web projects). */
  onRenameProject?: (name: string) => void;
  /** Add files/images from disk into the open document (web projects). */
  onAddFiles?: (accept: string) => void;
  /** Export the whole document as a .zip (web projects). */
  onExportProject?: () => void;
  /** Read a file's bytes for the asset viewer — keyed by `path` on desktop and
   *  by the project-relative name on web. Absent = assets can't be previewed. */
  readFileBytes?: (key: string) => Promise<Uint8Array>;
  /** Save a file / folder out of the Explorer. Absent hides the menu item. */
  onDownload?: (req: DownloadRequest) => void;
};

export class WorkbenchController {
  readonly platform: "web" | "desktop";
  readonly statusNote?: string;
  readonly engine?: EngineManager;
  readonly backHref?: string;
  readonly backLabel?: string;
  readonly onRenameProject?: (name: string) => void;
  readonly onAddFiles?: (accept: string) => void;
  readonly onExportProject?: () => void;
  readonly readFileBytes?: (key: string) => Promise<Uint8Array>;
  readonly onDownload?: (req: DownloadRequest) => void;

  readonly files: FileStore;
  readonly layout: LayoutStore;
  readonly search: SearchStore;
  readonly compile: CompileStore;

  readonly #onpersist?: (files: GlyphFile[]) => void;
  readonly #openPathOnMount?: string;

  constructor(props: WorkbenchProps) {
    this.platform = props.platform ?? "web";
    this.statusNote = props.statusNote;
    this.engine = props.engine;
    this.backHref = props.backHref;
    this.backLabel = props.backLabel;
    this.onRenameProject = props.onRenameProject;
    this.onAddFiles = props.onAddFiles;
    this.onExportProject = props.onExportProject;
    this.readFileBytes = props.readFileBytes ?? props.project?.readFileBytes;
    this.onDownload = props.onDownload;
    this.#onpersist = props.onpersist;
    this.#openPathOnMount = props.openPathOnMount;

    this.files = new FileStore({
      project: props.project,
      git: props.git,
      initialFiles: props.initialFiles,
      projectName: props.projectName ?? "glyphx-project",
    });
    this.layout = new LayoutStore({
      git: props.git,
      getProjectRoot: () => this.files.projectRoot,
    });
    this.search = new SearchStore({
      layout: this.layout,
      getSource: () => this.files.source,
    });
    this.compile = new CompileStore({
      files: this.files,
      layout: this.layout,
      // Getter, not value: the controller is constructed once, so a captured
      // `compile` never sees the prop flip after the engine is installed.
      getCompile: () => props.compile,
      getCompileFiles: () => props.compileFiles,
      compileProject: props.compileProject,
      saveFile: props.saveFile,
    });

    // Opening a project closes any diff left over from the previous one.
    this.files.onProjectLoaded = () => this.layout.closeDiff();
  }

  // --- Download (Explorer "…" menu) ---
  /** Hand one file to the host to save. Saves first, so the download is current. */
  async downloadFile(id: string): Promise<void> {
    const file = this.files.files.find((f) => f.id === id);
    if (!file || !this.onDownload) return;
    this.files.syncBuffer();
    await this.files.saveActive();
    this.onDownload({
      kind: "file",
      name: file.name.slice(file.name.lastIndexOf("/") + 1),
      paths: [file.name],
    });
  }

  /** Hand a folder (zipped by the host) to save, including everything under it. */
  async downloadFolder(path: string): Promise<void> {
    if (!this.onDownload) return;
    this.files.syncBuffer();
    await this.files.saveActive();
    const prefix = `${path}/`;
    const paths = this.files.files
      .map((f) => f.name)
      .filter((n) => n.startsWith(prefix));
    if (paths.length === 0) return;
    this.onDownload({
      kind: "folder",
      name: path.slice(path.lastIndexOf("/") + 1),
      paths,
      root: path,
    });
  }

  // --- Application menu ---
  // A getter, not a field: recomputed on read so checkmarks stay in sync, and it
  // can reference constructor-assigned stores without initialization-order issues.
  get menus(): Menu[] {
    return [
    {
      label: "File",
      items: [
        {
          label: "New File",
          shortcut: shortcutLabel("new-file"),
          run: () => this.files.newFile(),
        },
        {
          label: "Open File…",
          shortcut: shortcutLabel("quick-open"),
          run: () => (this.layout.paletteOpen = true),
        },
        {
          label: "Open Folder…",
          shortcut: shortcutLabel("open-folder"),
          disabled: !this.files.project,
          run: () => this.files.openFolder(),
        },
        ...(this.onAddFiles
          ? [
              {
                label: "Add Files…",
                run: () => this.onAddFiles?.(""),
              },
              {
                label: "Add Images…",
                run: () => this.onAddFiles?.("image/*"),
              },
            ]
          : []),
        { type: "separator" as const },
        {
          label: "Import Project…",
          disabled: !this.files.project,
          run: () => this.files.importProject(),
        },
        {
          // Web supplies its own in-memory zip export; desktop writes to disk.
          label: "Export as Zip",
          disabled: this.onExportProject
            ? false
            : !this.files.project || !this.files.projectRoot,
          run: () =>
            this.onExportProject
              ? this.onExportProject()
              : this.files.exportProject(),
        },
        { type: "separator" },
        {
          label: "Save",
          shortcut: shortcutLabel("save"),
          disabled: !this.files.activeDirty,
          run: () => void this.files.saveActive(),
        },
        {
          label: "Save All",
          shortcut: shortcutLabel("save-all"),
          disabled: this.files.dirtyIds.size === 0,
          run: () => void this.files.saveAll(),
        },
        { type: "separator" },
        {
          label: "Compile",
          shortcut: shortcutLabel("compile"),
          disabled: !this.compile.canCompile,
          run: () => this.compile.runCompile(true),
        },
      ],
    },
    {
      label: "Edit",
      items: [
        {
          label: "Undo",
          shortcut: shortcutLabel("undo"),
          disabled: !this.layout.canUndo,
          run: () => this.layout.editor?.undo(),
        },
        {
          label: "Redo",
          shortcut: shortcutLabel("redo"),
          disabled: !this.layout.canRedo,
          run: () => this.layout.editor?.redo(),
        },
        { type: "separator" },
        {
          label: "Bold",
          run: () => this.layout.editor?.wrapSelection("\\textbf{", "}"),
        },
        {
          label: "Italic",
          run: () => this.layout.editor?.wrapSelection("\\textit{", "}"),
        },
        { type: "separator" },
        {
          label: "Insert Section",
          run: () => this.layout.editor?.insertText("\\section{}\n"),
        },
        {
          label: "Insert List",
          run: () =>
            this.layout.editor?.insertText(
              "\\begin{itemize}\n  \\item \n\\end{itemize}\n",
            ),
        },
        {
          label: "Insert Equation",
          run: () =>
            this.layout.editor?.insertText(
              "\\begin{equation}\n  \n\\end{equation}\n",
            ),
        },
        { type: "separator" },
        {
          label: "Find in File",
          shortcut: shortcutLabel("find"),
          run: () => {
            this.layout.activeView = "search";
            this.layout.panelCollapsed = false;
          },
        },
      ],
    },
    {
      label: "View",
      items: [
        {
          label: "Explorer",
          checked: !this.layout.panelCollapsed && this.layout.activeView === "files",
          run: () => this.layout.selectView("files"),
        },
        {
          label: "Outline",
          checked: !this.layout.panelCollapsed && this.layout.activeView === "outline",
          run: () => this.layout.selectView("outline"),
        },
        {
          label: "Search",
          checked: !this.layout.panelCollapsed && this.layout.activeView === "search",
          run: () => this.layout.selectView("search"),
        },
        {
          label: "Source Control",
          checked: !this.layout.panelCollapsed && this.layout.activeView === "git",
          run: () => this.layout.selectView("git"),
        },
        { type: "separator" },
        {
          label: "Editor",
          checked: this.layout.viewMode === "editor",
          run: () => (this.layout.viewMode = "editor"),
        },
        {
          label: "Split",
          checked: this.layout.viewMode === "split",
          run: () => (this.layout.viewMode = "split"),
        },
        {
          label: "Preview",
          checked: this.layout.viewMode === "preview",
          run: () => (this.layout.viewMode = "preview"),
        },
        { type: "separator" },
        {
          label: "Toggle Sidebar",
          shortcut: shortcutLabel("toggle-sidebar"),
          checked: !this.layout.panelCollapsed,
          run: () => (this.layout.panelCollapsed = !this.layout.panelCollapsed),
        },
        {
          label: "Problems",
          checked: this.compile.showProblems,
          run: () => (this.compile.showProblems = !this.compile.showProblems),
        },
      ],
    },
    {
      label: "Go",
      items: [
        {
          label: "Go to File…",
          shortcut: shortcutLabel("quick-open"),
          run: () => (this.layout.paletteOpen = true),
        },
        { type: "separator" },
        {
          label: "Sync to PDF",
          shortcut: shortcutLabel("sync-pdf"),
          run: () => this.compile.syncToPdf(),
        },
      ],
    },
    {
      label: "Run",
      items: [
        {
          label: "Compile",
          shortcut: shortcutLabel("compile"),
          disabled: !this.compile.canCompile,
          run: () => this.compile.runCompile(true),
        },
        { type: "separator" },
        {
          label: "Live Compile",
          checked: settings.autoCompile,
          run: () => (settings.autoCompile = !settings.autoCompile),
        },
        { type: "separator" },
        {
          label: "Sync to PDF",
          shortcut: shortcutLabel("sync-pdf"),
          run: () => this.compile.syncToPdf(),
        },
      ],
    },
    {
      label: "Help",
      items: [
        {
          label: "Keyboard Shortcuts",
          run: () => (this.layout.shortcutsOpen = true),
        },
        { type: "separator" },
        {
          label: "About GlyphX",
          run: () => (this.layout.aboutOpen = true),
        },
      ],
    },
    ];
  }

  // --- Global keyboard shortcuts ---
  // Matched against the shared registry so keys, menu hints and the shortcuts
  // dialog can't drift. Undo/Redo are left to the editor when it has focus.
  onKeydown(e: KeyboardEvent): void {
    // Cheap early-out: every app shortcut carries a Mod (⌘/Ctrl).
    if (!(e.ctrlKey || e.metaKey)) return;
    const actions: Array<[string, () => void]> = [
      // Save-all before save so ⌘⇧S isn't shadowed by the ⌘S match.
      ["save-all", () => void this.files.saveAll()],
      ["save", () => void this.files.saveActive()],
      ["compile", () => this.compile.runCompile(true)],
      ["sync-pdf", () => this.compile.syncToPdf()],
      ["quick-open", () => (this.layout.paletteOpen = true)],
      ["find", () => this.search.openFind()],
      ["new-file", () => void this.files.newFile()],
      ["toggle-sidebar", () => (this.layout.panelCollapsed = !this.layout.panelCollapsed)],
    ];
    if (this.files.project)
      actions.push(["open-folder", () => void this.files.openFolder()]);
    for (const [id, run] of actions) {
      if (matchShortcut(e, id)) {
        e.preventDefault();
        run();
        return;
      }
    }
  }

  // "On focus change" auto-save: persist when the window loses focus. (Switching
  // files is handled in openFile, which saves whenever auto-save isn't off.)
  onWindowBlur(): void {
    if (settings.autoSave === "onFocusChange") void this.files.saveActive();
  }

  // --- Side-effect drivers (run from the component's `$effect`s) ---
  /** Persist back to the host (in-memory projects only), debounced. */
  armPersist(): (() => void) | void {
    void this.files.source; // track edits
    void this.files.files; // track add/remove/rename
    if (!this.#onpersist || this.files.projectRoot) return;
    const persist = this.#onpersist;
    const t = setTimeout(() => persist(this.files.snapshotFiles()), 500);
    return () => clearTimeout(t);
  }

  /** Refresh Explorer Git labels on structural change (add / remove / rename). */
  refreshGitOnStructuralChange(): void {
    void this.files.files;
    if (this.files.git && this.files.projectRoot)
      void this.files.refreshGitStatus();
  }

  /** "After delay" auto-save: persist the active file a beat after typing stops. */
  armAutoSave(): (() => void) | void {
    void this.files.source; // track edits
    if (settings.autoSave !== "afterDelay") return;
    const f = this.files.files.find((x) => x.id === this.files.activeId);
    if (!f || !this.files.fileDirty(f)) return;
    const t = setTimeout(() => void this.files.saveActive(), AUTO_SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }

  /** Clear the editor highlight when neither Search view nor find bar is open. */
  clearSearchHighlight(): void {
    const sidebarSearch =
      this.layout.activeView === "search" && !this.layout.panelCollapsed;
    if (!sidebarSearch && !this.search.showFind)
      this.layout.editor?.clearSearch();
  }

  // --- Lifecycle helpers (run from onMount / onDestroy) ---
  /** Open a launched folder/file and listen for later "Open with GlyphX" paths.
   *  Returns the unlisten cleanup (for `onMount`'s return). */
  mountFileAssociation(): () => void {
    const project = this.files.project;
    if (!project) return () => {};
    let unlisten: (() => void) | undefined;
    void (async () => {
      if (this.#openPathOnMount) {
        try {
          await this.files.openPath(this.#openPathOnMount);
        } catch {
          /* ignore — bad launch path */
        }
      }
      try {
        unlisten = await project.onOpenPath?.((path) =>
          void this.files.openPath(path),
        );
      } catch {
        /* event bridge unavailable */
      }
    })();
    return () => unlisten?.();
  }
}
