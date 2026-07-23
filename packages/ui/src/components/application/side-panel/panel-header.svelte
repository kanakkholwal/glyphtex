<script lang="ts">
  import { Button } from "@glyphtex/ui/button";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@glyphtex/ui/dropdown-menu";
  import { settings } from "@glyphtex/ui/settings";
  import {
    IconDots,
    IconFilePlus,
    IconPhotoPlus,
    IconFold,
    IconFolderOpen,
    IconFolderPlus,
    IconFolderShare,
    IconFolders,
    IconList,
    IconRefresh,
    IconSearchOff,
    IconTrash,
  } from '@tabler/icons-svelte';

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
    onopenproject,
    onaddfiles,
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
    /** Switch to another document (web routes to its list). Absent hides the item. */
    onopenproject?: () => void;
    /** Import files from disk into the open document (web projects). */
    onaddfiles?: (accept: string) => void;
  } = $props();

</script>

<div
  class="text-foreground flex h-9 shrink-0 items-center justify-between px-3 text-sm font-medium"
>
  <span>{store.heading}</span>
  {#if view === "files"}
    <!-- One visible primary action; everything else lives under the overflow so
         the header doesn't become a five-icon toolbar. -->
    <div class="-mr-1 flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        title={store.targetDir ? `New file in ${store.targetDir}` : "New file"}
        aria-label="New file"
        onclick={() => store.createFileHere()}
      >
        <IconFilePlus />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger>
          {#snippet child({ props })}
            <Button
              {...props}
              variant="ghost"
              size="icon-sm"
              title="More"
              aria-label="More file actions"
            >
              <IconDots />
            </Button>
          {/snippet}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-52">
          {#if hasNewFolder}
            <DropdownMenuItem onSelect={() => store.createFolderHere()}>
              <IconFolderPlus class="text-muted-foreground" />
              {store.targetDir ? `New folder in ${store.targetDir}` : "New folder"}
            </DropdownMenuItem>
          {/if}
          {#if onaddfiles}
            <DropdownMenuItem onSelect={() => onaddfiles?.("")}>
              <IconFilePlus class="text-muted-foreground" /> Add files…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onaddfiles?.("image/*")}>
              <IconPhotoPlus class="text-muted-foreground" /> Add images…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          {/if}
          {#if store.folderPaths.length}
            <DropdownMenuItem onSelect={() => store.toggleCollapseAll()}>
              <IconFold class="text-muted-foreground" />
              {store.anyFolderOpen ? "Collapse all folders" : "Expand all folders"}
            </DropdownMenuItem>
          {/if}
          {#if onreveal}
            <DropdownMenuItem onSelect={() => onreveal?.()}>
              <IconFolderShare class="text-muted-foreground" /> Reveal in file explorer
            </DropdownMenuItem>
          {:else if onopenfolder}
            <DropdownMenuItem onSelect={() => onopenfolder?.()}>
              <IconFolderOpen class="text-muted-foreground" /> Open folder…
            </DropdownMenuItem>
          {/if}
          {#if onopenproject}
            <DropdownMenuItem onSelect={() => onopenproject?.()}>
              <IconFolders class="text-muted-foreground" /> Open project…
            </DropdownMenuItem>
          {/if}
          {#if hasDelete}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={!store.effectiveSel}
              onSelect={() => store.deleteSelected()}
            >
              <IconTrash />
              {store.effectiveSel?.type === "folder" ? "Delete folder" : "Delete file"}
            </DropdownMenuItem>
          {/if}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  {:else if view === "search"}
    <div class="-mr-1 flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        title="Refresh results"
        aria-label="Refresh results"
        disabled={!store.query}
        onclick={() => store.refreshResults()}
      >
        <IconRefresh />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Clear search"
        aria-label="Clear search"
        disabled={!store.query}
        onclick={() => store.clearSearchView()}
      >
        <IconSearchOff />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title={store.resultsCollapsed ? "Expand results" : "Collapse results"}
        aria-label={store.resultsCollapsed ? "Expand results" : "Collapse results"}
        aria-pressed={store.resultsCollapsed}
        disabled={!searchResultCount}
        onclick={() => (store.resultsCollapsed = !store.resultsCollapsed)}
      >
        <IconFold />
      </Button>
    </div>
  {:else if view === "git" && gitReady && store.gitState.isRepo}
    <div class="-mr-1 flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        title={settings.gitView === "tree" ? "View as list" : "View as tree"}
        aria-label={settings.gitView === "tree" ? "View as list" : "View as tree"}
        onclick={() => (settings.gitView = settings.gitView === "tree" ? "list" : "tree")}
      >
        {#if settings.gitView === "tree"}<IconList />{:else}<IconFolders />{/if}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Refresh"
        aria-label="Refresh"
        disabled={store.gitState.loading}
        onclick={() => (store.gitRefreshKey += 1)}
      >
        <IconRefresh />
      </Button>
    </div>
  {/if}
</div>
