<script lang="ts">
  import { settings } from "@glyphtex/ui/settings";
  import { IconGitBranch } from '@tabler/icons-svelte';

  import type { ActivityView } from "./activity-bar.svelte";
  import type { EngineManager } from "./engine-settings.svelte";
  import GitPanel, { type GitProvider } from "./git-panel.svelte";
  import ExplorerView from "./side-panel/explorer-view.svelte";
  import OutlineView from "./side-panel/outline-view.svelte";
  import PanelHeader from "./side-panel/panel-header.svelte";
  import SearchView from "./side-panel/search-view.svelte";
  import SettingsView from "./side-panel/settings-view.svelte";
  import { SidePanelStore } from "./side-panel/store.svelte";
  import type { FileMeta, SearchMatch, SearchOptions } from "./side-panel/types";

  /**
   * SidePanel — content for the active rail view. Explorer switches files;
   * Settings edits the live preferences; Search is a full find/replace panel
   * wired to the editor; Source Control is the Git view. Local UI state +
   * behaviour live in {@link SidePanelStore}; each view is its own component.
   */
  let {
    view = "files",
    files = [],
    folders = [],
    activeId = "",
    mainId = null,
    projectName = "Project",
    hasProject = false,
    widthPx = 300,
    source = "",
    engine,
    git,
    gitRoot = null,
    onopendiff,
    activeDiffPath = null,
    dirtyIds = new Set(),
    onopen,
    onnew,
    onnewfolder,
    onopenfolder,
    onopenproject,
    onreveal,
    onaddfiles,
    onrenamefile,
    ondeletefile,
    onsetmain,
    onmovefile,
    onmovefolder,
    onrenamefolder,
    ondeletefolder,
    onnewfilein,
    onnewfolderin,
    ondownloadfile,
    ondownloadfolder,
    ongotoline,
    onregistershell,
    searchResults = [],
    searchActive = 0,
    onsearch,
    ongotoresult,
    onsearchnext,
    onsearchprev,
    onreplacecurrent,
    onreplaceall,
  }: {
    view?: ActivityView;
    files?: FileMeta[];
    /** Extra (possibly empty) folder paths to show in the tree, forward-slashed. */
    folders?: string[];
    activeId?: string;
    /** Absolute path / id of the project's main (compile-target) file. */
    mainId?: string | null;
    projectName?: string;
    /** Whether a folder-based project host is available (enables Open Folder). */
    hasProject?: boolean;
    widthPx?: number;
    /** Active file's text — drives the Outline (sectioning) view. */
    source?: string;
    engine?: EngineManager;
    /** Host-injected Git backend. Enables the Source Control view. */
    git?: GitProvider;
    /** Repository root the Git backend operates on — the open folder on desktop,
     *  a virtual working-tree path on web. */
    gitRoot?: string | null;
    /** Open a changed file's diff in the editor pane (Source Control click). */
    onopendiff?: (path: string, staged: boolean) => void;
    /** Path currently shown in the editor's diff view, to highlight its row. */
    activeDiffPath?: string | null;
    /** Ids of files with unsaved edits (shown as "modified" dots in the tree). */
    dirtyIds?: Set<string>;
    onopen?: (id: string) => void;
    onnew?: () => void;
    onnewfolder?: () => void;
    onopenfolder?: () => void;
    /** Switch to another document (web routes to its list). Absent hides the item. */
    onopenproject?: () => void;
    /** Reveal the open project folder in the OS file manager. Absent = unavailable. */
    onreveal?: () => void;
    /** Import files from disk into the open document (web projects). */
    onaddfiles?: (accept: string) => void;
    onrenamefile?: (id: string, name: string) => void;
    ondeletefile?: (id: string) => void;
    onsetmain?: (id: string) => void;
    /** Move a file into `targetDir` ('' = root). */
    onmovefile?: (id: string, targetDir: string) => void;
    /** Move a folder into `targetDir` ('' = root). */
    onmovefolder?: (path: string, targetDir: string) => void;
    /** Rename a folder — receives the new leaf name. */
    onrenamefolder?: (path: string, name: string) => void;
    ondeletefolder?: (path: string) => void;
    /** Create a new file inside `dir`. */
    onnewfilein?: (dir: string) => void;
    /** Create a new subfolder inside `dir`. */
    onnewfolderin?: (dir: string) => void;
    /** Save one file to disk. Omitted hides the Explorer's Download item. */
    ondownloadfile?: (id: string) => void;
    /** Save a folder as a .zip. Omitted hides the Explorer's Download item. */
    ondownloadfolder?: (path: string) => void;
    /** Jump the editor to a 1-based line (Outline click). */
    ongotoline?: (line: number) => void;
    /** Register the OS "Open with GlyphTeX" folder integration (desktop). */
    onregistershell?: () => void | Promise<boolean>;
    searchResults?: SearchMatch[];
    searchActive?: number;
    onsearch?: (o: SearchOptions) => void;
    ongotoresult?: (i: number) => void;
    onsearchnext?: () => void;
    onsearchprev?: () => void;
    onreplacecurrent?: (replace: string) => void;
    onreplaceall?: (replace: string) => void;
  } = $props();

  // The store reads the live props through getters and wraps the host callbacks.
  // svelte-ignore state_referenced_locally
  const store = new SidePanelStore({
    getView: () => view,
    getFiles: () => files,
    getFolders: () => folders,
    getActiveId: () => activeId,
    getSource: () => source,
    getProjectName: () => projectName,
    onopen,
    onnew,
    onnewfolder,
    onnewfilein,
    onnewfolderin,
    ondeletefile,
    ondeletefolder,
    onmovefile,
    onmovefolder,
    onsearch,
    onregistershell,
  });
