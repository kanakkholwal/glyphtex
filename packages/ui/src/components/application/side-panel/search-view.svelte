<script lang="ts">
  import {
    IconChevronDown,
    IconChevronRight,
    IconChevronUp,
    IconFileText,
    IconReplace,
    IconReplaceFilled,
  } from '@tabler/icons-svelte';

  import {
    SEARCH_BTN,
    SEARCH_COUNT,
    SEARCH_INPUT,
    searchPill,
  } from "../search-ui";
  import type { SidePanelStore } from "./store.svelte";
  import type { SearchMatch } from "./types";

  /**
   * Search view — a full find/replace panel (toggles live inside the fields, VS
   * Code parity) plus the results list grouped under the active file.
   */
  let {
    store,
    searchResults,
    searchActive,
    onsearchnext,
    onsearchprev,
    ongotoresult,
    onreplacecurrent,
    onreplaceall,
  }: {
    store: SidePanelStore;
    searchResults: SearchMatch[];
    searchActive: number;
    onsearchnext?: () => void;
    onsearchprev?: () => void;
    ongotoresult?: (i: number) => void;
    onreplacecurrent?: (replace: string) => void;
    onreplaceall?: (replace: string) => void;
  } = $props();

  function onSearchKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) onsearchprev?.();
      else onsearchnext?.();
    }
  }

  // Autofocus the field when the Search view opens (e.g. via Ctrl/Cmd+F).
  $effect(() => {
    store.searchInputEl?.focus();
  });
</script>

<div class="flex flex-col gap-1 pt-0.5">
  <div class="flex items-start gap-0.5">
    <button
      class="{SEARCH_BTN} mt-0.5 shrink-0"
      title={store.showReplace ? "Hide replace" : "Toggle replace"}
      aria-label="Toggle replace"
      aria-expanded={store.showReplace}
      onclick={() => (store.showReplace = !store.showReplace)}
    >
      <IconChevronRight
        size={15}
        class="transition-transform duration-200 {store.showReplace
          ? 'rotate-90'
          : ''}"
      />
    </button>

    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <!-- Find — toggles live inside the field (VS Code parity) -->
      <div class="relative">
        <input
          bind:this={store.searchInputEl}
          bind:value={store.query}
          oninput={() => store.emitSearch()}
          onkeydown={onSearchKeydown}
          class="{SEARCH_INPUT} w-full pr-[4.75rem]"
          placeholder="Find"
          aria-label="Find in document"
          spellcheck="false"
        />
        <div
          class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5"
        >
          {#each store.findOptions as opt (opt.key)}
            <button
              class={searchPill(opt.on)}
              title={opt.title}
              aria-label={opt.title}
              aria-pressed={opt.on}
              onclick={opt.toggle}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Replace — preserve-case toggle lives inside the field (VS Code parity);
           replace / replace-all sit alongside it. -->
      {#if store.showReplace}
        <div class="flex items-center gap-1">
          <div class="relative min-w-0 flex-1">
            <input
              bind:value={store.replace}
              class="{SEARCH_INPUT} w-full pr-7"
              placeholder={store.useRegex ? "Replace ($1, $&…)" : "Replace"}
              aria-label="Replace with"
              spellcheck="false"
            />
            <div
              class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center"
            >
              <button
                class={searchPill(store.preserveCase)}
                title="Preserve case"
                aria-label="Preserve case"
                aria-pressed={store.preserveCase}
                onclick={() => store.togglePreserveCase()}
              >
                AB
              </button>
            </div>
          </div>
          <button
            class="{SEARCH_BTN} shrink-0"
            title="Replace next match"
            aria-label="Replace next match"
            disabled={!searchResults.length}
            onclick={() => onreplacecurrent?.(store.replace)}
          >
            <IconReplace size={15} />
          </button>
          <button
            class="{SEARCH_BTN} shrink-0"
            title="Replace all matches"
            aria-label="Replace all matches"
            disabled={!searchResults.length}
            onclick={() => onreplaceall?.(store.replace)}
          >
            <IconReplaceFilled size={15} />
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Results header: match count + navigation, attached to the list. -->
  {#if store.query}
    <div class="flex items-center gap-1 px-0.5">
      <span class={SEARCH_COUNT}>
        {#if searchResults.length}
          {searchActive + 1} of {searchResults.length}
        {:else}
          No results
        {/if}
      </span>
      <button
        class="{SEARCH_BTN} ml-auto"
        title="Previous match (Shift+Enter)"
        aria-label="Previous match"
        disabled={!searchResults.length}
        onclick={() => onsearchprev?.()}
      >
        <IconChevronUp size={15} />
      </button>
      <button
        class={SEARCH_BTN}
        title="Next match (Enter)"
        aria-label="Next match"
        disabled={!searchResults.length}
        onclick={() => onsearchnext?.()}
      >
        <IconChevronDown size={15} />
      </button>
    </div>
  {/if}

  <!-- Results — grouped under the active file, collapsible (VS Code parity). -->
  {#if store.query && searchResults.length}
    <div class="mt-1">
      <button
        class="text-muted-foreground hover:bg-muted/60 flex w-full items-center gap-1 rounded px-1 py-1 text-left transition-colors"
        aria-expanded={!store.resultsCollapsed}
        onclick={() => (store.resultsCollapsed = !store.resultsCollapsed)}
      >
        <IconChevronRight
          size={13}
          class="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] {store.resultsCollapsed
            ? ''
            : 'rotate-90'}"
        />
        <IconFileText size={14} class="shrink-0" />
        <span class="text-foreground truncate text-[13px] font-medium"
          >{store.activeFileName}</span
        >
      </button>
      {#if !store.resultsCollapsed}
        <ul class="flex flex-col">
          {#each searchResults.slice(0, 500) as m, i (i)}
            <li>
              <button
                class="flex w-full items-baseline gap-1.5 rounded py-0.5 pr-2 pl-6 text-left transition-colors {i ===
                searchActive
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted text-muted-foreground'}"
                onclick={() => ongotoresult?.(i)}
                title={`Line ${m.line}`}
              >
                <span
                  class="text-muted-foreground/50 w-7 shrink-0 text-right font-mono text-[10px] tabular-nums"
                >
                  {m.line}
                </span>
                <span class="truncate font-mono text-[11px]"
                  >{m.text.trim() || " "}</span
                >
              </button>
            </li>
          {/each}
        </ul>
        {#if searchResults.length > 500}
          <p class="text-muted-foreground/60 px-2 text-[11px]">
            Showing first 500 of {searchResults.length}.
          </p>
        {/if}
      {/if}
    </div>
  {:else if !store.query}
    <p class="text-muted-foreground/70 mt-1 px-1.5 text-[11px]">
      Find &amp; replace in the active file.
    </p>
  {/if}
</div>
