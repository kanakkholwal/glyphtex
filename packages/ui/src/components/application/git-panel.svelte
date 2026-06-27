<script lang="ts" module>
  // Public Source Control types kept stable for `@glyphx/ui/application` consumers.
  export type {
    GitChange,
    GitCommitEntry,
    GitHeadInfo,
    GitProvider,
    GitRemote,
  } from "./git-panel/types";
</script>

<script lang="ts">
  import { Button } from "@glyphx/ui/button";
  import {
    IconAlertTriangle,
    IconArrowDown,
    IconArrowUp,
    IconGitBranch,
  } from "@tabler/icons-svelte";
  import { cubicOut } from "svelte/easing";
  import { slide } from "svelte/transition";

  import ChangeTree from "./git-panel/change-tree.svelte";
  import CommitBox from "./git-panel/commit-box.svelte";
  import ErrorDialog from "./git-panel/error-dialog.svelte";
  import HistorySection from "./git-panel/history-section.svelte";
  import RemotesSection from "./git-panel/remotes-section.svelte";
  import SectionHeader from "./git-panel/section-header.svelte";
  import { GitPanelStore } from "./git-panel/store.svelte";
  import type { GitProvider } from "./git-panel/types";

  /**
   * Source Control — local version control for the open project folder. Stage /
   * unstage / discard working-tree changes against the real Git index, commit the
   * staged set, browse history, and manage remotes (add / edit / switch / remove,
   * fetch / pull / push). State + behaviour live in {@link GitPanelStore}; the
   * markup is split across `./git-panel/*`.
   */
  let {
    git,
    root,
    refreshKey = 0,
    onstatechange,
    onopendiff,
    activeDiffPath = null,
  }: {
    git?: GitProvider;
    root?: string | null;
    /** Bump from the parent (side-panel header refresh button) to force a re-fetch. */
    refreshKey?: number;
    /** Reports panel state up so the side-panel header can show/disable actions. */
    onstatechange?: (s: { isRepo: boolean; loading: boolean }) => void;
    /** Open a file's diff in the editor pane (host wires this to the diff view). */
    onopendiff?: (path: string, staged: boolean) => void;
    /** Path currently shown in the editor's diff view, to highlight its row. */
    activeDiffPath?: string | null;
  } = $props();

  // The store captures the initial (stable) host injections — `git` / `onopendiff`
  // don't change after mount; `root` is read live via the getter.
  // svelte-ignore state_referenced_locally
  const store = new GitPanelStore({
    git,
    getRoot: () => root,
    onopendiff,
  });

  // Reload whenever the open folder changes, or the header refresh is clicked.
  $effect(() => {
    void root;
    void refreshKey;
    store.refresh();
  });
  // Surface state to the side-panel header (which owns the action icons).
  $effect(() => {
    onstatechange?.({ isRepo: store.isRepo, loading: store.loading });
  });
  // Detect the system git once per provider.
  $effect(() => store.detectGitAvailable());
</script>

