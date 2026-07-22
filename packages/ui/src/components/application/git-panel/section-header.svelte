<script lang="ts">
  import { IconChevronRight } from '@tabler/icons-svelte';

  import type { GitPanelStore } from "./store.svelte";
  import type { SectionKey } from "./types";

  /**
   * Collapsible section header (chevron + uppercase title), like the Explorer's
   * Files / Outline headers. Action buttons sit beside it as siblings in the
   * parent's flex row.
   */
  let {
    store,
    title,
    sectionKey,
    count = null,
  }: {
    store: GitPanelStore;
    title: string;
    sectionKey: SectionKey;
    count?: number | null;
  } = $props();
</script>

<button
  class="text-faint hover:text-foreground flex min-w-0 flex-1 items-center gap-1 rounded text-xs font-semibold tracking-wide uppercase transition-colors"
  aria-expanded={store.sections[sectionKey]}
  onclick={() => store.toggleSection(sectionKey)}
>
  <IconChevronRight
    size={12}
    class="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] {store
      .sections[sectionKey]
      ? 'rotate-90'
      : ''}"
  />
  <span class="truncate">{title}{count != null ? ` (${count})` : ""}</span>
</button>
