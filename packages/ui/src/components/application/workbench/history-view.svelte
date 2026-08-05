<script lang="ts">
  import { IconGitCommit } from "@tabler/icons-svelte";

  import type { GitCommitEntry, GitProvider } from "../git-panel.svelte";
  import { relativeTime } from "./notes.svelte";

  /** Recent commits, for the dock. Source Control (in the rail) owns staging and
   *  remotes; this is the read-only "what happened lately" view. */
  let {
    git,
    root,
    refreshKey = 0,
  }: { git?: GitProvider; root?: string | null; refreshKey?: number } = $props();

  let commits = $state<GitCommitEntry[] | null>(null);
  let unavailable = $state(false);

  $effect(() => {
    void refreshKey;
    const provider = git;
    const scmRoot = root;
    if (!provider || !scmRoot) {
      unavailable = true;
      commits = null;
      return;
    }
    let stale = false;
    void (async () => {
      try {
        const isRepo = await provider.isRepo(scmRoot);
        if (stale) return;
        unavailable = !isRepo;
        commits = isRepo ? await provider.log(scmRoot, 20) : null;
      } catch {
        if (stale) return;
        unavailable = true;
        commits = null;
      }
    })();
    return () => {
      stale = true;
    };
  });
</script>

{#if unavailable}
  <p class="text-muted-foreground px-3 py-6 text-center text-xs">
    This document isn’t a Git repository yet.
  </p>
{:else if commits === null}
  <p class="text-muted-foreground px-3 py-6 text-center text-xs">Reading history…</p>
{:else if commits.length === 0}
  <p class="text-muted-foreground px-3 py-6 text-center text-xs">No commits yet.</p>
{:else}
  <ul class="py-1">
    {#each commits as commit (commit.hash)}
      <li
        class="hover:bg-muted/60 flex items-baseline gap-2 px-3 py-1.5 transition-colors"
      >
        <IconGitCommit size={13} class="text-muted-foreground shrink-0 self-center" />
        <code class="text-faint shrink-0 font-mono text-xs">
          {commit.hash.slice(0, 7)}
        </code>
        <span class="text-foreground/90 min-w-0 flex-1 truncate text-xs">
          {commit.summary}
        </span>
        <span class="text-faint hidden shrink-0 text-xs sm:inline">{commit.author}</span>
        <span class="text-faint shrink-0 text-xs">
          {relativeTime(commit.time * 1000)}
        </span>
      </li>
    {/each}
  </ul>
{/if}
