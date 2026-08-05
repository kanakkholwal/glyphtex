<script lang="ts">
  import { Button } from "@glyphtex/ui/button";
  import { Tooltip, TooltipContent, TooltipTrigger } from "@glyphtex/ui/tooltip";
  import {
    IconEye,
    IconLayoutColumns,
    IconLayoutRows,
    IconPencil,
  } from "@tabler/icons-svelte";

  import type { LayoutStore } from "./layout.svelte";
  import type { ViewMode } from "./types";

  /** Segmented Editor / PDF / Split control, plus the split axis. A segmented
   *  control (not a select): three mutually exclusive states, all worth showing. */
  let { layout }: { layout: LayoutStore } = $props();

  const modes: { value: ViewMode; label: string; icon: typeof IconPencil }[] = [
    { value: "editor", label: "Editor", icon: IconPencil },
    { value: "preview", label: "PDF", icon: IconEye },
    { value: "split", label: "Split", icon: IconLayoutColumns },
  ];
</script>

<div class="flex shrink-0 items-center gap-1">
  <div
    class="bg-muted dark:bg-background/60 flex items-center gap-0.5 rounded-md p-0.5"
    role="group"
    aria-label="View mode"
  >
    {#each modes as mode (mode.value)}
      {@const active = layout.viewMode === mode.value}
      {@const Icon = mode.icon}
      <button
        class="flex h-6.5 cursor-pointer items-center gap-1.5 rounded-[6px] px-2 text-xs font-medium transition-colors {active
          ? 'bg-card text-foreground shadow-craft-sm dark:bg-card'
          : 'text-muted-foreground hover:text-foreground'}"
        aria-pressed={active}
        title={mode.label}
        onclick={() => (layout.viewMode = mode.value)}
      >
        <Icon class="size-3.5" />
        <span class="hidden xl:inline">{mode.label}</span>
      </button>
    {/each}
  </div>

  {#if layout.viewMode === "split"}
    {@const stacked = layout.splitDir === "vertical"}
    <Tooltip delayDuration={300}>
      <TooltipTrigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            size="icon-sm"
            aria-label={stacked ? "Stack side by side" : "Stack vertically"}
            onclick={() =>
              (layout.splitDir = stacked ? "horizontal" : "vertical")}
          >
            {#if stacked}<IconLayoutRows />{:else}<IconLayoutColumns />{/if}
          </Button>
        {/snippet}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {stacked ? "Stacked — switch to side by side" : "Side by side — switch to stacked"}
      </TooltipContent>
    </Tooltip>
  {/if}
</div>
