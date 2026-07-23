<script lang="ts">
  import { Button } from '@glyphtex/ui/button';
  import { IconChevronRight, IconFolder, IconPlus } from '@tabler/icons-svelte';
  import { cubicOut } from "svelte/easing";
  import { slide } from "svelte/transition";

  import FileTree from "../file-tree.svelte";
  import type { SidePanelStore } from "./store.svelte";

  let {
    store,
    projectName,
    activeId,
    mainId,
    dirtyIds,
    hasProject,
    onrenamefile,
    ondeletefile,
    onsetmain,
    onmovefile,
    onmovefolder,
    onrenamefolder,
    ondeletefolder,
    ondownloadfile,
    ondownloadfolder,
  }: {
    store: SidePanelStore;
    projectName: string;
    activeId: string;
    mainId: string | null;
    dirtyIds: Set<string>;
    hasProject: boolean;
    onrenamefile?: (id: string, name: string) => void;
    ondeletefile?: (id: string) => void;
    onsetmain?: (id: string) => void;
    onmovefile?: (id: string, targetDir: string) => void;
    onmovefolder?: (path: string, targetDir: string) => void;
    onrenamefolder?: (path: string, name: string) => void;
    ondeletefolder?: (path: string) => void;
    ondownloadfile?: (id: string) => void;
    ondownloadfolder?: (path: string) => void;
  } = $props();
</script>

{#if store.rootNodes.length > 0}
  <!-- Root header doubles as a drop target: dropping here moves items to the top level. -->
  <button
    class="text-faint flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold tracking-wide uppercase transition-colors {store.rootDragOver
      ? 'bg-brand-subtle ring-brand/40 ring-1 ring-inset'
      : 'hover:bg-muted/60'}"
    aria-expanded={store.rootExpanded}
    ondragover={(e) => store.rootDragOverHandler(e)}
    ondragleave={() => (store.rootDragOver = false)}
    ondrop={(e) => store.rootDrop(e)}
    onclick={() => (store.rootExpanded = !store.rootExpanded)}
  >
    <IconChevronRight
      size={14}
      class="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] {store.rootExpanded
        ? 'rotate-90'
        : ''}"
    />
    <span class="truncate">{projectName}</span>
  </button>
{/if}
{#if store.rootNodes.length === 0}
  <div class="flex flex-col items-center gap-3 px-4 py-10 text-center">
    <div class="text-faint">
      <IconFolder size={40} stroke={1.25} />
    </div>
    <div class="flex flex-col gap-1">
      <p class="text-foreground text-sm font-medium">No files yet</p>
      <p class="text-muted-foreground text-xs leading-relaxed">
        Create a new file or upload to get started.
      </p>
    </div>
    <Button size="sm" onclick={() => store.createFileHere()}>
      <IconPlus /> New file
    </Button>
  </div>
{:else if store.rootExpanded}
  <div transition:slide={{ duration: 200, easing: cubicOut }}>
    <FileTree
      nodes={store.rootNodes}
      {activeId}
      {mainId}
      {dirtyIds}
      selectedPath={store.selectedFolderPath}
      open={store.treeOpen}
      onopen={(id) => store.selectFile(id)}
      onselectfolder={(path) => store.selectFolder(path)}
      onrename={(id, name) => onrenamefile?.(id, name)}
      ondelete={(id) => ondeletefile?.(id)}
      onsetmain={(id) => onsetmain?.(id)}
      {onmovefile}
      {onmovefolder}
      {onrenamefolder}
      {ondeletefolder}
      {ondownloadfile}
      {ondownloadfolder}
      onnewfilein={(dir) => store.newFileIn(dir)}
      onnewfolderin={(dir) => store.newFolderIn(dir)}
    />
  </div>
{/if}

