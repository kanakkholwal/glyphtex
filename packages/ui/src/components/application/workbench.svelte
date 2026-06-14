<script lang="ts" module>
  export type ViewMode = "editor" | "split" | "preview";

  const SAMPLE_LATEX = String.raw`% GlyphX — LaTeX document
\documentclass{article}
\usepackage{amsmath}

\title{Hello from GlyphX}
\author{}
\date{}

\begin{document}
\maketitle

GlyphX compiles \LaTeX{} entirely on your machine with Tectonic.
Nothing is uploaded. Nothing leaves this device.

\begin{equation}
  E = m c^2
\end{equation}

\end{document}
`;

  const SAMPLE_BIB = String.raw`@article{glyph2026,
  title   = {Local-first Typesetting},
  author  = {GlyphX},
  journal = {Journal of Private Research},
  year    = {2026}
}
`;
</script>

<script lang="ts">
  import { Button } from "@glyphx/ui/button";
  import { ButtonGroup } from "@glyphx/ui/button-group";
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@glyphx/ui/dialog";
  import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
  } from "@glyphx/ui/dropdown-menu";
  import {
    parseLatexLog,
    parseSyncTex,
    summarizeProblems,
    type SyncTexLocation,
    type SyncTexMap,
  } from "@glyphx/ui/editor";
  import { Logo } from "@glyphx/ui/logo";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
  } from "@glyphx/ui/select";
  import {
    AUTO_SAVE_DELAY_MS,
    COMPILE_DEBOUNCE_MS,
    settings,
  } from "@glyphx/ui/settings";
  import { Toaster, toast } from "@glyphx/ui/sonner";
  import { Spinner } from "@glyphx/ui/spinner";
  import {
    IconAlertTriangle,
    IconArrowBackUp,
    IconArrowForwardUp,
    IconChevronDown,
    IconCurrentLocation,
    IconDeviceFloppy,
    IconDownload,
    IconEye,
    IconLayoutColumns,
    IconLoader2,
    IconMinus,
    IconPencil,
    IconPlayerPlayFilled,
    IconPlus,
    IconSearch,
  } from "@tabler/icons-svelte";
  import { onDestroy, onMount } from "svelte";

  import AboutDialog from "./about-dialog.svelte";
  import ActivityBar, { type ActivityView } from "./activity-bar.svelte";
  import { applyCase } from "./case-preserve";
  import CodeEditor from "./code-editor.svelte";
  import CommandPalette from "./command-palette.svelte";
  import EditorFindBar from "./editor-find-bar.svelte";
  import type { EngineManager } from "./engine-settings.svelte";
  import ExportMenu from "./export-menu.svelte";
  import FormatToolbar from "./format-toolbar.svelte";
  import type { GitProvider } from "./git-panel.svelte";
  import MenuBar, { type Menu } from "./menu-bar.svelte";
  import PdfView from "./pdf-view.svelte";
  import ProblemsPanel from "./problems-panel.svelte";
  import type { ProjectHost } from "./project";
  import { matchShortcut, shortcutLabel } from "./shortcuts";
  import ShortcutsDialog from "./shortcuts-dialog.svelte";
  import SidePanel from "./side-panel.svelte";

  /**
   * Workbench — the full editor experience. Top bar (logo · editable title ·
   * view-modes / theme / export), a left rail + side panel, and the editor /
   * preview area. Formatting lives in the editor panel header. Calm,
   * semantic-token-only chrome; the editor keeps its JetBrains identity.
   */
  // `path`/`loaded` are set for disk-backed project files: `path` is the
  // absolute on-disk path (also the stable `id`); `loaded` tracks whether the
  // content has been read from disk yet (lazy-loaded on first open).
  type GlyphFile = {
    id: string;
    name: string;
    content: string;
    path?: string;
    loaded?: boolean;
    /**
     * Last content written to disk (or the loaded baseline). A file is "dirty"
     * (unsaved) when its live content differs from `saved`. `undefined` until the
     * file has been loaded — an unloaded file can't be dirty.
     */
    saved?: string;
  };

  // Fallback document used when the host doesn't inject a project (e.g. the web
  // /editor route, or a quick demo).
  const DEMO_FILES: GlyphFile[] = [
    { id: "main", name: "main.tex", content: SAMPLE_LATEX },
    {
      id: "intro",
      name: "sections/introduction.tex",
      content: String.raw`\section{Introduction}

Local-first typesetting keeps your unpublished work on your own machine.
This section motivates the approach.
`,
    },
    {
      id: "results",
      name: "sections/results.tex",
      content: String.raw`\section{Results}

We observe that $\hat{\theta}$ is consistent, with $\alpha$ scaling as $\beta^2$.
`,
    },
    { id: "refs", name: "references.bib", content: SAMPLE_BIB },
  ];

  let {
    platform = "web" as "web" | "desktop",
    compile,
    compileProject,
    engine,
    git,
    saveFile,
    project,
    openPathOnMount,
    projectName = "glyphx-project",
    initialFiles,
    onpersist,
    statusNote,
  }: {
    platform?: "web" | "desktop";
    compile?: (source: string) => Promise<{
      pdf?: string;
      log?: string;
      error?: string;
      synctex?: string;
    }>;
    /**
     * Compile a multi-file project on disk (desktop). Given the project root and
     * the main file's path relative to it, runs the engine so `\input` /
     * `\includegraphics` / `\bibliography` resolve against the real folder. Used
     * whenever a project folder is open.
     */
    compileProject?: (
      root: string,
      mainRel: string,
    ) => Promise<{
      pdf?: string;
      log?: string;
      error?: string;
      synctex?: string;
    }>;
    engine?: EngineManager;
    /** Host-injected Git backend (desktop = gitoxide). Enables Source Control. */
    git?: GitProvider;
    /**
     * Host-injected file save (desktop = Tauri dialog + fs). Resolves `true`
     * when written, `false` when the user cancels; throws on failure. When
     * absent (web), the workbench falls back to a browser download.
     */
    saveFile?: (
      bytes: Uint8Array,
      opts: { filename: string; extensions?: string[] },
    ) => Promise<boolean>;
    /** Folder-based project bridge (desktop = Tauri fs / zip). Absent on web. */
    project?: ProjectHost;
    /**
     * A folder / `.tex` / `.glyx` path to open on mount (file-association launch,
     * routed by the app shell). Requires `project`.
     */
    openPathOnMount?: string;
    /** Workspace name shown in the command centre / explorer. */
    projectName?: string;
    /** Files to open with (a project's files). Defaults to a demo document. */
    initialFiles?: GlyphFile[];
    /** Called (debounced) whenever files change, so the host can persist. */
    onpersist?: (files: GlyphFile[]) => void;
    /** Small free-text note shown in the status bar (e.g. web package server). */
    statusNote?: string;
  } = $props();

  const seedFiles =
    initialFiles && initialFiles.length ? initialFiles : DEMO_FILES;

  let files = $state<GlyphFile[]>(
    seedFiles.map((f) => ({ ...f, saved: f.content })),
  );
  let activeId = $state(seedFiles[0]?.id ?? "main");
  let source = $state(seedFiles[0]?.content ?? "");
  let untitledCount = $state(0);
  // Freshly created folders that hold no files yet — shown in the Explorer tree
  // (forward-slash relative paths) until a file lands in them.
  let extraFolders = $state<string[]>([]);

  // --- Folder-based project (desktop) ---------------------------------------
  // When a folder is open, `projectRoot` is its absolute path, files are backed
  // by disk (lazy-loaded / saved through `project`), and `mainId` is the compile
  // target. Without a folder we stay on the in-memory demo / web document.
  let projectRoot = $state<string | null>(null);
  let mainId = $state<string | null>(null);

  const activeFile = $derived(files.find((f) => f.id === activeId) ?? files[0]);
  // Project name shown in chrome: the open folder's name, else the prop default.
  const displayName = $derived(
    projectRoot ? baseName(projectRoot) : projectName,
  );

  // --- Path helpers (OS-agnostic string ops; separator inferred from root) ---
  function sepOf(p: string): string {
    return p.includes("\\") ? "\\" : "/";
  }
  function baseName(p: string): string {
    const s = p.replace(/[\\/]+$/, "");
    const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
    return i >= 0 ? s.slice(i + 1) : s;
  }
  function parentDir(p: string): string {
    const s = p.replace(/[\\/]+$/, "");
    const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
    return i >= 0 ? s.slice(0, i) : s;
  }
  function joinPath(root: string, rel: string): string {
    const sep = sepOf(root);
    return root.replace(/[\\/]+$/, "") + sep + rel.split("/").join(sep);
  }
  function samePath(a?: string, b?: string): boolean {
    if (!a || !b) return false;
    const n = (s: string) => s.replace(/[\\/]+/g, "/").toLowerCase();
    return n(a) === n(b);
  }

  // --- Save / dirty model ---------------------------------------------------
  // `source` is the live buffer for the active file. `f.content` mirrors it in
  // memory; `f.saved` is the last copy written to disk. A file is dirty when its
  // live content differs from `saved`. Auto-save (settings.autoSave) decides
  // when the buffer is persisted; compilation always uses the *saved* content.
  // Bumped whenever a save lands, so the auto-compile effect can key off it.
  let savedTick = $state(0);

  /** The current in-memory content for a file (live buffer if it's active). */
  function liveContent(f: GlyphFile): string {
    return f.id === activeId ? source : f.content;
  }
  function fileDirty(f: GlyphFile): boolean {
    if (f.saved === undefined) return false;
    return liveContent(f) !== f.saved;
  }
  // Ids of files with unsaved edits — drives the Explorer's "modified" dots.
  const dirtyIds = $derived(new Set(files.filter(fileDirty).map((f) => f.id)));
  const activeDirty = $derived(
    activeFile ? dirtyIds.has(activeFile.id) : false,
  );

  /** Mirror the live buffer into the active file's in-memory content (no disk). */
  function syncBuffer(): void {
    const f = files.find((x) => x.id === activeId);
    if (f) f.content = source;
  }

  /** Write one file's live content to disk (project) and mark it saved. */
  async function persistFile(f: GlyphFile): Promise<boolean> {
    const content = liveContent(f);
    if (project && f.path) {
      try {
        await project.writeFile(f.path, content);
      } catch (e) {
        toast.error(`Could not save ${baseName(f.name)} — ${e}`);
        return false;
      }
    }
    f.content = content;
    f.saved = content;
    return true;
  }

  /** Save the active file if dirty. `bumpCompile` re-arms the auto-compile. */
  async function saveActive(bumpCompile = true): Promise<boolean> {
    const f = files.find((x) => x.id === activeId);
    if (!f || !fileDirty(f)) return false;
    const ok = await persistFile(f);
    if (ok) {
      void refreshGitStatus();
      if (bumpCompile) savedTick += 1;
    }
    return ok;
  }

  /** Save every dirty file (used before export / on demand). */
  async function saveAll(): Promise<void> {
    syncBuffer();
    let any = false;
    for (const f of files)
      if (fileDirty(f)) any = (await persistFile(f)) || any;
    if (any) {
      void refreshGitStatus();
      savedTick += 1;
    }
  }

  async function openFile(id: string, force = false): Promise<void> {
    if (!force && id === activeId) return;
    // Commit the outgoing buffer: always to memory; to disk unless auto-save is
    // off (so a file switch persists under "after delay" / "on focus change").
    syncBuffer();
    if (settings.autoSave !== "off") await saveActive();
    activeId = id;
    const f = files.find((x) => x.id === id);
    if (f && project && f.path && !f.loaded) {
      try {
        f.content = await project.readFile(f.path);
      } catch (e) {
        f.content = `% Could not open this file — it may be binary or unreadable.\n% ${e}\n`;
      }
      f.loaded = true;
      f.saved = f.content;
    }
    source = f?.content ?? "";
  }

  // --- Git working-tree status (for the Explorer "M / U / A" labels) --------
  // Keyed by file id → git status word ("modified" / "untracked" / …). Refreshed
  // on load, on save, and after structural changes. Independent of the Source
  // Control panel (which fetches its own richer view).
  let gitStatus = $state<Record<string, string>>({});
  async function refreshGitStatus(): Promise<void> {
    if (!git || !projectRoot) {
      gitStatus = {};
      return;
    }
    try {
      const changes = await git.status(projectRoot);
      const byPath = new Map(changes.map((c) => [c.path, c.status]));
      const next: Record<string, string> = {};
      for (const f of files) {
        const st = byPath.get(f.name);
        if (st) next[f.id] = st;
      }
      gitStatus = next;
    } catch {
      gitStatus = {};
    }
  }

  // Create a new file, optionally inside `dir` (forward-slash relative path).
  async function newFile(dir = ""): Promise<void> {
    syncBuffer();
    const relFor = (n: number) =>
      dir ? `${dir}/untitled-${n}.tex` : `untitled-${n}.tex`;
    if (project && projectRoot) {
      untitledCount += 1;
      let rel = relFor(untitledCount);
      let abs = joinPath(projectRoot, rel);
      // Avoid clobbering an existing file.
      while (await project.exists(abs)) {
        untitledCount += 1;
        rel = relFor(untitledCount);
        abs = joinPath(projectRoot, rel);
      }
      try {
        await project.createEntry(abs, false);
      } catch (e) {
        toast.error(`Could not create file — ${e}`);
        return;
      }
      files = [
        ...files,
        { id: abs, name: rel, content: "", path: abs, loaded: true, saved: "" },
      ];
      activeId = abs;
      source = "";
      void refreshGitStatus();
      return;
    }
    untitledCount += 1;
    let rel = relFor(untitledCount);
    while (relExists(rel)) {
      untitledCount += 1;
      rel = relFor(untitledCount);
    }
    const id = `untitled-${untitledCount}`;
    files = [...files, { id, name: rel, content: "", saved: "" }];
    activeId = id;
    source = "";
  }

  // Existing folder paths (forward-slashed) derived from the file list + the
  // already-created empty folders, so "New folder" never picks a name in use.
  function existingFolderPaths(): Set<string> {
    const set = new Set(extraFolders);
    for (const f of files) {
      const parts = f.name.split("/");
      let cur = "";
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i];
        set.add(cur);
      }
    }
    return set;
  }

  // Create a new (empty) folder, optionally inside `dir`.
  async function newFolder(dir = ""): Promise<void> {
    const taken = existingFolderPaths();
    const relFor = (n: number) => {
      const leaf = n === 1 ? "new-folder" : `new-folder-${n}`;
      return dir ? `${dir}/${leaf}` : leaf;
    };
    let n = 1;
    let rel = relFor(1);
    while (taken.has(rel)) rel = relFor(++n);

    if (project && projectRoot) {
      const abs = joinPath(projectRoot, rel);
      try {
        await project.createEntry(abs, true);
      } catch (e) {
        toast.error(`Could not create folder — ${e}`);
        return;
      }
    }
    extraFolders = [...extraFolders, rel];
  }

  // --- Explorer move / folder ops + conflict handling ----------------------
  // Forward-slash path helpers for the *relative* names used in the tree.
  const leafOf = (rel: string) => {
    const i = rel.lastIndexOf("/");
    return i === -1 ? rel : rel.slice(i + 1);
  };
  const dirOf = (rel: string) => {
    const i = rel.lastIndexOf("/");
    return i === -1 ? "" : rel.slice(0, i);
  };
  function splitExt(name: string): { base: string; ext: string } {
    const i = name.lastIndexOf(".");
    return i > 0
      ? { base: name.slice(0, i), ext: name.slice(i) }
      : { base: name, ext: "" };
  }

  const relExists = (rel: string, exceptId?: string) =>
    files.some(
      (f) => f.id !== exceptId && f.name.toLowerCase() === rel.toLowerCase(),
    );
  function folderExists(path: string): boolean {
    const lower = path.toLowerCase();
    for (const p of existingFolderPaths())
      if (p.toLowerCase() === lower) return true;
    return false;
  }
  function uniqueLeaf(dir: string, leaf: string): string {
    const { base, ext } = splitExt(leaf);
    let candidate = leaf;
    let n = 1;
    while (relExists(dir ? `${dir}/${candidate}` : candidate))
      candidate = `${base} (${++n})${ext}`;
    return candidate;
  }
  function uniqueFolder(dir: string, name: string): string {
    let candidate = name;
    let n = 1;
    while (folderExists(dir ? `${dir}/${candidate}` : candidate))
      candidate = `${name} (${++n})`;
    return candidate;
  }

  // A promise-based modal: an op `await`s the user's choice; the dialog markup
  // resolves it. One pending request at a time (moves are sequential).
  type ConflictAction = "replace" | "rename" | "skip" | "merge";
  type ConflictChoice = {
    action: ConflictAction;
    newName?: string;
    applyToAll?: boolean;
  };
  type Pending =
    | {
        kind: "conflict";
        name: string;
        isFolder: boolean;
        /** Offer "Merge" (folder-into-folder). */
        canMerge: boolean;
        /** Offer the "apply to all" checkbox (batch file conflicts during a merge). */
        canApplyAll: boolean;
        resolve: (c: ConflictChoice) => void;
      }
    | {
        kind: "confirm";
        title: string;
        message: string;
        confirmLabel: string;
        resolve: (ok: boolean) => void;
      };
  let pending = $state<Pending | null>(null);
  let conflictName = $state("");
  let applyToAll = $state(false);

  function askConflict(
    name: string,
    isFolder: boolean,
    suggestion: string,
    opts: { canMerge?: boolean; canApplyAll?: boolean } = {},
  ): Promise<ConflictChoice> {
    conflictName = suggestion;
    applyToAll = false;
    return new Promise((resolve) => {
      pending = {
        kind: "conflict",
        name,
        isFolder,
        canMerge: !!opts.canMerge,
        canApplyAll: !!opts.canApplyAll,
        resolve,
      };
    });
  }
  function askConfirm(
    title: string,
    message: string,
    confirmLabel: string,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      pending = { kind: "confirm", title, message, confirmLabel, resolve };
    });
  }
  function resolveConflict(action: ConflictAction, newName?: string) {
    const p = pending;
    const all = applyToAll;
    pending = null;
    applyToAll = false;
    if (p?.kind === "conflict") p.resolve({ action, newName, applyToAll: all });
  }
  function resolveConfirm(ok: boolean) {
    const p = pending;
    pending = null;
    if (p?.kind === "confirm") p.resolve(ok);
  }
  function cancelPending() {
    const p = pending;
    pending = null;
    applyToAll = false;
    if (p?.kind === "conflict") p.resolve({ action: "skip" });
    else if (p?.kind === "confirm") p.resolve(false);
  }

  /** Apply a fully-resolved new relative path to one file (disk + state). */
  async function applyRename(
    f: GlyphFile,
    newRel: string,
  ): Promise<string | null> {
    if (project && projectRoot && f.path) {
      const newAbs = joinPath(projectRoot, newRel);
      try {
        await project.rename(f.path, newAbs);
      } catch (e) {
        toast.error(`Move failed — ${e}`);
        return null;
      }
      const wasActive = f.id === activeId;
      const wasMain = f.id === mainId;
      files = files.map((x) =>
        x.id === f.id ? { ...x, id: newAbs, name: newRel, path: newAbs } : x,
      );
      if (wasActive) activeId = newAbs;
      if (wasMain) {
        mainId = newAbs;
        void writeManifest();
      }
      return newAbs;
    }
    files = files.map((x) => (x.id === f.id ? { ...x, name: newRel } : x));
    return f.id;
  }

  /** Delete the file currently occupying `rel` (used by "Replace"). */
  async function removeRel(rel: string, exceptId?: string): Promise<void> {
    const victim = files.find(
      (x) => x.id !== exceptId && x.name.toLowerCase() === rel.toLowerCase(),
    );
    if (!victim) return;
    if (project && victim.path) await project.remove(victim.path);
    if (victim.id === mainId) {
      mainId = null;
      void writeManifest();
    }
    if (victim.id === activeId) activeId = "";
    files = files.filter((x) => x.id !== victim.id);
  }

  async function moveFile(id: string, targetDir: string): Promise<void> {
    syncBuffer();
    const f = files.find((x) => x.id === id);
    if (!f) return;
    const leaf = leafOf(f.name);
    let newRel = targetDir ? `${targetDir}/${leaf}` : leaf;
    if (newRel.toLowerCase() === f.name.toLowerCase()) return; // no-op
    if (relExists(newRel, id)) {
      const res = await askConflict(leaf, false, uniqueLeaf(targetDir, leaf));
      if (res.action === "skip") return;
      if (res.action === "rename") {
        const nl = uniqueLeaf(targetDir, (res.newName || leaf).trim() || leaf);
        newRel = targetDir ? `${targetDir}/${nl}` : nl;
      } else if (res.action === "replace") {
        try {
          await removeRel(newRel, id);
        } catch (e) {
          toast.error(`Replace failed — ${e}`);
          return;
        }
      }
    }
    const finalId = await applyRename(f, newRel);
    if (finalId && activeId === "") await openFile(finalId, true);
  }

  /** Move every file under `srcPath` to `newPath` (disk + state). Shared by
   * folder move and folder rename. */
  async function relocateFolder(
    srcPath: string,
    newPath: string,
  ): Promise<void> {
    syncBuffer();
    if (project && projectRoot) {
      try {
        await project.rename(
          joinPath(projectRoot, srcPath),
          joinPath(projectRoot, newPath),
        );
      } catch (e) {
        toast.error(`Move failed — ${e}`);
        return;
      }
    }
    const prefix = `${srcPath}/`;
    let nextActive = activeId;
    let nextMain = mainId;
    let mainMoved = false;
    files = files.map((f) => {
      if (f.name !== srcPath && !f.name.startsWith(prefix)) return f;
      const newName = newPath + f.name.slice(srcPath.length);
      if (project && projectRoot) {
        const newAbs = joinPath(projectRoot, newName);
        if (f.id === activeId) nextActive = newAbs;
        if (f.id === mainId) {
          nextMain = newAbs;
          mainMoved = true;
        }
        return { ...f, id: newAbs, name: newName, path: newAbs };
      }
      return { ...f, name: newName };
    });
    extraFolders = extraFolders.map((p) =>
      p === srcPath
        ? newPath
        : p.startsWith(prefix)
          ? newPath + p.slice(srcPath.length)
          : p,
    );
    activeId = nextActive;
    mainId = nextMain;
    if (mainMoved) void writeManifest();
  }

  async function moveFolder(srcPath: string, targetDir: string): Promise<void> {
    const name = leafOf(srcPath);
    // Guard: never move into self / a descendant.
    if (targetDir === srcPath || targetDir.startsWith(`${srcPath}/`)) return;
    let newPath = targetDir ? `${targetDir}/${name}` : name;
    if (newPath.toLowerCase() === srcPath.toLowerCase()) return; // no-op
    if (folderExists(newPath)) {
      const res = await askConflict(name, true, uniqueFolder(targetDir, name), {
        canMerge: true,
      });
      if (res.action === "skip") return;
      if (res.action === "merge") {
        await mergeFolder(srcPath, newPath);
        return;
      }
      if (res.action === "rename") {
        const nn = uniqueFolder(
          targetDir,
          (res.newName || name).trim() || name,
        );
        newPath = targetDir ? `${targetDir}/${nn}` : nn;
      } else if (res.action === "replace") {
        try {
          await removeFolder(newPath);
        } catch (e) {
          toast.error(`Replace failed — ${e}`);
          return;
        }
      }
    }
    await relocateFolder(srcPath, newPath);
  }

  /** Merge `srcPath` into an existing `dstPath`: move each file across, resolving
   * file-level name collisions (with an optional "apply to all"), then drop the
   * now-empty source folder. */
  async function mergeFolder(srcPath: string, dstPath: string): Promise<void> {
    syncBuffer();
    const prefix = `${srcPath}/`;
    const movers = files.filter(
      (f) => f.name === srcPath || f.name.startsWith(prefix),
    );
    let batch: ConflictChoice | null = null;
    let moved = 0;

    for (const f of movers) {
      // Re-fetch: an earlier "replace" may have removed/renamed this entry.
      const cur = files.find((x) => x.id === f.id);
      if (!cur) continue;
      let newRel = dstPath + cur.name.slice(srcPath.length);
      if (newRel.toLowerCase() === cur.name.toLowerCase()) continue;

      if (relExists(newRel, cur.id)) {
        let choice: ConflictChoice | null = batch;
        if (!choice) {
          const leaf = leafOf(cur.name);
          choice = await askConflict(
            leaf,
            false,
            uniqueLeaf(dirOf(newRel), leaf),
            {
              canApplyAll: movers.length > 1,
            },
          );
          if (choice.applyToAll) batch = choice;
        }
        if (choice.action === "skip") continue;
        if (choice.action === "rename") {
          const nl = uniqueLeaf(dirOf(newRel), leafOf(newRel));
          newRel = dirOf(newRel) ? `${dirOf(newRel)}/${nl}` : nl;
        } else if (choice.action === "replace") {
          try {
            await removeRel(newRel, cur.id);
          } catch (e) {
            toast.error(`Replace failed — ${e}`);
            continue;
          }
        }
      }
      const finalId = await applyRename(cur, newRel);
      if (finalId) moved += 1;
      if (finalId && activeId === "") await openFile(finalId, true);
    }

    // Remap empty subfolders of src into dst; drop the src folder itself.
    extraFolders = [
      ...new Set(
        extraFolders
          .filter((p) => p !== srcPath)
          .map((p) =>
            p.startsWith(prefix) ? dstPath + p.slice(srcPath.length) : p,
          ),
      ),
    ];
    // Clean up the source folder on disk only if nothing was left behind (skips).
    const leftover = files.some(
      (f) => f.name === srcPath || f.name.startsWith(prefix),
    );
    if (!leftover && project && projectRoot) {
      try {
        await project.remove(joinPath(projectRoot, srcPath));
      } catch {
        /* best-effort: empty dir cleanup */
      }
    }
    toast.success(`Merged ${moved} file${moved === 1 ? "" : "s"}`);
  }

  async function renameFolder(srcPath: string, newLeaf: string): Promise<void> {
    const leaf = newLeaf.trim();
    if (!leaf || /[\\/]/.test(leaf) || leaf === leafOf(srcPath)) return;
    const parent = dirOf(srcPath);
    const newPath = parent ? `${parent}/${leaf}` : leaf;
    if (folderExists(newPath)) {
      toast.error(`A folder named “${leaf}” already exists here.`);
      return;
    }
    await relocateFolder(srcPath, newPath);
  }

  /** Remove a folder and everything under it (disk + state). */
  async function removeFolder(path: string): Promise<void> {
    if (project && projectRoot) {
      await project.remove(joinPath(projectRoot, path));
    }
    const prefix = `${path}/`;
    const removed = files.filter(
      (f) => f.name === path || f.name.startsWith(prefix),
    );
    const hadMain = removed.some((f) => f.id === mainId);
    const hadActive = removed.some((f) => f.id === activeId);
    files = files.filter(
      (f) => !(f.name === path || f.name.startsWith(prefix)),
    );
    extraFolders = extraFolders.filter(
      (p) => !(p === path || p.startsWith(prefix)),
    );
    if (hadMain) {
      mainId = null;
      void writeManifest();
    }
    if (hadActive) {
      if (files[0]) await openFile(files[0].id, true);
      else {
        activeId = "";
        source = "";
      }
    }
  }

  async function deleteFolder(path: string): Promise<void> {
    const prefix = `${path}/`;
    const count = files.filter(
      (f) => f.name === path || f.name.startsWith(prefix),
    ).length;
    const tail = count ? ` and its ${count} file${count > 1 ? "s" : ""}` : "";
    const ok = await askConfirm(
      "Delete folder",
      `Delete “${leafOf(path)}”${tail}? This cannot be undone.`,
      "Delete",
    );
    if (!ok) return;
    try {
      await removeFolder(path);
      toast.success("Deleted");
    } catch (e) {
      toast.error(`Delete failed — ${e}`);
    }
  }

  // Rename a file from the Explorer. The tree edits the *leaf* name; keep the
  // folder prefix so a nested file stays in its folder.
  async function renameFile(id: string, newLeaf: string): Promise<void> {
    const target = files.find((f) => f.id === id);
    const leaf = newLeaf.trim();
    if (!target || !leaf || leaf === baseName(target.name)) return;
    const slash = target.name.lastIndexOf("/");
    const dir = slash === -1 ? "" : target.name.slice(0, slash + 1);
    const newRel = dir + leaf;
    if (project && projectRoot && target.path) {
      const newAbs = joinPath(projectRoot, newRel);
      try {
        await project.rename(target.path, newAbs);
      } catch (e) {
        toast.error(`Rename failed — ${e}`);
        return;
      }
      const wasMain = id === mainId;
      files = files.map((f) =>
        f.id === id ? { ...f, id: newAbs, name: newRel, path: newAbs } : f,
      );
      if (id === activeId) activeId = newAbs;
      if (wasMain) {
        mainId = newAbs;
        void writeManifest();
      }
      return;
    }
    files = files.map((f) => (f.id === id ? { ...f, name: newRel } : f));
  }

  async function deleteFile(id: string): Promise<void> {
    const remaining = files.filter((f) => f.id !== id);
    if (remaining.length === 0 && !project) {
      toast.error("Can't delete the last file in a project.");
      return;
    }
    const target = files.find((f) => f.id === id);
    const ok = await askConfirm(
      "Delete file",
      `Delete “${baseName(target?.name ?? "")}”? This cannot be undone.`,
      "Delete",
    );
    if (!ok) return;
    if (project) {
      const t = files.find((f) => f.id === id);
      if (t?.path) {
        try {
          await project.remove(t.path);
        } catch (e) {
          toast.error(`Delete failed — ${e}`);
          return;
        }
      }
    }
    const wasActive = id === activeId;
    files = remaining;
    if (id === mainId) {
      mainId = null;
      void writeManifest();
    }
    if (wasActive) {
      if (remaining[0]) await openFile(remaining[0].id, true);
      else {
        activeId = "";
        source = "";
      }
    }
    toast.success("Deleted");
  }

  /** Mark a file as the compile target and remember it in the `.glyx` manifest. */
  async function setMain(id: string): Promise<void> {
    mainId = id;
    await writeManifest();
    toast.success(
      `${baseName(files.find((f) => f.id === id)?.name ?? "")} is now the main file`,
    );
  }

  // The `.glyx` manifest (project root, named after the folder) records the main
  // file so reopening the folder — or double-clicking the .glyx — restores it.
  function manifestPath(): string | null {
    if (!projectRoot) return null;
    return joinPath(projectRoot, `${baseName(projectRoot)}.glyx`);
  }
  async function writeManifest(): Promise<void> {
    if (!project || !projectRoot) return;
    const mp = manifestPath();
    if (!mp) return;
    const mainRel = files.find((f) => f.id === mainId)?.name ?? null;
    const data = JSON.stringify(
      { glyph: 1, main: mainRel, name: baseName(projectRoot) },
      null,
      2,
    );
    try {
      await project.writeFile(mp, data);
    } catch {
      /* best-effort */
    }
  }

  // --- Open / import / export a project -------------------------------------
  /** Pick the main file from a manifest, else a sensible heuristic. */
  async function resolveMain(
    list: { abs: string; rel: string }[],
  ): Promise<string | null> {
    if (!project) return null;
    const glyx = list.find((f) => f.rel.toLowerCase().endsWith(".glyx"));
    if (glyx) {
      try {
        const m = JSON.parse(await project.readFile(glyx.abs));
        if (m && typeof m.main === "string") {
          const hit = list.find((f) => f.rel === m.main);
          if (hit) return hit.abs;
        }
      } catch {
        /* fall through to heuristics */
      }
    }
    const mainTex = list.find((f) => f.rel.toLowerCase() === "main.tex");
    if (mainTex) return mainTex.abs;
    const rootTex = list.find((f) => /^[^/]+\.tex$/i.test(f.rel));
    if (rootTex) return rootTex.abs;
    const anyTex = list.find((f) => f.rel.toLowerCase().endsWith(".tex"));
    return anyTex?.abs ?? list[0]?.abs ?? null;
  }

  async function loadProject(root: string, focusPath?: string): Promise<void> {
    if (!project) return;
    try {
      const list = await project.readFiles(root);
      projectRoot = root;
      // `.glyx` manifest is project metadata — keep it on disk, hide from the tree.
      const visible = list.filter(
        (f) => !f.rel.toLowerCase().endsWith(".glyx"),
      );
      files = visible.map((f) => ({
        id: f.abs,
        name: f.rel,
        content: "",
        path: f.abs,
        loaded: false,
      }));
      mainId = await resolveMain(list);
      untitledCount = 0;
      extraFolders = [];
      const focusId = focusPath
        ? files.find((f) => samePath(f.path, focusPath))?.id
        : undefined;
      const first = focusId ?? mainId ?? files[0]?.id;
      activeId = "";
      if (first) await openFile(first, true);
      else source = "";
      void refreshGitStatus();
      toast.success(`Opened ${baseName(root)}`);
    } catch (e) {
      toast.error(`Could not open project — ${e}`);
    }
  }

  /** Resolve a launched / picked path (folder, `.glyx`, or `.tex`) → open it. */
  async function openPath(p: string): Promise<void> {
    if (!project) return;
    const lower = p.toLowerCase();
    if (lower.endsWith(".glyx")) {
      await loadProject(parentDir(p));
    } else if (/\.[a-z0-9]+$/i.test(lower)) {
      await loadProject(parentDir(p), p);
    } else {
      await loadProject(p);
    }
  }

  async function openFolder(): Promise<void> {
    if (!project) return;
    const root = await project.pickFolder("Open LaTeX project folder");
    if (root) await loadProject(root);
  }

  async function importProject(): Promise<void> {
    if (!project) return;
    const file = await project.pickImportFile();
    if (!file) return;
    if (/\.zip$/i.test(file)) {
      const root = await project.importZip(file);
      if (root) await loadProject(root);
    } else {
      await openPath(file);
    }
  }

  async function exportProject(): Promise<void> {
    if (!project || !projectRoot) {
      toast.info("Open a project folder first to export it.");
      return;
    }
    await saveAll();
    try {
      const ok = await project.exportZip(
        projectRoot,
        `${baseName(projectRoot)}.zip`,
      );
      if (ok) toast.success("Exported project as ZIP");
    } catch (e) {
      toast.error(`Export failed — ${e}`);
    }
  }

  /** Reveal the open project folder in the OS file manager (Explorer / Finder). */
  async function revealProject(): Promise<void> {
    if (!project?.revealInOS || !projectRoot) return;
    try {
      await project.revealInOS(projectRoot);
    } catch (e) {
      toast.error(`Could not reveal the folder — ${e}`);
    }
  }

  /** Register the OS "Open with GlyphX" folder integration (desktop, Windows). */
  async function registerShell(): Promise<void> {
    if (!project?.registerShellIntegration) return;
    try {
      toast.success(await project.registerShellIntegration());
    } catch (e) {
      toast.error(`Could not register shell integration — ${e}`);
    }
  }

  // Open a folder / file the app shell routed us to (file-association launch),
  // and listen for later "Open with GlyphX" launches forwarded while we're open.
  onMount(() => {
    if (!project) return;
    let unlisten: (() => void) | undefined;
    void (async () => {
      if (openPathOnMount) {
        try {
          await openPath(openPathOnMount);
        } catch {
          /* ignore — bad launch path */
        }
      }
      try {
        unlisten = await project.onOpenPath?.((path) => void openPath(path));
      } catch {
        /* event bridge unavailable */
      }
    })();
    return () => unlisten?.();
  });

  type SearchOptions = {
    query: string;
    replace?: string;
    caseSensitive?: boolean;
    wholeWord?: boolean;
    regexp?: boolean;
    preserveCase?: boolean;
  };
  type SearchMatch = {
    from: number;
    to: number;
    line: number;
    column: number;
    text: string;
  };

  type EditorApi = {
    wrapSelection: (before: string, after?: string) => void;
    insertText: (text: string) => void;
    selectedText: () => string;
    focusEditor: () => void;
    undo: () => void;
    redo: () => void;
    goToLine: (line: number) => void;
    findAll: (o: SearchOptions) => SearchMatch[];
    selectRange: (from: number, to: number) => void;
    replaceRange: (from: number, to: number, insert: string) => void;
    replaceAllMatches: (o: SearchOptions, replacement: string) => number;
    clearSearch: () => void;
  };
  let editor = $state<EditorApi>();
  // Whether the editor currently has anything to undo / redo (bound from CodeEditor).
  let canUndo = $state(false);
  let canRedo = $state(false);

  let activeView = $state<ActivityView>("files");
  let panelCollapsed = $state(false);
  let viewMode = $state<ViewMode>("split");

  // Top bar: quick-open palette (the VS Code command centre). `projectName`
  // is a prop now (the open project's name).
  let paletteOpen = $state(false);
  // Help menu dialogs.
  let aboutOpen = $state(false);
  let shortcutsOpen = $state(false);

  // Snapshot of the current files (active file's live source merged in).
  function snapshotFiles(): GlyphFile[] {
    return files.map((f) =>
      f.id === activeId ? { ...f, content: source } : f,
    );
  }

  // Persist back to the host (project store) on any edit, debounced. Disabled
  // when a real folder is open — disk-backed projects save per-file via
  // `saveActive` / `saveAll` instead of round-tripping the whole set.
  $effect(() => {
    void source; // track edits
    void files; // track add/remove/rename
    if (!onpersist || projectRoot) return;
    const t = setTimeout(() => onpersist(snapshotFiles()), 500);
    return () => clearTimeout(t);
  });

  // Refresh the Explorer's Git status labels when the file set changes
  // structurally (add / remove / rename / move). Content edits don't re-fire
  // this — only an actual save (which calls refreshGitStatus) does.
  $effect(() => {
    void files;
    if (git && projectRoot) void refreshGitStatus();
  });

  // "After delay" auto-save: re-arm on each keystroke; persist the active file a
  // beat after typing stops. The other modes save on explicit save / focus loss.
  $effect(() => {
    void source; // track edits
    if (settings.autoSave !== "afterDelay") return;
    const f = files.find((x) => x.id === activeId);
    if (!f || !fileDirty(f)) return;
    const t = setTimeout(() => void saveActive(), AUTO_SAVE_DELAY_MS);
    return () => clearTimeout(t);
  });

  // View-mode toggles — three plain icon buttons (editor / split / preview).
  const viewOptions = [
    { value: "editor" as const, icon: IconPencil, title: "Editor only" },
    { value: "split" as const, icon: IconLayoutColumns, title: "Split view" },
    { value: "preview" as const, icon: IconEye, title: "Preview only" },
  ];

  let cursor = $state({ line: 1, column: 1 });

  const lineCount = $derived(source.split("\n").length);
  const charCount = $derived(source.length);
  const wordCount = $derived(
    source.trim() ? source.trim().split(/\s+/).length : 0,
  );

  // --- Resizable split -------------------------------------------------------
  let splitPct = $state(52);
  let dragging = $state(false);
  let bodyEl = $state<HTMLElement>();

  // --- Resizable sidebar (drag the edge; capped at 20% of the shell width) ---
  let shellEl = $state<HTMLElement>();
  let shellW = $state(2560);
  let sidebarW = $state(240);
  let resizingSidebar = $state(false);
  const ACTIVITY_BAR_PX = 48; // the w-12 rail left of the panel
  const maxSidebar = $derived(Math.max(200, Math.round(shellW * 0.3)));
  const sidebarWidth = $derived(Math.min(sidebarW, maxSidebar));

  $effect(() => {
    if (!shellEl || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (shellEl) shellW = shellEl.getBoundingClientRect().width;
    });
    ro.observe(shellEl);
    return () => ro.disconnect();
  });

  function startResize() {
    if (viewMode === "split") dragging = true;
  }
  function startSidebarResize() {
    resizingSidebar = true;
  }
  function onPointerMove(e: PointerEvent) {
    if (resizingSidebar && shellEl) {
      const rect = shellEl.getBoundingClientRect();
      const w = e.clientX - rect.left - ACTIVITY_BAR_PX;
      sidebarW = Math.min(maxSidebar, Math.max(200, w));
      return;
    }
    if (!dragging || viewMode !== "split" || !bodyEl) return;
    const rect = bodyEl.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    splitPct = Math.min(72, Math.max(28, pct));
  }
  function stopResize() {
    dragging = false;
    resizingSidebar = false;
  }

  function selectView(view: ActivityView) {
    if (view === activeView) panelCollapsed = !panelCollapsed;
    else {
      activeView = view;
      panelCollapsed = false;
    }
  }

  function cycleGrammar() {
    settings.grammar = settings.grammar === "legacy" ? "lezer" : "legacy";
  }

  // --- Find / replace (drives the side-panel Search view) -------------------
  let searchOpts = $state<SearchOptions>({
    query: "",
    replace: "",
    caseSensitive: false,
    wholeWord: false,
    regexp: false,
  });
  let searchResults = $state<SearchMatch[]>([]);
  let searchActive = $state(0);

  // The docked bottom find/replace bar (Ctrl/Cmd+F over the editor pane).
  let showFind = $state(false);
  let findBar = $state<{ focusInput: () => void }>();

  function openFind() {
    if (viewMode === "preview") viewMode = "split";
    showFind = true;
    // Seed from the current selection so "find this word" is one keystroke.
    const sel = editor?.selectedText?.() ?? "";
    if (sel && !sel.includes("\n")) {
      runSearch({ ...searchOpts, query: sel });
    } else if (searchOpts.query) {
      runSearch(searchOpts);
    }
    queueMicrotask(() => findBar?.focusInput());
  }
  function closeFind() {
    showFind = false;
    editor?.clearSearch();
    editor?.focusEditor();
  }

  function runSearch(o: SearchOptions) {
    searchOpts = o;
    searchResults = o.query ? (editor?.findAll(o) ?? []) : [];
    searchActive = 0;
    if (!o.query) editor?.clearSearch();
  }
  function gotoResult(i: number) {
    if (!searchResults.length) return;
    const n = searchResults.length;
    searchActive = ((i % n) + n) % n;
    const m = searchResults[searchActive];
    editor?.selectRange(m.from, m.to);
  }
  function searchNext() {
    gotoResult(searchActive + 1);
  }
  function searchPrev() {
    gotoResult(searchActive - 1);
  }
  function replaceCurrent(replace: string) {
    const m = searchResults[searchActive];
    if (!m) return;
    const matched = source.slice(m.from, m.to);
    let insert = replace;
    if (searchOpts.regexp) {
      try {
        let pat = searchOpts.query;
        if (searchOpts.wholeWord) pat = `\\b(?:${pat})\\b`;
        const single = new RegExp(pat, searchOpts.caseSensitive ? "" : "i");
        insert = matched.replace(single, replace);
      } catch {
        /* fall back to literal */
      }
    }
    if (searchOpts.preserveCase) insert = applyCase(matched, insert);
    editor?.replaceRange(m.from, m.to, insert);
    runSearch({ ...searchOpts, replace });
  }
  function replaceAll(replace: string) {
    const n = editor?.replaceAllMatches(searchOpts, replace) ?? 0;
    runSearch({ ...searchOpts, replace });
    toast.success(`Replaced ${n} ${n === 1 ? "match" : "matches"}`);
  }

  // Clear the editor highlight when neither the Search view nor the docked
  // find bar is showing.
  $effect(() => {
    const sidebarSearch = activeView === "search" && !panelCollapsed;
    if (!sidebarSearch && !showFind) editor?.clearSearch();
  });

  // --- Compilation (Tectonic on desktop; placeholder elsewhere) -------------
  // Live, debounced recompile-as-you-type. Tectonic is a heavier subprocess
  // than a WASM engine, so compiles are *coalesced*: while one is running we
  // never start a second — we mark the doc dirty and recompile once it lands.
  type CompileStatus = "idle" | "compiling" | "success" | "error";
  let compiling = $state(false);
  let compileStatus = $state<CompileStatus>("idle");
  let lastCompileMs = $state<number | null>(null);
  let pendingRecompile = false;
  let lastCompiledSource: string | null = null;
  let pdfUrl = $state<string | undefined>(undefined);
  let pdfBytes = $state<Uint8Array | undefined>(undefined);
  let synctex = $state<SyncTexMap | undefined>(undefined);
  let compileError = $state<string | undefined>(undefined);
  let compileLog = $state("");

  // Parsed diagnostics for the Problems panel; recomputed on each compile.
  const problems = $derived(parseLatexLog(compileLog, compileError));
  const problemSummary = $derived(summarizeProblems(problems));
  let showProblems = $state(false);

  const projectCompile = $derived(
    Boolean(compileProject && projectRoot && mainId),
  );
  const canCompile = $derived(Boolean(compile) || projectCompile);

  function base64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /** Double-click in the PDF → jump the editor to the matching source line. */
  function onReverse(loc: { page: number; x: number; y: number }) {
    const hit = synctex?.locate(loc.page, loc.x, loc.y);
    if (hit) editor?.goToLine(hit.line);
  }

  let pdfView = $state<{
    revealLocation: (loc: SyncTexLocation) => void;
    zoomIn: () => void;
    zoomOut: () => void;
    setZoomPct: (pct: number) => void;
    fitWidth: () => void;
    openFind: () => void;
  }>();

  // PDF preview zoom/page state — bound from PdfView, driven by the header.
  let pdfScalePct = $state(100);
  let pdfFitMode = $state(true);
  let pdfNumPages = $state(0);
  const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200];

  /**
   * Save the compiled PDF from the preview toolbar. On desktop the host injects
   * `saveFile` (Tauri's dialog + fs plugins → a real native "Save As"); on the
   * web we fall back to a normal browser download.
   */
  async function downloadPdf() {
    if (!pdfBytes) return;
    const srcName =
      files.find((f) => f.id === mainId)?.name ??
      activeFile?.name ??
      "document";
    const base = baseName(srcName).replace(/\.[^./\\]+$/, "") || "document";
    const filename = `${base}.pdf`;
    try {
      if (saveFile) {
        const saved = await saveFile(pdfBytes, {
          filename,
          extensions: ["pdf"],
        });
        if (saved) toast.success(`Saved ${filename}`);
        return; // false = user cancelled the dialog → stay quiet
      }
      if (!pdfUrl) return;
      const a = document.createElement("a");
      a.href = pdfUrl;
      a.download = filename;
      a.click();
      toast.success(`Downloaded ${filename}`);
    } catch (e) {
      toast.error(`Could not save the PDF — ${e}`);
    }
  }

  /** Forward sync: caret line → scroll/flash the matching region in the PDF. */
  function syncToPdf() {
    if (!synctex) {
      toast.info("Compile first to sync to the PDF.");
      return;
    }
    const loc = synctex.forward(cursor.line);
    if (!loc) {
      toast.info(`No PDF location for line ${cursor.line}.`);
      return;
    }
    if (viewMode === "editor") viewMode = "split";
    pdfView?.revealLocation(loc);
  }

  async function runCompile(manual = false) {
    if (!canCompile) {
      compileError = "Compilation runs in the GlyphX desktop app.";
      compileStatus = "error";
      if (manual && viewMode === "editor") viewMode = "split";
      return;
    }
    // Coalesce: a compile is already in flight — queue exactly one rerun.
    if (compiling) {
      pendingRecompile = true;
      return;
    }
    if (manual && viewMode === "editor") viewMode = "split";
    compiling = true;
    try {
      do {
        pendingRecompile = false;
        // Flush the active buffer (to disk for project files) so the engine
        // sees the latest source before it runs. `false` = don't re-arm the
        // auto-compile from inside a compile.
        await saveActive(false);
        const snapshot = source;
        const useProject = projectCompile;
        // Skip redundant auto-recompiles of already-rendered content. Only in
        // single-file mode — in a project, an edit to a non-active file (saved
        // on switch) wouldn't change `source`, so we always recompile there.
        if (!manual && !useProject && snapshot === lastCompiledSource) break;
        compileStatus = "compiling";
        const started = performance.now();
        const out =
          useProject && compileProject && projectRoot
            ? await compileProject(
                projectRoot,
                files.find((f) => f.id === mainId)?.name ?? "",
              )
            : compile
              ? await compile(snapshot)
              : { error: "No compiler available." };
        lastCompileMs = Math.round(performance.now() - started);
        compileLog = out.log ?? "";
        // Mirror to the devtools console so logs are readable/debuggable.
        if (out.error) {
          console.error(
            `[GlyphX] LaTeX compilation failed (${lastCompileMs}ms): ${out.error}`,
          );
          if (out.log) console.error(out.log);
        } else {
          console.info(`[GlyphX] compiled in ${lastCompileMs}ms`);
          if (out.log?.trim()) console.debug(out.log);
        }
        if (out.pdf) {
          if (pdfUrl) URL.revokeObjectURL(pdfUrl);
          const bytes = base64ToBytes(out.pdf);
          pdfBytes = bytes;
          pdfUrl = URL.createObjectURL(
            new Blob([bytes as BlobPart], { type: "application/pdf" }),
          );
          synctex = out.synctex ? parseSyncTex(out.synctex) : undefined;
          compileError = undefined;
          compileStatus = "success";
          lastCompiledSource = snapshot;
          // A best-effort PDF can still carry errors (e.g. an undefined macro
          // that the engine recovered from). Surface them like Overleaf does.
          if (problemSummary.errors > 0) showProblems = true;
        } else {
          compileError = out.error ?? "Compilation failed.";
          compileStatus = "error";
          showProblems = true; // surface failures immediately
        }
      } while (pendingRecompile);
    } catch (e) {
      compileError = String(e);
      compileStatus = "error";
      showProblems = true;
      console.error("[GlyphX] compile threw:", e);
    } finally {
      compiling = false;
    }
  }

  // Debounced auto-compile: re-arm whenever the *saved* content changes (a save
  // lands → `savedTick` bumps) or the main file changes. With auto-save off,
  // nothing here fires until you save — so the preview shows the last saved
  // version. Disabled when auto-compile is off or no engine is wired.
  $effect(() => {
    void savedTick; // re-run after each save
    void mainId; // recompile when the main file changes
    const auto = settings.autoCompile;
    if (!canCompile || !auto) return;
    const timer = setTimeout(() => runCompile(false), COMPILE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });

  const compileLabel = $derived(
    !canCompile
      ? "Desktop only"
      : compileStatus === "compiling"
        ? "Compiling…"
        : compileStatus === "error"
          ? "Compile error"
          : compileStatus === "success"
            ? lastCompileMs != null
              ? `Compiled in ${(lastCompileMs / 1000).toFixed(1)}s`
              : "Compiled"
            : "Ready",
  );

  // VS Code-style application menu. `$derived` so checkmarks (view mode, live
  // compile, open panel) stay in sync with state. Actions reuse the same
  // handlers the rest of the chrome calls.
  const menus = $derived<Menu[]>([
    {
      label: "File",
      items: [
        {
          label: "New File",
          shortcut: shortcutLabel("new-file"),
          run: () => newFile(),
        },
        {
          label: "Open File…",
          shortcut: shortcutLabel("quick-open"),
          run: () => (paletteOpen = true),
        },
        {
          label: "Open Folder…",
          shortcut: shortcutLabel("open-folder"),
          disabled: !project,
          run: () => openFolder(),
        },
        { type: "separator" },
        {
          label: "Import Project…",
          disabled: !project,
          run: () => importProject(),
        },
        {
          label: "Export as Zip",
          disabled: !project || !projectRoot,
          run: () => exportProject(),
        },
        { type: "separator" },
        {
          label: "Compile",
          shortcut: shortcutLabel("compile"),
          disabled: !canCompile,
          run: () => runCompile(true),
        },
      ],
    },
    {
      label: "Edit",
      items: [
        {
          label: "Undo",
          shortcut: shortcutLabel("undo"),
          disabled: !canUndo,
          run: () => editor?.undo(),
        },
        {
          label: "Redo",
          shortcut: shortcutLabel("redo"),
          disabled: !canRedo,
          run: () => editor?.redo(),
        },
        { type: "separator" },
        { label: "Bold", run: () => editor?.wrapSelection("\\textbf{", "}") },
        { label: "Italic", run: () => editor?.wrapSelection("\\textit{", "}") },
        { type: "separator" },
        {
          label: "Insert Section",
          run: () => editor?.insertText("\\section{}\n"),
        },
        {
          label: "Insert List",
          run: () =>
            editor?.insertText("\\begin{itemize}\n  \\item \n\\end{itemize}\n"),
        },
        {
          label: "Insert Equation",
          run: () =>
            editor?.insertText("\\begin{equation}\n  \n\\end{equation}\n"),
        },
        { type: "separator" },
        {
          label: "Find in File",
          shortcut: shortcutLabel("find"),
          run: () => {
            activeView = "search";
            panelCollapsed = false;
          },
        },
      ],
    },
    {
      label: "View",
      items: [
        {
          label: "Explorer",
          checked: !panelCollapsed && activeView === "files",
          run: () => selectView("files"),
        },
        {
          label: "Search",
          checked: !panelCollapsed && activeView === "search",
          run: () => selectView("search"),
        },
        {
          label: "Source Control",
          checked: !panelCollapsed && activeView === "git",
          run: () => selectView("git"),
        },
        { type: "separator" },
        {
          label: "Editor",
          checked: viewMode === "editor",
          run: () => (viewMode = "editor"),
        },
        {
          label: "Split",
          checked: viewMode === "split",
          run: () => (viewMode = "split"),
        },
        {
          label: "Preview",
          checked: viewMode === "preview",
          run: () => (viewMode = "preview"),
        },
        { type: "separator" },
        {
          label: "Toggle Sidebar",
          shortcut: shortcutLabel("toggle-sidebar"),
          checked: !panelCollapsed,
          run: () => (panelCollapsed = !panelCollapsed),
        },
        {
          label: "Problems",
          checked: showProblems,
          run: () => (showProblems = !showProblems),
        },
      ],
    },
    {
      label: "Go",
      items: [
        {
          label: "Go to File…",
          shortcut: shortcutLabel("quick-open"),
          run: () => (paletteOpen = true),
        },
        { type: "separator" },
        {
          label: "Sync to PDF",
          shortcut: shortcutLabel("sync-pdf"),
          run: () => syncToPdf(),
        },
      ],
    },
    {
      label: "Run",
      items: [
        {
          label: "Compile",
          shortcut: shortcutLabel("compile"),
          disabled: !canCompile,
          run: () => runCompile(true),
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
          run: () => syncToPdf(),
        },
      ],
    },
    {
      label: "Help",
      items: [
        {
          label: "Keyboard Shortcuts",
          run: () => (shortcutsOpen = true),
        },
        { type: "separator" },
        {
          label: "About GlyphX",
          run: () => (aboutOpen = true),
        },
      ],
    },
  ]);

  // App-level shortcuts, matched against the shared registry so the keys here,
  // the menu hints, and the Keyboard Shortcuts dialog can never drift apart.
  // Editor-scoped combos (Undo / Redo) are handled by CodeMirror itself when the
  // editor is focused, so they're intentionally not intercepted here.
  function onKeydown(e: KeyboardEvent) {
    // Cheap early-out: every app shortcut carries a Mod (⌘/Ctrl).
    if (!(e.ctrlKey || e.metaKey)) return;
    const actions: Array<[string, () => void]> = [
      ["compile", () => runCompile(true)],
      ["sync-pdf", () => syncToPdf()],
      ["quick-open", () => (paletteOpen = true)],
      ["find", () => openFind()],
      ["new-file", () => void newFile()],
      ["toggle-sidebar", () => (panelCollapsed = !panelCollapsed)],
    ];
    if (project) actions.push(["open-folder", () => void openFolder()]);
    for (const [id, run] of actions) {
      if (matchShortcut(e, id)) {
        e.preventDefault();
        run();
        return;
      }
    }
  }

  onDestroy(() => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  });
