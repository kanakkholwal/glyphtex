<script lang="ts">
  import { Button } from "@glyphx/ui/button";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@glyphx/ui/dropdown-menu";
  import { Logo } from "@glyphx/ui/logo";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
  } from "@glyphx/ui/select";
  import {
    IconArrowLeft,
    IconEye,
    IconFilePlus,
    IconLayoutColumns,
    IconPencil,
    IconPhotoPlus,
    IconTargetArrow,
  } from '@tabler/icons-svelte';

  import CommandPalette from "../command-palette.svelte";
  import ExportMenu from "../export-menu.svelte";
  import MenuBar from "../menu-bar.svelte";
  import type { WorkbenchController } from "./controller.svelte";
  import type { SaveFileFn } from "./types";

  /**
   * The one workbench header: logo + back + application menu (left) · document
   * name / quick-open (centre) · main-file · view · add · export · compile (right).
   */
  let {
    ctrl,
    saveFile,
    saving,
  }: { ctrl: WorkbenchController; saveFile?: SaveFileFn; saving?: boolean } =
    $props();

  const files = $derived(ctrl.files);
  const layout = $derived(ctrl.layout);
  const compile = $derived(ctrl.compile);

  const viewOptions = [
    { value: "editor" as const, icon: IconPencil, title: "Editor only" },
    { value: "split" as const, icon: IconLayoutColumns, title: "Split view" },
    { value: "preview" as const, icon: IconEye, title: "Preview only" },
  ];

  // Candidate root files, so a multi-file document can pick which one compiles.
  const texFiles = $derived(
    files.files.filter((f) => f.name.endsWith(".tex")),
  );
  const mainName = $derived(
    files.files.find((f) => f.id === files.mainId)?.name,
  );
</script>

<header
  class="border-border bg-card/95 supports-[backdrop-filter]:bg-card/80 flex h-12 shrink-0 items-center gap-2 border-b px-2.5 backdrop-blur-xl"
>
  <!-- Left: logo · back · application menu -->
  <div class="flex shrink-0 items-center gap-1">
    <Logo href="/" text={false} size="md" viewTransitionName="app-logo" />
    {#if ctrl.backHref}
      <Button
        variant="ghost"
        size="sm"
        class="gap-1.5 px-2"
        href={ctrl.backHref}
        title={ctrl.backLabel ?? "Back"}
      >
        <IconArrowLeft />
        <span class="hidden sm:inline">{ctrl.backLabel ?? "Back"}</span>
      </Button>
    {/if}
    <MenuBar menus={ctrl.menus} />
  </div>

  <!-- Centre: document name / quick-open -->
  <div class="flex flex-1 justify-center">
    <CommandPalette
      bind:open={layout.paletteOpen}
      files={files.files}
      activeId={files.activeId}
      projectName={files.displayName}
      onopen={(id) => files.openFile(id)}
      onrename={ctrl.onRenameProject}
      {saving}
    />
  </div>

  <!-- Right: main-file · view · add · export · compile -->
  <div class="inline-flex shrink-0 items-center gap-1.5">
    {#if texFiles.length > 1}
      <DropdownMenu>
        <DropdownMenuTrigger>
          {#snippet child({ props })}
            <Button
              {...props}
              variant="ghost"
              size="sm"
              class="gap-1.5 px-2"
              title="The file compiled as the document root"
            >
              <IconTargetArrow class="text-brand" />
              <span class="hidden max-w-32 truncate font-mono md:inline"
                >{mainName ?? "Set main"}</span
              >
            </Button>
          {/snippet}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="max-h-72 w-56 overflow-y-auto">
          {#each texFiles as file (file.id)}
            <DropdownMenuItem onclick={() => files.setMain(file.id)}>
              <IconTargetArrow
                class={file.id === files.mainId ? "text-brand" : "opacity-0"}
              />
              <span class="truncate font-mono text-xs">{file.name}</span>
            </DropdownMenuItem>
          {/each}
        </DropdownMenuContent>
      </DropdownMenu>
    {/if}

    <Select bind:value={layout.viewMode} type="single" name="viewMode">
      <SelectTrigger
        size="sm"
        class="h-8 w-auto min-w-0 border-0 text-xs font-normal focus:ring-0"
        aria-label="Select view mode"
      >
        {@const Icon = viewOptions.find((o) => o.value === layout.viewMode)?.icon}
        {#if Icon}
          <Icon class="inline-block size-4" />
        {/if}
        <span class="hidden lg:inline">
          {layout.viewMode === "editor"
            ? "Editor"
            : layout.viewMode === "split"
              ? "Split"
              : "Preview"}
        </span>
      </SelectTrigger>
      <SelectContent>
        {#each viewOptions as option (option.value)}
          <SelectItem value={option.value}>{option.title}</SelectItem>
        {/each}
      </SelectContent>
    </Select>

    {#if ctrl.onAddFiles}
      <DropdownMenu>
        <DropdownMenuTrigger>
          {#snippet child({ props })}
            <Button
              {...props}
              variant="ghost"
              size="icon-sm"
              title="Add files"
              aria-label="Add files"
            >
              <IconFilePlus />
            </Button>
          {/snippet}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
          <DropdownMenuItem onclick={() => ctrl.onAddFiles?.("")}>
            <IconFilePlus /> Add files…
          </DropdownMenuItem>
          <DropdownMenuItem onclick={() => ctrl.onAddFiles?.("image/*")}>
            <IconPhotoPlus /> Add images…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    {/if}

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
  </div>
</header>
