<script lang="ts">
  import { toast } from "@glyphtex/ui/sonner";
  import {
    IconAlertTriangleFilled,
    IconBug,
    IconBulb,
    IconClipboardCheck,
    IconClipboardText,
    IconInfoCircle,
    IconX,
  } from "@tabler/icons-svelte";

  import { GLYPHTEX_REPO } from "../about-dialog.svelte";
  import BuildStats from "./build-stats.svelte";
  import type { WorkbenchController } from "./controller.svelte";
  import HistoryView from "./history-view.svelte";
  import type { DockTab } from "./types";

  /**
   * The bottom dock: parsed **Problems**, the raw compile **Log**, and recent
   * **History**, with the build-stats card pinned to the right. Errors stay
   * visible even while the last good PDF is still shown.
   */
  let { ctrl }: { ctrl: WorkbenchController } = $props();

  const files = $derived(ctrl.files);
  const layout = $derived(ctrl.layout);
  const compile = $derived(ctrl.compile);

  const gitReady = $derived(Boolean(files.git && files.scmRoot));
  const { errors, warnings } = $derived(compile.problemSummary);

  const tabs = $derived(
    [
      { id: "problems" as const, label: "Problems" },
      { id: "logs" as const, label: "Log" },
      ...(gitReady ? [{ id: "history" as const, label: "History" }] : []),
    ] satisfies { id: DockTab; label: string }[],
  );

  let copied = $state(false);

  // No log or file contents go in the URL — a compile log carries the document's
  // own text. The user copies and pastes what they choose to share.
  const ISSUES_URL = `${GLYPHTEX_REPO}/issues`;

  async function copyLog(): Promise<void> {
    if (!compile.compileLog) return;
    try {
      await navigator.clipboard.writeText(compile.compileLog);
      copied = true;
      toast.success("Log copied to clipboard");
      setTimeout(() => (copied = false), 1500);
    } catch {
      toast.error("Could not copy — clipboard blocked");
    }
  }
</script>

<section class="bg-card flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Panel">
  <div class="border-border flex h-8 shrink-0 items-center gap-1 border-b px-2">
    {#each tabs as tab (tab.id)}
      {@const active = layout.dockTab === tab.id}
      <button
        class="rounded px-2 py-1 text-xs font-medium transition-colors {active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:text-foreground'}"
        aria-pressed={active}
        onclick={() => (layout.dockTab = tab.id)}
      >
        {tab.label}
        {#if tab.id === "problems" && (errors || warnings)}
          <span class="ml-1 tabular-nums">
            {#if errors}<span class="text-destructive">{errors}</span>{/if}{#if errors && warnings}<span
                class="text-faint">/</span
              >{/if}{#if warnings}<span class="text-warning">{warnings}</span>{/if}
          </span>
        {/if}
      </button>
    {/each}

    <div class="ml-auto flex items-center gap-0.5">
      <a
        class="text-muted-foreground hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
        href={ISSUES_URL}
        target="_blank"
        rel="noreferrer noopener"
        title="Report an issue on GitHub"
        aria-label="Report an issue on GitHub"
      >
        <IconBug size={15} />
      </a>
      <button
        class="hover:bg-muted grid size-6 place-items-center rounded transition-colors {copied
          ? 'text-success'
          : 'text-muted-foreground hover:text-foreground'}"
        title="Copy raw log"
        aria-label="Copy raw log"
        disabled={!compile.compileLog}
        onclick={copyLog}
      >
        {#if copied}
          <IconClipboardCheck size={15} />
        {:else}
          <IconClipboardText size={15} />
        {/if}
      </button>
      <button
        class="text-muted-foreground hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
        title="Close panel"
        aria-label="Close panel"
        onclick={() => (compile.showProblems = false)}
      >
        <IconX size={15} />
      </button>
    </div>
  </div>

  <div class="flex min-h-0 flex-1 gap-3 p-2">
    <div class="min-w-0 flex-1 overflow-auto">
      {#if compile.compileHint}
        <!-- Actionable engine hint (biber/biblatex skew, 0-DPI JPEG…), shown on
             every tab because it explains the whole build, not one problem. -->
        <div
          class="border-primary/30 bg-primary/5 mb-2 flex items-start gap-2 rounded-md border p-2.5"
          role="status"
        >
          <IconBulb size={15} class="text-primary mt-0.5 shrink-0" />
          <p class="text-foreground/90 min-w-0 flex-1 text-xs leading-relaxed">
            {compile.compileHint}
          </p>
        </div>
      {/if}

      {#if layout.dockTab === "problems"}
        {#if compile.problems.length === 0}
          <p class="text-muted-foreground px-3 py-6 text-center text-xs">
            No problems reported.
          </p>
        {:else}
          <ul>
            {#each compile.problems as problem, i (i)}
              <li>
                <button
                  class="hover:bg-muted/60 flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors disabled:cursor-default"
                  disabled={problem.line == null}
                  title={problem.line != null ? `Go to line ${problem.line}` : undefined}
                  onclick={() => {
                    if (problem.line == null) return;
                    layout.editor?.goToLine(problem.line);
                    if (layout.viewMode === "preview") layout.viewMode = "split";
                  }}
                >
                  <span class="mt-0.5 shrink-0">
                    {#if problem.severity === "info"}
                      <IconInfoCircle size={14} class="text-muted-foreground" />
                    {:else}
                      <IconAlertTriangleFilled
                        size={14}
                        class={problem.severity === "error"
                          ? "text-destructive"
                          : "text-warning"}
                      />
                    {/if}
                  </span>
                  {#if problem.line != null}
                    <span
                      class="bg-muted text-muted-foreground mt-px shrink-0 rounded px-1 font-mono text-xs tabular-nums"
                    >
                      L{problem.line}
                    </span>
                  {/if}
                  <span
                    class="text-foreground/90 min-w-0 flex-1 font-mono text-xs leading-relaxed break-words"
                  >
                    {problem.message}
                  </span>
                </button>
              </li>
            {/each}
          </ul>

          {#if errors}
            <!-- Offered where the failure is, not buried in a help menu. -->
            <p
              class="border-border/60 text-muted-foreground mt-1 border-t px-2 py-2 text-xs leading-relaxed"
            >
              Think this is a bug in GlyphTeX rather than your document?
              <a
                class="text-brand font-medium hover:underline"
                href={ISSUES_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                Report it on GitHub
              </a>
              — copy the log first so you can paste it in.
            </p>
          {/if}
        {/if}
      {:else if layout.dockTab === "logs"}
        {#if compile.compileLog.trim()}
          <pre
            class="text-muted-foreground px-2 py-1 font-mono text-xs leading-relaxed whitespace-pre-wrap">{compile.compileLog}</pre>
        {:else}
          <p class="text-muted-foreground px-3 py-6 text-center text-xs">
            No log output yet.
          </p>
        {/if}
      {:else}
        <HistoryView git={files.git} root={files.scmRoot} refreshKey={files.savedTick} />
      {/if}
    </div>

    <BuildStats {compile} note={ctrl.statusNote} />
  </div>
</section>
