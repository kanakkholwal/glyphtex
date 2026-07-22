<script lang="ts">
  import { settings } from "@glyphx/ui/settings";
  import { IconAlertTriangle } from '@tabler/icons-svelte';

  import type { WorkbenchController } from "./controller.svelte";

  /**
   * Status bar — compile status + mode, unsaved count, engine, problems
   * summary, cursor position, and document metrics.
   */
  let { ctrl }: { ctrl: WorkbenchController } = $props();
  const files = $derived(ctrl.files);
  const layout = $derived(ctrl.layout);
  const compile = $derived(ctrl.compile);
</script>

<footer
  class="border-border bg-card text-muted-foreground flex h-7 shrink-0 items-center gap-3 border-t px-3 text-xs"
>
  <span
    class="flex items-center gap-1.5 {compile.compileStatus === 'error'
      ? 'text-destructive'
      : ''}"
  >
    <span
      class="size-1.5 rounded-full {compile.compileStatus === 'compiling'
        ? 'bg-primary animate-pulse'
        : compile.compileStatus === 'error'
          ? 'bg-destructive'
          : 'bg-success'}"
    ></span>
    {compile.compileLabel}
  </span>
  <span class="text-muted-foreground/50">·</span>
  <span
    title={!settings.autoCompile
      ? "Compile only when you press Compile"
      : settings.autoSave === "off"
        ? "Live compile is on, but auto save is off — the preview refreshes when you save (⌘/Ctrl+S)"
        : "Recompiles automatically when the file is saved"}
  >
    {!settings.autoCompile
      ? "Manual"
      : settings.autoSave === "off"
        ? "On save"
        : "Live"}
  </span>
  {#if files.dirtyIds.size > 0}
    <button
      class="text-brand inline-flex items-center gap-1 transition-opacity hover:opacity-80"
      title="Save all unsaved files (⌘/Ctrl+Shift+S)"
      onclick={() => void files.saveAll()}
    >
      <span class="bg-brand size-1.5 rounded-full"></span>
      <span class="tabular-nums">{files.dirtyIds.size} unsaved</span>
    </button>
  {/if}
  <span>LaTeX · Tectonic</span>
  <button
    class="inline-flex items-center gap-1 transition-colors hover:text-foreground {compile
      .problemSummary.errors
      ? 'text-destructive'
      : compile.problemSummary.warnings
        ? 'text-warning'
        : ''}"
    title="Toggle problems / log"
    aria-pressed={compile.showProblems}
    onclick={() => (compile.showProblems = !compile.showProblems)}
  >
    <IconAlertTriangle size={14} />
    <span class="tabular-nums"
      >{compile.problemSummary.errors}/{compile.problemSummary.warnings}</span
    >
  </button>
  <span class="text-muted-foreground/50 ml-auto"
    >Ln {layout.cursor.line}, Col {layout.cursor.column}</span
  >
  <span class="text-muted-foreground/50"
    >{files.lineCount} lines · {files.wordCount} words · {files.charCount} chars</span
  >
  {#if ctrl.statusNote}
    <span class="text-muted-foreground/50" title="In-browser LaTeX package server"
      >{ctrl.statusNote}</span
    >
  {/if}
  <span class="text-muted-foreground/50 capitalize">{ctrl.platform}</span>
</footer>
