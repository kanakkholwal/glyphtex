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
    IconArrowLeft,
    IconChevronDown,
    IconEye,
    IconFilePlus,
    IconLayoutColumns,
    IconLoader2,
    IconPencil,
    IconPhotoPlus,
    IconPlayerPlayFilled,
    IconTargetArrow,
  } from "@glyphx/ui/icons";

  import CommandPalette from "../command-palette.svelte";
  import ExportMenu from "../export-menu.svelte";
  import MenuBar from "../menu-bar.svelte";
  import { shortcutLabel } from "../shortcuts";
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
        class="h-7 gap-1.5 px-2"
        href={ctrl.backHref}
        title={ctrl.backLabel ?? "Back"}
      >
        <IconArrowLeft size={15} />
        <span class="hidden text-xs sm:inline">{ctrl.backLabel ?? "Back"}</span>
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
              class="h-7 gap-1.5 px-2 text-xs"
              title="The file compiled as the document root"
            >
              <IconTargetArrow size={15} class="text-brand" />
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
                size={14}
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
        class="h-7 w-auto min-w-0 border-0 text-xs font-normal focus:ring-0"
        aria-label="Select view mode"
      >
        {@const Icon = viewOptions.find((o) => o.value === layout.viewMode)?.icon}
        {#if Icon}
          <Icon class="inline-block size-[18px]" />
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
              class="size-7"
              title="Add files"
              aria-label="Add files"
            >
              <IconFilePlus size={16} />
            </Button>
          {/snippet}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
          <DropdownMenuItem onclick={() => ctrl.onAddFiles?.("")}>
            <IconFilePlus size={15} /> Add files…
          </DropdownMenuItem>
          <DropdownMenuItem onclick={() => ctrl.onAddFiles?.("image/*")}>
            <IconPhotoPlus size={15} /> Add images…
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
      size="xs"
    />

    <!-- Compile split-button: run + a ▾ menu for live-compile / sync. -->
    <ButtonGroup
      class="[&>[data-slot]:first-child]:!rounded-l-full [&>[data-slot]:last-child]:!rounded-r-full"
    >
      <Button
        onclick={() => compile.runCompile(true)}
        disabled={compile.compiling}
        size="sm"
        class="pl-3.5"
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
              size="icon-sm"
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
