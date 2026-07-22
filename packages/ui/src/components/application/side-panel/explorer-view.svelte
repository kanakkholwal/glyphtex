<script lang="ts">
  import { IconChevronRight } from '@tabler/icons-svelte';
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
    gitStatus,
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
    gitStatus: Record<string, string>;
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

<!-- Root header doubles as a drop target: dropping here moves items to the top level. -->
<button
  class="text-foreground flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold tracking-wide uppercase transition-colors {store.rootDragOver
    ? 'bg-brand-subtle ring-brand/40 ring-1 ring-inset'
    : 'hover:bg-muted/60'}"
  aria-expanded={store.rootExpanded}
  ondragover={(e) => store.rootDragOverHandler(e)}
  ondragleave={() => (store.rootDragOver = false)}
  ondrop={(e) => store.rootDrop(e)}
  onclick={() => (store.rootExpanded = !store.rootExpanded)}
>
  <IconChevronRight
    size={13}
    class="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] {store.rootExpanded
      ? 'rotate-90'
      : ''}"
  />
  <span class="truncate">{projectName}</span>
</button>
{#if store.rootExpanded}
  <div transition:slide={{ duration: 200, easing: cubicOut }}>
    <FileTree
      nodes={store.rootNodes}
      {activeId}
      {mainId}
      {dirtyIds}
      {gitStatus}
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