</script>

<aside
  class="bg-card border-border flex h-full min-h-0 shrink-0 flex-col {settings.sidebarPosition ===
  'right'
    ? 'border-l'
    : 'border-r'}"
  style:width={`${widthPx}px`}
  aria-label={store.heading}
>
  <PanelHeader
    {store}
    {view}
    {hasProject}
    hasNewFolder={Boolean(onnewfolder || onnewfolderin)}
    hasDelete={Boolean(ondeletefile || ondeletefolder)}
    gitReady={Boolean(git && gitRoot)}
    searchResultCount={searchResults.length}
    {onreveal}
    {onopenfolder}
    {onopenproject}
    {onaddfiles}
  />

  <div
    class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1.5 pb-2 text-sm"
  >
    {#if view === "files"}
      <ExplorerView
        {store}
        {projectName}
        {activeId}
        {mainId}
        {dirtyIds}
        {hasProject}
        {onrenamefile}
        {ondeletefile}
        {onsetmain}
        {onmovefile}
        {onmovefolder}
        {onrenamefolder}
        {ondeletefolder}
        {ondownloadfile}
        {ondownloadfolder}
      />
    {:else if view === "outline"}
      <OutlineView {store} {ongotoline} />
    {:else if view === "search"}
      <SearchView
        {store}
        {searchResults}
        {searchActive}
        {onsearchnext}
        {onsearchprev}
        {ongotoresult}
        {onreplacecurrent}
        {onreplaceall}
      />
    {:else if view === "git"}
      {#if git}
        <GitPanel
          {git}
          root={gitRoot}
          refreshKey={store.gitRefreshKey}
          onstatechange={(s) => (store.gitState = s)}
          {onopendiff}
          {activeDiffPath}
        />
      {:else}
        <div
          class="text-muted-foreground flex flex-col items-center gap-2 px-2 py-8 text-center text-xs"
        >
          <IconGitBranch size={22} />
          <p>Source control isn't available here.</p>
        </div>
      {/if}
    {:else}
      <SettingsView
        {store}
        {engine}
        hasShellIntegration={Boolean(onregistershell)}
      />
    {/if}
  </div>
</aside>
