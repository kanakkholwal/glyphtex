<script lang="ts">
  import { IconChevronDown, IconChevronUp, IconX } from '@tabler/icons-svelte';

  import {
    SEARCH_BTN,
    SEARCH_COUNT,
    SEARCH_INPUT,
    searchPill,
  } from "../search-ui";
  import type { PdfViewController } from "./controller.svelte";

  /** Find-in-PDF bar (matches the editor find bar); driven by the controller. */
  let { ctrl }: { ctrl: PdfViewController } = $props();
</script>

<div
  class="border-border bg-card shadow-craft-lg absolute top-3 right-3 z-20 flex items-center gap-1 rounded-lg border p-1.5"
  role="search"
>
  <!-- Find field with the Aa toggle inside it (matches the editor find bar). -->
  <div class="relative">
    <input
      bind:this={ctrl.findInputEl}
      bind:value={ctrl.findQuery}
      oninput={() => ctrl.onFindInput()}
      onkeydown={(e) => ctrl.onFindKeydown(e)}
      class="{SEARCH_INPUT} w-44 pr-7"
      placeholder="Find in PDF"
      aria-label="Find in PDF"
      spellcheck="false"
    />
    <div class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
      <button
        class={searchPill(ctrl.findCaseSensitive)}
        title="Match case"
        aria-label="Match case"
        aria-pressed={ctrl.findCaseSensitive}
        onclick={() => ctrl.toggleFindCase()}
      >
        Aa
      </button>
    </div>
  </div>
  <span class="{SEARCH_COUNT} w-16 text-center">
    {#if ctrl.findQuery && ctrl.findTotal}
      {ctrl.findCurrent} of {ctrl.findTotal}
    {:else if ctrl.findQuery}
      No results
    {/if}
  </span>
  <button
    class={SEARCH_BTN}
    title="Previous match (Shift+Enter)"
    aria-label="Previous match"
    disabled={!ctrl.findTotal}
    onclick={() => ctrl.findPrev()}
  >
    <IconChevronUp size={15} />
  </button>
  <button
    class={SEARCH_BTN}
    title="Next match (Enter)"
    aria-label="Next match"
    disabled={!ctrl.findTotal}
    onclick={() => ctrl.findNext()}
  >
    <IconChevronDown size={15} />
  </button>
  <button
    class={SEARCH_BTN}
    title="Close (Esc)"
    aria-label="Close find"
    onclick={() => ctrl.closeFind()}
  >
    <IconX size={15} />
  </button>
</div>
