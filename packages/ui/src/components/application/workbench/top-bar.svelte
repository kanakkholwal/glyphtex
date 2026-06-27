<script lang="ts">
  import { Button } from "@glyphx/ui/button";
  import { ButtonGroup } from "@glyphx/ui/button-group";
  import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
  } from "@glyphx/ui/dropdown-menu";
  import { Logo } from "@glyphx/ui/logo";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
  } from "@glyphx/ui/select";
  import { settings } from "@glyphx/ui/settings";
  import {
    IconChevronDown,
    IconEye,
    IconLayoutColumns,
    IconLoader2,
    IconPencil,
    IconPlayerPlayFilled,
  } from "@tabler/icons-svelte";

  import CommandPalette from "../command-palette.svelte";
  import ExportMenu from "../export-menu.svelte";
  import MenuBar from "../menu-bar.svelte";
  import { shortcutLabel } from "../shortcuts";
  import type { WorkbenchController } from "./controller.svelte";
  import type { SaveFileFn } from "./types";

  /**
   * Top bar — VS Code-style: logo + application menu (left) · workspace /
   * quick-open (centre) · view toggles + export + compile (right).
   */
  let { ctrl, saveFile }: { ctrl: WorkbenchController; saveFile?: SaveFileFn } =
    $props();

  const files = $derived(ctrl.files);
  const layout = $derived(ctrl.layout);
  const compile = $derived(ctrl.compile);

  // View-mode toggles — three plain icon options (editor / split / preview).
  const viewOptions = [
    { value: "editor" as const, icon: IconPencil, title: "Editor only" },
    { value: "split" as const, icon: IconLayoutColumns, title: "Split view" },
    { value: "preview" as const, icon: IconEye, title: "Preview only" },
  ];
</script>

<header
  class="border-border bg-card flex h-12 shrink-0 items-center gap-2.5 border-b px-3"
>
  <!-- Left: logo + application menu -->
  <div class="flex shrink-0 items-center gap-1.5">
    <Logo href="/" text={false} size="md" viewTransitionName="app-logo" class="pr-1" />
    <MenuBar menus={ctrl.menus} />
  </div>

  <!-- Centre: workspace name / quick-open (⌘P) -->
  <div class="flex flex-1 justify-center">
    <CommandPalette
      bind:open={layout.paletteOpen}
      files={files.files}
      activeId={files.activeId}
      projectName={files.displayName}
      onopen={(id) => files.openFile(id)}
    />
  </div>

  <!-- Right: view toggles · export · compile -->
  <div class="inline-flex shrink-0 items-center gap-2">
    <Select bind:value={layout.viewMode} type="single" name="viewMode">
      <SelectTrigger
        size="sm"
        class="w-auto min-w-0 border-0 text-xs font-normal focus:ring-0"
        aria-label="Select view mode"
      >
        {@const Icon = viewOptions.find((o) => o.value === layout.viewMode)?.icon}
        {#if Icon}
          <Icon class="inline-block size-4" />
        {/if}
        {layout.viewMode === "editor"
          ? "Editor only"
          : layout.viewMode === "split"
            ? "Split view"
            : "Preview only"}
      </SelectTrigger>
      <SelectContent>
        {#each viewOptions as option (option.value)}
          <SelectItem value={option.value}>{option.title}</SelectItem>
        {/each}
      </SelectContent>
    </Select>

    <ExportMenu
      source={files.source}
      filename={files.activeFile?.name ?? "document.tex"}
      pdfBytes={compile.pdfBytes}
      {saveFile}
      onExportZip={files.project ? () => files.exportProject() : undefined}
      canExportZip={Boolean(files.projectRoot)}
      size="default"
    />

    <!-- Compile split-button: run + a ▾ menu for live-compile / sync. -->
    <ButtonGroup>
      <Button
        onclick={() => compile.runCompile(true)}
        disabled={compile.compiling}
        size="xs"
      >
        {#if compile.compiling}
          <IconLoader2 class="animate-spin" />
        {:else}
          <IconPlayerPlayFilled />
        {/if}
        {compile.compiling ? "Compiling…" : "Compile"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger>
          {#snippet child({ props })}
            <Button
              {...props}
              size="icon-xs"
              title="Compile options"
              aria-label="Compile options"
            >
              <IconChevronDown />
            </Button>
          {/snippet}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-52">
          <DropdownMenuCheckboxItem
            checked={settings.autoCompile}
            onCheckedChange={(v) => (settings.autoCompile = v)}
          >
            Live compile
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem
            disabled={!compile.canCompile}
            onclick={() => compile.runCompile(true)}
          >
            Compile once
            <DropdownMenuShortcut>{shortcutLabel("compile")}</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onclick={() => compile.syncToPdf()}>
            Sync to PDF
            <DropdownMenuShortcut>{shortcutLabel("sync-pdf")}</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  </div>
</header>
