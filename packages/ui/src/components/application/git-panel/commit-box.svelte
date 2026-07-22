<script lang="ts">
  import { Button } from "@glyphx/ui/button";
  import { Textarea } from "@glyphx/ui/textarea";
  import {
    IconArrowDown,
    IconArrowUp,
    IconGitCommit,
    IconRefresh,
  } from '@tabler/icons-svelte';

  import type { GitPanelStore } from "./store.svelte";

  /**
   * Commit box + smart primary action. While there are changes (or a merge is
   * underway) it's a commit message + Commit button; once the tree is clean it
   * becomes Push / Pull / Sync if local and remote have diverged.
   */
  let { store }: { store: GitPanelStore } = $props();
</script>

{#if store.hasChanges || store.head?.merging}
  <Textarea
    bind:value={store.message}
    placeholder={store.head?.merging
      ? "Merge commit message (optional)"
      : "Commit message"}
    rows={2}
    class="resize-none text-xs"
  />
  <Button size="sm" disabled={!store.canCommit} onclick={() => store.commit()}>
    <IconGitCommit size={14} />
    {#if store.busy}
      Committing…
    {:else if store.head?.merging}
      Commit Merge
    {:else}
      Commit{store.staged.length ? ` ${store.staged.length}` : ""}
    {/if}
  </Button>
{:else if store.syncAction === "push"}
  <Button size="sm" disabled={store.busy} onclick={() => store.runPrimarySync()}>
    <IconArrowUp size={14} />
    {store.busy ? "Pushing…" : `Push${store.head?.ahead ? ` ${store.head.ahead}` : ""}`}
  </Button>
{:else if store.syncAction === "pull"}
  <Button size="sm" disabled={store.busy} onclick={() => store.runPrimarySync()}>
    <IconArrowDown size={14} />
    {store.busy
      ? "Pulling…"
      : `Pull${store.head?.behind ? ` ${store.head.behind}` : ""}`}
  </Button>
{:else if store.syncAction === "sync"}
  <Button size="sm" disabled={store.busy} onclick={() => store.runPrimarySync()}>
    <IconRefresh size={14} />
    {store.busy ? "Syncing…" : "Sync Changes"}
  </Button>
{:else}
  <p class="text-muted-foreground/70 px-0.5 py-1 text-center text-xs">
    {store.head?.unborn
      ? "No commits yet."
      : "Nothing to commit — working tree clean."}
  </p>
{/if}
