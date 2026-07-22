<script lang="ts">
  import { IconList } from '@tabler/icons-svelte';

  import type { SidePanelStore } from "./store.svelte";

  let {
    store,
    ongotoline,
  }: { store: SidePanelStore; ongotoline?: (line: number) => void } = $props();
</script>

{#if store.outline.length}
  <ul class="flex flex-col py-1">
    {#each store.outline as item, i (i)}
      <li>
        <button
          class="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left transition-colors"
          style:padding-left={`${(item.level - store.outlineBase) * 14 + 10}px`}
          title={item.title}
          onclick={() => ongotoline?.(item.line)}
        >
          <span class="bg-muted-foreground/40 size-1 shrink-0 rounded-full"></span>
          <span class="truncate text-[13px]">{item.title}</span>
        </button>
      </li>
    {/each}
  </ul>
{:else}
  <div class="text-muted-foreground/70 flex flex-col items-center gap-2 px-3 py-10 text-center">
    <IconList size={26} class="opacity-50" />
    <p class="text-xs">No sections yet.</p>
    <p class="text-[11px] leading-relaxed">
      Add <span class="font-mono">\section&#123;…&#125;</span> headings and they appear here.
    </p>
  </div>
{/if}
