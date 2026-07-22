<script lang="ts">
  import { Button } from "@glyphtex/ui/button";
  import { settings } from "@glyphtex/ui/settings";
  import {
    IconArrowBackUp,
    IconChevronRight,
    IconFileText,
    IconFolder,
    IconFolderOpen,
    IconMinus,
    IconPlus,
  } from '@tabler/icons-svelte';
  import { cubicOut } from "svelte/easing";
  import { slide } from "svelte/transition";

  import type { GitPanelStore } from "./store.svelte";
  import { indent, leaf } from "./tree";
  import {
    STATUS_CLASS,
    STATUS_LABEL,
    type GitChange,
    type TreeNode,
  } from "./types";

  /**
   * One changes section's file list — either a flat list or a nested folder
   * tree (per `settings.gitView`). Each row opens the file's diff and offers
   * stage/unstage (and discard, when staging unstaged changes).
   */
  let {
    store,
    items,
    nodes,
    action,
    activeDiffPath = null,
  }: {
    store: GitPanelStore;
    items: GitChange[];
    nodes: TreeNode[];
    action: "stage" | "unstage";
    activeDiffPath?: string | null;
  } = $props();
</script>

{#snippet fileRow(c: GitChange, label: string, depth: number, tree: boolean)}
  {const open = activeDiffPath === c.path}
  <div
    class="hover:bg-muted/60 group flex items-center gap-1 rounded py-0.5 pr-1 text-xs {open
      ? 'bg-accent/60'
      : ''}"
    style:padding-left={tree ? indent(depth) : "4px"}
  >
    <button
      class="text-foreground/90 hover:text-foreground flex min-w-0 flex-1 items-center gap-1 text-left {open
        ? 'font-medium'
        : ''}"
      title="Open diff — {c.path}"
      onclick={() => store.showDiff(c)}
    >
      {#if tree}
        <span class="w-[13px] shrink-0"></span>
        <IconFileText size={14} class="text-muted-foreground shrink-0" />
      {/if}
      <span class="truncate">{label}</span>
    </button>
    {#if action === "stage"}
      <Button
        variant="ghost"
        size="icon-xs"
        class="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
        title="Discard changes"
        aria-label="Discard changes"
        disabled={store.busy}
        onclick={() => store.discard([c.path])}
      >
        <IconArrowBackUp size={13} />
      </Button>
    {/if}
    <Button
      variant="ghost"
      size="icon-xs"
      class="opacity-0 group-hover:opacity-100"
      title={action === "stage" ? "Stage" : "Unstage"}
      aria-label={action === "stage" ? "Stage" : "Unstage"}
      disabled={store.busy}
      onclick={() =>
        action === "stage" ? store.stage([c.path]) : store.unstage([c.path])}
    >
      {#if action === "stage"}<IconPlus size={13} />{:else}<IconMinus
          size={13}
        />{/if}
    </Button>
    <span class="shrink-0 font-mono text-xs {STATUS_CLASS[c.status] ?? ''}">
      {STATUS_LABEL[c.status] ?? "?"}
    </span>
  </div>
{/snippet}

{#snippet treeView(treeNodes: TreeNode[], depth: number)}
  {#each treeNodes as n (n.path)}
    {#if n.isFile && n.change}
      {@render fileRow(n.change, n.name, depth, true)}
    {:else if !n.isFile}
      {const expanded = !store.collapsed.has(n.path)}
      <button
        class="hover:bg-muted hover:text-foreground text-muted-foreground flex w-full items-center gap-1 rounded py-0.5 pr-1 text-left text-xs transition-colors"
        style:padding-left={indent(depth)}
        aria-expanded={expanded}
        onclick={() => store.toggleFolder(n.path)}
        title={n.path}
      >
        <IconChevronRight
          size={13}
          class="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] {expanded
            ? 'rotate-90'
            : ''}"
        />
        {#if expanded}<IconFolderOpen
            size={14}
            class="text-muted-foreground shrink-0"
          />{:else}<IconFolder
            size={14}
            class="text-muted-foreground shrink-0"
          />{/if}
        <span class="truncate">{n.name}</span>
      </button>
      {#if expanded}
        <div transition:slide={{ duration: 200, easing: cubicOut }}>
          {@render treeView(n.children, depth + 1)}
        </div>
      {/if}
    {/if}
  {/each}
{/snippet}

{#if settings.gitView === "tree"}
  {@render treeView(nodes, 0)}
{:else}
  {#each items as c (c.path)}
    {@render fileRow(c, leaf(c.path), 0, false)}
  {/each}
{/if}
