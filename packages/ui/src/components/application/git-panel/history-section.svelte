<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import { slide } from "svelte/transition";

  import SectionHeader from "./section-header.svelte";
  import type { GitPanelStore } from "./store.svelte";
  import { whenLabel } from "./tree";

  /** Commit history — recent commits (hash · summary · date). */
  let { store }: { store: GitPanelStore } = $props();
</script>

{#if store.commits.length}
  <div class="border-border/60 mt-1 border-t pt-1.5">
    <div class="flex items-center gap-0.5 px-0.5">
      <SectionHeader {store} title="History" sectionKey="history" />
    </div>
    {#if store.sections.history}
      <div
        transition:slide={{ duration: 200, easing: cubicOut }}
        class="mt-0.5 flex flex-col gap-0.5"
      >
        {#each store.commits as c (c.hash)}
          <div
            class="flex items-baseline gap-1.5 px-0.5 py-0.5 text-xs"
            title={c.author}
          >
            <span class="text-muted-foreground/70 shrink-0 font-mono text-[10px]"
              >{c.hash}</span
            >
            <span class="text-foreground/85 truncate">{c.summary}</span>
            <span class="text-muted-foreground/50 ml-auto shrink-0 text-[10px]"
              >{whenLabel(c.time)}</span
            >
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