</script>

<svelte:window
  onpointermove={onPointerMove}
  onpointerup={stopResize}
  onkeydown={onKeydown}
/>

<div class="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
  <!-- Top bar — VS Code-style: logo + menu (left) · workspace (centre) ·
	     view toggles + export + compile (right). Theme & settings live in the
	     Settings panel, not here. -->
  <header
    class="border-border bg-card flex h-11 shrink-0 items-center gap-2 border-b px-2.5"
  >
    <!-- Left: logo + application menu -->
    <div class="flex shrink-0 items-center gap-1.5">
      <Logo
        href="/"
        text={false}
        size="md"
        viewTransitionName="app-logo"
        class="pr-1"
      />
      <MenuBar {menus} />
    </div>

    <!-- Centre: workspace name / quick-open (⌘P) -->
    <div class="flex flex-1 justify-center">
      <CommandPalette
        bind:open={paletteOpen}
        {files}
        {activeId}
        projectName={displayName}
        onopen={openFile}
      />
    </div>

    <!-- Right: view toggles · export · compile -->
    <div class="inline-flex shrink-0 items-center gap-2">
      <Select bind:value={viewMode} type="single" name="viewMode">
        <SelectTrigger
          size="sm"
          class="w-auto min-w-0 border-0 text-xs font-normal focus:ring-0"
          aria-label="Select view mode"
        >
          {@const Icon = viewOptions.find((o) => o.value === viewMode)?.icon}
          {#if Icon}
            <Icon class="inline-block size-4" />
          {/if}
          {viewMode === "editor"
            ? "Editor only"
            : viewMode === "split"
              ? "Split view"
              : "Preview only"}
        </SelectTrigger>
        <SelectContent>
          {#each viewOptions as option (option.value)}
            <SelectItem value={option.value}>{option.title}</SelectItem>
          {/each}
        </SelectContent>
      </Select>

      <ExportMenu
        {source}
        filename={activeFile?.name ?? "document.tex"}
        {pdfBytes}
        {saveFile}
        onExportZip={project ? exportProject : undefined}
        canExportZip={Boolean(projectRoot)}
        size="default"
      />

      <!-- Compile split-button: run + a ▾ menu for live-compile / sync. -->
      <ButtonGroup>
        <Button onclick={() => runCompile(true)} disabled={compiling} size="xs">
          {#if compiling}
            <IconLoader2 class="animate-spin" />
          {:else}
            <IconPlayerPlayFilled />
          {/if}
          {compiling ? "Compiling…" : "Compile"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger>
            {#snippet child({ props })}
              <Button
                {...props}
                size="icon-xs"
                title="Compile options"
                aria-label="Compile options"
              >
                <IconChevronDown />
              </Button>
            {/snippet}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-52">
            <DropdownMenuCheckboxItem
              checked={settings.autoCompile}
              onCheckedChange={(v) => (settings.autoCompile = v)}
            >
              Live compile
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem
              disabled={!canCompile}
              onclick={() => runCompile(true)}
            >
              Compile once
              <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onclick={() => syncToPdf()}>
              Sync to PDF
              <DropdownMenuShortcut>⌘J</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    </div>
  </header>

  <!-- Body -->
  <div bind:this={shellEl} class="flex min-h-0 flex-1">
    <ActivityBar active={activeView} onselect={selectView} />

    <!-- Smooth collapse + drag-to-resize (panel stays mounted; capped at 20%). -->
    <div
      class="shrink-0 overflow-hidden {resizingSidebar
        ? ''
        : 'transition-[width] duration-300 ease-[cubic-bezier(0.625,0.05,0,1)]'} {panelCollapsed
        ? 'pointer-events-none'
        : ''}"
      style:width={panelCollapsed ? "0px" : `${sidebarWidth}px`}
      aria-hidden={panelCollapsed}
    >
      <SidePanel
        view={activeView}
        {files}
        folders={extraFolders}
        {activeId}
        {mainId}
        {source}
        projectName={displayName}
        hasProject={Boolean(project)}
        {engine}
        {git}
        {projectRoot}
        widthPx={sidebarWidth}
        onopen={openFile}
        onnew={newFile}
        onnewfolder={newFolder}
        onopenfolder={openFolder}
        onreveal={project?.revealInOS && projectRoot
          ? revealProject
          : undefined}
        onrenamefile={renameFile}
        ondeletefile={deleteFile}
        onsetmain={setMain}
        onmovefile={moveFile}
        onmovefolder={moveFolder}
        onrenamefolder={renameFolder}
        ondeletefolder={deleteFolder}
        onnewfilein={(dir) => newFile(dir)}
        onnewfolderin={(dir) => newFolder(dir)}
        {dirtyIds}
        {gitStatus}
        ongotoline={(n) => editor?.goToLine(n)}
        onregistershell={project?.registerShellIntegration
          ? registerShell
          : undefined}
        {searchResults}
        {searchActive}
        onsearch={runSearch}
        ongotoresult={gotoResult}
        onsearchnext={searchNext}
        onsearchprev={searchPrev}
        onreplacecurrent={replaceCurrent}
        onreplaceall={replaceAll}
      />
    </div>

    {#if !panelCollapsed}
      <div
        class="group relative z-10 flex w-1 shrink-0 cursor-col-resize touch-none items-center justify-center"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        tabindex="-1"
        onpointerdown={startSidebarResize}
      >
        <span
          class="h-10 w-0.5 rounded-full transition-colors {resizingSidebar
            ? 'bg-primary'
            : 'bg-border group-hover:bg-primary/60'}"
        ></span>
      </div>
    {/if}

    <!-- min-w-0 lets these flex children shrink below their content's intrinsic
		     width, so a wide PDF page / long log line can't push the layout past the
		     window edge (which would hide the preview toolbar + log copy button). -->
    <main class="flex min-h-0 min-w-0 flex-1 flex-col">
      <div bind:this={bodyEl} class="flex min-h-0 min-w-0 flex-1">
        {#if viewMode !== "preview"}
          <section
            class="flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden {viewMode ===
            'split'
              ? 'border-border border-r'
              : ''}"
            style={viewMode === "split" ? `width:${splitPct}%` : "width:100%"}
          >
            <div
              class="text-muted-foreground border-border flex h-9 shrink-0 items-center gap-2 border-b px-2 text-xs"
            >
              <FormatToolbar
                wrap={(b, a) => editor?.wrapSelection(b, a)}
                insert={(t) => editor?.insertText(t)}
              />

              <!-- Right cluster: save, history, find, sync. -->
              <div class="ml-auto flex shrink-0 items-center gap-1 pl-1">
                <button
                  class="hover:bg-muted hover:text-foreground relative grid size-6 place-items-center rounded transition-colors disabled:pointer-events-none disabled:opacity-40"
                  title={activeDirty ? "Save (⌘/Ctrl+S)" : "Saved"}
                  aria-label="Save"
                  disabled={!activeDirty}
                  onclick={() => void saveActive()}
                >
                  <IconDeviceFloppy size={15} />
                  {#if activeDirty}
                    <span
                      class="bg-brand absolute top-0.5 right-0.5 size-1.5 rounded-full"
                    ></span>
                  {/if}
                </button>
                <div class="bg-border/70 mx-0.5 h-5 w-px"></div>
                <button
                  class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors disabled:pointer-events-none disabled:opacity-40"
                  title="Undo (⌘/Ctrl+Z)"
                  aria-label="Undo"
                  disabled={!canUndo}
                  onclick={() => editor?.undo()}
                >
                  <IconArrowBackUp size={15} />
                </button>
                <button
                  class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors disabled:pointer-events-none disabled:opacity-40"
                  title="Redo (⌘/Ctrl+Shift+Z)"
                  aria-label="Redo"
                  disabled={!canRedo}
                  onclick={() => editor?.redo()}
                >
                  <IconArrowForwardUp size={15} />
                </button>
                <div class="bg-border/70 mx-0.5 h-5 w-px"></div>
                <button
                  class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors {showFind
                    ? 'bg-muted text-foreground'
                    : ''}"
                  title="Find / replace (⌘/Ctrl+F)"
                  aria-label="Find in document"
                  aria-pressed={showFind}
                  onclick={() => (showFind ? closeFind() : openFind())}
                >
                  <IconSearch size={15} />
                </button>
                <button
                  class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
                  title="Sync to PDF (⌘/Ctrl+J)"
                  aria-label="Sync to PDF"
                  onclick={syncToPdf}
                >
                  <IconCurrentLocation size={15} />
                </button>
              </div>
            </div>
            <div class="min-h-0 flex-1">
              <CodeEditor
                bind:this={editor}
                bind:value={source}
                bind:canUndo
                bind:canRedo
                docKey={activeId}
                theme={settings.resolved}
                grammar={settings.grammar}
                fontSize={settings.fontSize}
                fontFamily={settings.fontStack}
                lineWrapping={settings.lineWrapping}
                oncursor={(p) => (cursor = p)}
              />
            </div>
            {#if showFind}
              <EditorFindBar
                bind:this={findBar}
                initial={searchOpts}
                resultCount={searchResults.length}
                activeIndex={searchActive}
                onsearch={runSearch}
                onnext={searchNext}
                onprev={searchPrev}
                onreplacecurrent={replaceCurrent}
                onreplaceall={replaceAll}
                onclose={closeFind}
              />
            {/if}
          </section>
        {/if}

        {#if viewMode === "split"}
          <div
            class="group relative z-10 flex w-1 shrink-0 cursor-col-resize touch-none items-center justify-center"
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={Math.round(splitPct)}
            tabindex="-1"
            onpointerdown={startResize}
          >
            <span
              class="h-10 w-0.5 rounded-full transition-colors {dragging
                ? 'bg-primary'
                : 'bg-border group-hover:bg-primary/60'}"
            ></span>
          </div>
        {/if}

        {#if viewMode !== "editor"}
          <section class="bg-muted/40 flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              class="text-muted-foreground border-border flex h-9 shrink-0 items-center gap-1.5 border-b px-2 text-xs"
            >
              <!-- Status + recompile -->
              <span
                class="inline-flex min-w-0 items-center gap-1.5 truncate pl-1 {compileStatus ===
                'error'
                  ? 'text-destructive'
                  : 'text-muted-foreground/80'}"
              >
                {#if compileStatus === "compiling"}
                  <IconLoader2 size={12} class="animate-spin" />
                {:else if compileStatus === "error"}
                  <IconAlertTriangle size={12} />
                {:else}
                  <span
                    class="size-1.5 rounded-full {compileStatus === 'success'
                      ? 'bg-success'
                      : 'bg-muted-foreground/40'}"
                  ></span>
                {/if}
                {compileLabel}
              </span>

              {#if pdfBytes}
                <!-- Find + page count + zoom + download -->
                <div class="ml-auto flex items-center gap-1">
                  <button
                    class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
                    title="Find in PDF (Ctrl/Cmd+F)"
                    aria-label="Find in PDF"
                    onclick={() => pdfView?.openFind()}
                  >
                    <IconSearch size={14} />
                  </button>
                  <span class="bg-border mx-1 h-4 w-px"></span>
                  <span class="text-muted-foreground/70 tabular-nums">
                    {pdfNumPages || 1} page{(pdfNumPages || 1) === 1 ? "" : "s"}
                  </span>
                  <span class="bg-border mx-1 h-4 w-px"></span>
                  <button
                    class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
                    title="Zoom out"
                    aria-label="Zoom out"
                    onclick={() => pdfView?.zoomOut()}
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
                          {pdfFitMode ? "Fit" : `${pdfScalePct}%`}
                          <IconChevronDown size={12} class="opacity-60" />
                        </button>
                      {/snippet}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-36">
                      <DropdownMenuItem onclick={() => pdfView?.fitWidth()}>
                        Fit width
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {#each ZOOM_PRESETS as pct (pct)}
                        <DropdownMenuItem
                          onclick={() => pdfView?.setZoomPct(pct)}
                        >
                          {pct}%
                        </DropdownMenuItem>
                      {/each}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
                    title="Zoom in"
                    aria-label="Zoom in"
                    onclick={() => pdfView?.zoomIn()}
                  >
                    <IconPlus size={14} />
                  </button>
                  <span class="bg-border mx-1 h-4 w-px"></span>
                  <button
                    class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
                    title="Download PDF"
                    aria-label="Download PDF"
                    onclick={downloadPdf}
                  >
                    <IconDownload size={14} />
                  </button>
                </div>
              {/if}
            </div>
            <div class="min-h-0 flex-1">
              {#if pdfBytes}
                <PdfView
                  bind:this={pdfView}
                  data={pdfBytes}
                  onreverse={onReverse}
                  bind:scalePct={pdfScalePct}
                  bind:fitMode={pdfFitMode}
                  bind:numPages={pdfNumPages}
                />
              {:else}
                <div class="h-full overflow-auto p-6">
                  {#if compileError}
                    <div
                      class="border-destructive/30 bg-destructive/5 mx-auto max-w-prose rounded-lg border p-4"
                    >
                      <p class="text-destructive text-sm font-medium">
                        {compileError}
                      </p>
                      {#if compileLog}
                        <pre
                          class="text-muted-foreground mt-3 max-h-72 overflow-auto font-mono text-[11px] whitespace-pre-wrap">{compileLog}</pre>
                      {/if}
                    </div>
                  {:else}
                    <div
                      class="glyphx-print-area flex h-full flex-col items-center justify-center gap-6 text-center"
                    >
                      <Logo text={false} badge size={64} class="opacity-95" />
                      {#if compileStatus === "compiling"}
                        <div
                          class="text-muted-foreground flex items-center gap-2.5 text-sm"
                        >
                          <Spinner class="size-4" />
                          <span>Rendering your document…</span>
                        </div>
                      {:else if canCompile}
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
                            Compilation runs in the GlyphX desktop app — fully
                            offline.
                          </p>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </section>
        {/if}
      </div>

      {#if showProblems}
        <ProblemsPanel
          {problems}
          log={compileLog}
          ongoto={(l) => {
            editor?.goToLine(l);
            if (viewMode === "preview") viewMode = "split";
          }}
          onclose={() => (showProblems = false)}
        />
      {/if}

      <!-- Status bar -->
      <footer
        class="border-border bg-card text-muted-foreground flex h-6 shrink-0 items-center gap-3 border-t px-3 text-[11px]"
      >
        <span
          class="flex items-center gap-1.5 {compileStatus === 'error'
            ? 'text-destructive'
            : ''}"
        >
          <span
            class="size-1.5 rounded-full {compileStatus === 'compiling'
              ? 'bg-primary animate-pulse'
              : compileStatus === 'error'
                ? 'bg-destructive'
                : 'bg-success'}"
          ></span>
          {compileLabel}
        </span>
        <span class="text-muted-foreground/50">·</span>
        <span>{settings.autoCompile ? "Auto" : "Manual"}</span>
        {#if dirtyIds.size > 0}
          <button
            class="text-brand inline-flex items-center gap-1 transition-opacity hover:opacity-80"
            title="Save all unsaved files (⌘/Ctrl+Shift+S)"
            onclick={() => void saveAll()}
          >
            <span class="bg-brand size-1.5 rounded-full"></span>
            <span class="tabular-nums">{dirtyIds.size} unsaved</span>
          </button>
        {/if}
        <span>LaTeX · Tectonic</span>
        <button
          class="hover:text-foreground transition-colors"
          title="Toggle LaTeX grammar"
          onclick={cycleGrammar}
        >
          {settings.grammar === "legacy" ? "stex" : "lezer"}
        </button>
        <button
          class="inline-flex items-center gap-1 transition-colors hover:text-foreground {problemSummary.errors
            ? 'text-destructive'
            : problemSummary.warnings
              ? 'text-warning'
              : ''}"
          title="Toggle problems / log"
          aria-pressed={showProblems}
          onclick={() => (showProblems = !showProblems)}
        >
          <IconAlertTriangle size={12} />
          <span class="tabular-nums"
            >{problemSummary.errors}/{problemSummary.warnings}</span
          >
        </button>
        <span class="text-muted-foreground/50 ml-auto"
          >Ln {cursor.line}, Col {cursor.column}</span
        >
        <span class="text-muted-foreground/50"
          >{lineCount} lines · {wordCount} words · {charCount} chars</span
        >
        {#if statusNote}
          <span
            class="text-muted-foreground/50"
            title="In-browser LaTeX package server">{statusNote}</span
          >
        {/if}
        <span class="text-muted-foreground/50 capitalize">{platform}</span>
      </footer>
    </main>
  </div>
</div>

<!-- Explorer move/delete prompts: name-conflict resolution + destructive confirm. -->
<Dialog
  open={pending !== null}
  onOpenChange={(o) => (o ? null : cancelPending())}
>
  <DialogContent class="sm:max-w-md">
    {#if pending?.kind === "conflict"}
      <DialogHeader>
        <DialogTitle
          >{pending.isFolder ? "Folder" : "File"} already exists</DialogTitle
        >
        <DialogDescription>
          {pending.isFolder ? "A folder" : "A file"} named “{pending.name}”
          already exists here.{pending.canMerge
            ? " Merge their contents, keep both, replace it, or skip."
            : " Keep both (rename), replace it, or skip the move."}
        </DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-1.5">
        <span class="text-muted-foreground text-xs">New name</span>
        <input
          bind:value={conflictName}
          class="bg-background border-border text-foreground focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-2.5 text-sm outline-none focus-visible:ring-1"
          spellcheck="false"
          onkeydown={(e) => {
            if (e.key === "Enter") resolveConflict("rename", conflictName);
          }}
        />
        {#if pending.canApplyAll}
          <label
            class="text-muted-foreground mt-1 flex items-center gap-2 text-xs select-none"
          >
            <input
              type="checkbox"
              bind:checked={applyToAll}
              class="accent-brand size-3.5"
            />
            Apply to all remaining conflicts
          </label>
        {/if}
      </div>
      <DialogFooter>
        <Button
          variant="ghost"
          size="sm"
          onclick={() => resolveConflict("skip")}>Skip</Button
        >
        {#if pending.canMerge}
          <Button
            variant="outline"
            size="sm"
            onclick={() => resolveConflict("merge")}
          >
            Merge
          </Button>
        {/if}
        <Button
          variant="destructive"
          size="sm"
          onclick={() => resolveConflict("replace")}
        >
          Replace
        </Button>
        <Button
          size="sm"
          onclick={() => resolveConflict("rename", conflictName)}
          >Keep both</Button
        >
      </DialogFooter>
    {:else if pending?.kind === "confirm"}
      <DialogHeader>
        <DialogTitle>{pending.title}</DialogTitle>
        <DialogDescription>{pending.message}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" size="sm" onclick={() => resolveConfirm(false)}
          >Cancel</Button
        >
        <Button
          variant="destructive"
          size="sm"
          onclick={() => resolveConfirm(true)}
        >
          {pending.confirmLabel}
        </Button>
      </DialogFooter>
    {/if}
  </DialogContent>
</Dialog>

<!-- Help: About card + the keyboard-shortcuts reference (both registry-driven). -->
<AboutDialog bind:open={aboutOpen} {platform} />
<ShortcutsDialog bind:open={shortcutsOpen} />

<!-- Toast feedback (bottom-right; matches the app's corner-notification language). -->
<Toaster />

<style>
  /* PDF export = print the preview page only, until Tectonic compiles for real. */
  @media print {
    :global(body *) {
      visibility: hidden !important;
    }
    :global(.glyphx-print-area),
    :global(.glyphx-print-area *) {
      visibility: visible !important;
    }
    :global(.glyphx-print-area) {
      position: fixed;
      inset: 0;
      max-width: none;
      border: none;
      overflow: visible;
    }
  }
</style>
