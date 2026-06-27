<script lang="ts">
  import { settings } from "@glyphx/ui/settings";
  import {
    IconFilePlus,
    IconFold,
    IconFolderOpen,
    IconFolderPlus,
    IconFolderShare,
    IconFolders,
    IconList,
    IconRefresh,
    IconSearchOff,
    IconTrash,
  } from "@tabler/icons-svelte";

  import type { ActivityView } from "../activity-bar.svelte";
  import type { SidePanelStore } from "./store.svelte";

  /**
   * Side-panel header — the heading plus the active view's action buttons
   * (Explorer: new file/folder, delete, collapse, reveal/open; Search: refresh,
   * clear, collapse; Source Control: view toggle + refresh).
   */
  let {
    store,
    view,
    hasProject,
    hasNewFolder,
    hasDelete,
    gitReady,
    searchResultCount,
    onreveal,
    onopenfolder,
  }: {
    store: SidePanelStore;
    view: ActivityView;
    hasProject: boolean;
    hasNewFolder: boolean;
    hasDelete: boolean;
    gitReady: boolean;
    searchResultCount: number;
    onreveal?: () => void;
    onopenfolder?: () => void;
  } = $props();

  const btn =
    "hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors";
</script>

<div
  class="text-muted-foreground flex h-9 shrink-0 items-center justify-between px-3 text-xs font-medium tracking-wider uppercase"
>
  <span>{store.heading}</span>
  {#if view === "files"}
    <div class="-mr-1 flex items-center gap-0.5">
      <button
        class={btn}
        title={store.targetDir ? `New file in ${store.targetDir}` : "New file"}
        aria-label="New file"
        onclick={() => store.createFileHere()}
      >
        <IconFilePlus size={15} />
      </button>
      {#if hasNewFolder}
        <button
          class={btn}
          title={store.targetDir
            ? `New folder in ${store.targetDir}`
            : "New folder"}
          aria-label="New folder"
          onclick={() => store.createFolderHere()}
        >
          <IconFolderPlus size={15} />
        </button>
      {/if}
      {#if hasDelete}
        <button
          class="{btn} disabled:opacity-40"
          title={store.effectiveSel
            ? store.effectiveSel.type === "folder"
              ? "Delete selected folder"
              : "Delete selected file"
            : "Delete"}
          aria-label="Delete selected"
          disabled={!store.effectiveSel}
          onclick={() => store.deleteSelected()}
        >
          <IconTrash size={15} />
        </button>
      {/if}
      {#if store.folderPaths.length}
        <button
          class={btn}
          title={store.anyFolderOpen
            ? "Collapse all folders"
            : "Expand all folders"}
          aria-label={store.anyFolderOpen
            ? "Collapse all folders"
            : "Expand all folders"}
          onclick={() => store.toggleCollapseAll()}
        >
          <IconFold size={15} />
        </button>
      {/if}
      {#if onreveal}
        <!-- A project is open: reveal it in the OS file manager. -->
        <button
          class={btn}
          title="Reveal in file explorer"
          aria-label="Reveal in file explorer"
          onclick={() => onreveal?.()}
        >
          <IconFolderShare size={15} />
        </button>
      {:else if hasProject}
        <button
          class={btn}
          title="Open folder (⌘/Ctrl+O)"
          aria-label="Open folder"
          onclick={() => onopenfolder?.()}
        >
          <IconFolderOpen size={15} />
        </button>
      {/if}
    </div>
  {:else if view === "search"}
    <div class="-mr-1 flex items-center gap-0.5">
      <button
        class="{btn} disabled:opacity-40"
        title="Refresh results"
        aria-label="Refresh results"
        disabled={!store.query}
        onclick={() => store.refreshResults()}
      >
        <IconRefresh size={15} />
      </button>
      <button
        class="{btn} disabled:opacity-40"
        title="Clear search"
        aria-label="Clear search"
        disabled={!store.query}
        onclick={() => store.clearSearchView()}
      >
        <IconSearchOff size={15} />
      </button>
      <button
        class="{btn} disabled:opacity-40"
        title={store.resultsCollapsed ? "Expand results" : "Collapse results"}
        aria-label={store.resultsCollapsed
          ? "Expand results"
          : "Collapse results"}
        aria-pressed={store.resultsCollapsed}
        disabled={!searchResultCount}
        onclick={() => (store.resultsCollapsed = !store.resultsCollapsed)}
      >
        <IconFold size={15} />
      </button>
    </div>
  {:else if view === "git" && gitReady && store.gitState.isRepo}
    <div class="-mr-1 flex items-center gap-0.5">
      <button
        class={btn}
        title={settings.gitView === "tree" ? "View as list" : "View as tree"}
        aria-label={settings.gitView === "tree" ? "View as list" : "View as tree"}
        onclick={() =>
          (settings.gitView = settings.gitView === "tree" ? "list" : "tree")}
      >
        {#if settings.gitView === "tree"}<IconList size={15} />{:else}<IconFolders
            size={15}
          />{/if}
      </button>
      <button
        class="{btn} disabled:opacity-40"
        title="Refresh"
        aria-label="Refresh"
        disabled={store.gitState.loading}
        onclick={() => (store.gitRefreshKey += 1)}
      >
        <IconRefresh size={15} />
      </button>
    </div>
  {/if}
</div>
