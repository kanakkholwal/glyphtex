<script lang="ts">
  import { IconChevronRight, IconList } from "@tabler/icons-svelte";
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
    ongotoline,
    onrenamefile,
    ondeletefile,
    onsetmain,
    onmovefile,
    onmovefolder,
    onrenamefolder,
    ondeletefolder,
  }: {
    store: SidePanelStore;
    projectName: string;
    activeId: string;
    mainId: string | null;
    dirtyIds: Set<string>;
    gitStatus: Record<string, string>;
    hasProject: boolean;
    ongotoline?: (line: number) => void;
    onrenamefile?: (id: string, name: string) => void;
    ondeletefile?: (id: string) => void;
    onsetmain?: (id: string) => void;
    onmovefile?: (id: string, targetDir: string) => void;
    onmovefolder?: (path: string, targetDir: string) => void;
    onrenamefolder?: (path: string, name: string) => void;
    ondeletefolder?: (path: string) => void;
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
      onnewfilein={(dir) => store.newFileIn(dir)}
      onnewfolderin={(dir) => store.newFolderIn(dir)}
    />
  </div>
{/if}

<div class="border-border/60 mt-2 border-t pt-1.5">
  <button
    class="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold tracking-wide uppercase transition-colors"
    aria-expanded={store.outlineExpanded}
    onclick={() => (store.outlineExpanded = !store.outlineExpanded)}
  >
    <IconChevronRight
      size={13}
      class="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] {store.outlineExpanded
        ? 'rotate-90'
        : ''}"
    />
    <IconList size={14} class="shrink-0 opacity-70" />
    <span class="truncate">Outline</span>
  </button>
  {#if store.outlineExpanded}
    <div transition:slide={{ duration: 200, easing: cubicOut }}>
      {#if store.outline.length}
        <ul class="flex flex-col pb-1">
          {#each store.outline as item, i (i)}
            <li>
              <button
                class="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-1.5 rounded py-0.5 pr-2 text-left transition-colors"
                style:padding-left={`${(item.level - store.outlineBase) * 12 + 12}px`}
                title={item.title}
                onclick={() => ongotoline?.(item.line)}
              >
                <span class="bg-muted-foreground/30 size-1 shrink-0 rounded-full"
                ></span>
                <span class="truncate text-[13px]">{item.title}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="text-muted-foreground/60 px-3 py-1.5 text-[11px]">
          No sections found. Add <span class="font-mono">\section&#123;…&#125;</span
          > headings to build an outline.
        </p>
      {/if}
    </div>
  {/if}
</div>