{#if !root}
  <div
    class="text-muted-foreground flex flex-col items-center gap-2 px-2 py-8 text-center text-xs"
  >
    <IconGitBranch size={22} />
    <p>Open a folder to use source control.</p>
  </div>
{:else if !store.isRepo}
  <div
    class="text-muted-foreground flex flex-col items-center gap-2 px-2 py-8 text-center text-xs"
  >
    <IconGitBranch size={22} />
    <p>This folder isn't a Git repository yet.</p>
    <Button
      variant="outline"
      size="sm"
      class="mt-1"
      disabled={store.busy}
      onclick={() => store.initRepo()}
    >
      {store.busy ? "Initializing…" : "Initialize repository"}
    </Button>
  </div>
{:else}
  <div class="flex flex-col gap-2 px-1">
    <!-- Branch + ahead/behind (panel chrome — refresh / view toggle live in the
         side-panel header, next to the "Source Control" heading). -->
    <div class="flex items-center gap-1.5 px-0.5">
      <IconGitBranch size={13} class="text-muted-foreground shrink-0" />
      <span class="text-foreground min-w-0 flex-1 truncate text-xs font-medium">
        {store.head?.branch ?? "HEAD"}{store.head?.unborn
          ? " (no commits yet)"
          : ""}
      </span>
      {#if store.head?.behind || store.head?.ahead}
        <span
          class="text-muted-foreground/80 flex shrink-0 items-center gap-0.5 text-[10px]"
          title={`${store.head?.ahead ?? 0} ahead, ${store.head?.behind ?? 0} behind ${store.head?.upstream ?? "upstream"}`}
        >
          {#if store.head?.behind}<IconArrowDown size={11} />{store.head
              .behind}{/if}
          {#if store.head?.ahead}<IconArrowUp size={11} />{store.head.ahead}{/if}
        </span>
      {/if}
    </div>

    <!-- Merge-in-progress banner -->
    {#if store.head?.merging}
      <div
        class="border-warning/40 bg-warning/10 text-warning flex items-start gap-1.5 rounded border px-2 py-1.5 text-[11px] leading-snug"
      >
        <IconAlertTriangle size={13} class="mt-px shrink-0" />
        <span>
          {store.hasConflicts
            ? "Merge has conflicts — resolve the marked files, stage them, then commit to finish."
            : "Merge in progress — commit to finish it."}
        </span>
      </div>
    {/if}

    <CommitBox {store} />

    {#if store.error}
      <p class="text-destructive px-0.5 text-[11px] leading-snug">{store.error}</p>
    {/if}

    <!-- Staged -->
    {#if store.staged.length}
      <div class="border-border/60 mt-1 border-t pt-1.5">
        <div class="flex items-center gap-0.5 px-0.5">
          <SectionHeader
            {store}
            title="Staged Changes"
            sectionKey="staged"
            count={store.staged.length}
          />
          <Button
            variant="ghost"
            size="xs"
            disabled={store.busy}
            onclick={() => store.unstage(store.staged.map((c) => c.path))}
          >
            Unstage all
          </Button>
        </div>
        {#if store.sections.staged}
          <div transition:slide={{ duration: 200, easing: cubicOut }} class="mt-0.5">
            <ChangeTree
              {store}
              items={store.staged}
              nodes={store.stagedTree}
              action="unstage"
              {activeDiffPath}
            />
          </div>
        {/if}
      </div>
    {/if}

    <!-- Changes (unstaged) -->
    <div class="border-border/60 mt-1 border-t pt-1.5">
      <div class="flex items-center gap-0.5 px-0.5">
        <SectionHeader
          {store}
          title="Changes"
          sectionKey="changes"
          count={store.unstaged.length || null}
        />
        {#if store.unstaged.length}
          <Button
            variant="ghost"
            size="xs"
            class="text-muted-foreground hover:text-destructive"
            title="Discard all changes"
            disabled={store.busy}
            onclick={() => store.discard(store.unstaged.map((c) => c.path))}
          >
            Discard all
          </Button>
          <Button
            variant="ghost"
            size="xs"
            disabled={store.busy}
            onclick={() => store.stage(store.unstaged.map((c) => c.path))}
          >
            Stage all
          </Button>
        {/if}
      </div>
      {#if store.sections.changes}
        <div transition:slide={{ duration: 200, easing: cubicOut }} class="mt-0.5">
          {#if !store.unstaged.length}
            <p class="text-muted-foreground/70 px-0.5 py-1 text-[11px]">
              {store.loading
                ? "Checking…"
                : store.staged.length
                  ? "Nothing else to stage."
                  : "No changes."}
            </p>
          {:else}
            <ChangeTree
              {store}
              items={store.unstaged}
              nodes={store.unstagedTree}
              action="stage"
              {activeDiffPath}
            />
          {/if}
        </div>
      {/if}
    </div>

    <RemotesSection {store} />

    <HistorySection {store} />
  </div>
{/if}

<ErrorDialog {store} />
