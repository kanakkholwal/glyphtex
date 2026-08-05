<script lang="ts">
  import { Button } from "@glyphtex/ui/button";
  import { ButtonGroup } from "@glyphtex/ui/button-group";
  import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuGroupHeading,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
  } from "@glyphtex/ui/dropdown-menu";
  import { settings } from "@glyphtex/ui/settings";
  import {
    IconAlertTriangleFilled,
    IconCheck,
    IconChevronDown,
    IconLoader2,
    IconPlayerPlayFilled,
    IconTargetArrow,
  } from "@tabler/icons-svelte";

  import ExportMenu from "../export-menu.svelte";
  import { shortcutLabel } from "../shortcuts";
  import type { WorkbenchController } from "./controller.svelte";
  import EditorTabs from "./editor-tabs.svelte";
  import type { SaveFileFn } from "./types";
  import ViewSwitch from "./view-switch.svelte";

  /** The one row above both panes: open files on the left, what to look at and
   *  what to build on the right. */
  let {
    ctrl,
    saveFile,
  }: { ctrl: WorkbenchController; saveFile?: SaveFileFn } = $props();

  const files = $derived(ctrl.files);
  const layout = $derived(ctrl.layout);
  const compile = $derived(ctrl.compile);

  // Candidate root files, so a multi-file document can pick which one compiles.
  const texFiles = $derived(files.files.filter((f) => f.name.endsWith(".tex")));
  const mainName = $derived(files.files.find((f) => f.id === files.mainId)?.name);
</script>

<!-- Recessed in light, where card and canvas are both white and the active tab
     would have nothing to sit against. Dark already has the lift. -->
<div
  class="border-border bg-muted dark:bg-card flex h-10 shrink-0 items-stretch border-b"
>
  <EditorTabs {files} onnew={() => files.newFile()} />

  <div
    class="border-border/70 flex shrink-0 items-center gap-1.5 border-l px-2"
  >
    <ViewSwitch {layout} />

    <span class="bg-border/60 h-5 w-px" aria-hidden="true"></span>

    <ExportMenu
      source={files.source}
      filename={files.activeFile?.name ?? "document.tex"}
      pdfBytes={compile.pdfBytes}
      {saveFile}
      onExportZip={ctrl.onExportProject ??
        (files.project ? () => files.exportProject() : undefined)}
      canExportZip={Boolean(ctrl.onExportProject) || Boolean(files.projectRoot)}
      size="sm"
    />

    {#if compile.canCompile}
      <span class="bg-border/60 h-5 w-px" aria-hidden="true"></span>

      <!-- Status is the button that opens the log it is summarising. -->
      <button
        class="hover:bg-background/60 hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors lg:inline-flex {compile.compileStatus ===
        'error'
          ? 'text-destructive'
          : 'text-muted-foreground'}"
        title="Show the compile log"
        aria-pressed={compile.showProblems}
        onclick={() => (compile.showProblems = !compile.showProblems)}
      >
        {#if compile.compiling}
          <IconLoader2 size={14} class="animate-spin" />
        {:else if compile.compileStatus === "error"}
          <IconAlertTriangleFilled size={14} />
        {:else if compile.compileStatus === "success"}
          <IconCheck size={14} class="text-success" />
        {/if}
        <span class="whitespace-nowrap">{compile.compileLabel}</span>
      </button>

      <ButtonGroup
        class="[&>[data-slot]:first-child]:!rounded-l-md [&>[data-slot]:last-child]:!rounded-r-md"
      >
        <Button
          size="sm"
          class="pl-2.5"
          disabled={compile.compiling}
          title="Compile ({shortcutLabel('compile')})"
          onclick={() => compile.runCompile(true)}
        >
          {#if compile.compiling}
            <IconLoader2 class="animate-spin" />
          {:else}
            <IconPlayerPlayFilled />
          {/if}
          <span class="hidden sm:inline">
            {compile.compiling
              ? "Compiling…"
              : compile.pdfBytes
                ? "Recompile"
                : "Compile"}
          </span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger>
            {#snippet child({ props })}
              <Button
                {...props}
                size="icon-sm"
                title="Compile options"
                aria-label="Compile options"
              >
                <IconChevronDown class="size-4" />
              </Button>
            {/snippet}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuCheckboxItem
              checked={settings.autoCompile}
              onCheckedChange={(v) => (settings.autoCompile = v)}
            >
              Live compile
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem onclick={() => compile.runCompile(true)}>
              Compile once
              <DropdownMenuShortcut>{shortcutLabel("compile")}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onclick={() => compile.syncToPdf()}>
              Sync to PDF
              <DropdownMenuShortcut>{shortcutLabel("sync-pdf")}</DropdownMenuShortcut>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <!-- GroupHeading throws outside a Group, which takes the whole menu
                 down with it — keep the two together. -->
            <DropdownMenuGroup>
              <DropdownMenuGroupHeading class="text-faint text-xs font-medium">
                Main file
              </DropdownMenuGroupHeading>
              {#if texFiles.length > 1}
                {#each texFiles as file (file.id)}
                  <DropdownMenuItem onclick={() => files.setMain(file.id)}>
                    <IconTargetArrow
                      class={file.id === files.mainId ? "text-brand" : "opacity-0"}
                    />
                    <span class="truncate font-mono text-xs">{file.name}</span>
                  </DropdownMenuItem>
                {/each}
              {:else}
                <DropdownMenuItem disabled>
                  <IconTargetArrow class="text-brand" />
                  <span class="truncate font-mono text-xs">{mainName ?? "—"}</span>
                </DropdownMenuItem>
              {/if}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    {/if}
  </div>
</div>
