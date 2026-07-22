<script lang="ts">
  import { Button } from "@glyphtex/ui/button";
  import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroupHeading,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
  } from "@glyphtex/ui/dropdown-menu";
  import { settings } from "@glyphtex/ui/settings";
  import {
    IconArrowLeft,
    IconCheck,
    IconDots,
    IconEye,
    IconFilePlus,
    IconInfoCircle,
    IconLayoutColumns,
    IconLoader2,
    IconPencil,
    IconPhotoPlus,
    IconPlayerPlayFilled,
    IconTargetArrow,
  } from '@tabler/icons-svelte';

  import ExportMenu from "../export-menu.svelte";
  import { shortcutLabel } from "../shortcuts";
  import type { WorkbenchController } from "./controller.svelte";
  import { baseName } from "./paths";
  import type { SaveFileFn } from "./types";

  /**
   * Document header: back · project / file breadcrumb · save state · Compile ·
   * document info · overflow. App identity (logo, File/Edit/View) lives in the
   * rail, so this bar only ever describes the open document.
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
    { value: "editor" as const, icon: IconPencil, label: "Editor" },
    { value: "split" as const, icon: IconLayoutColumns, label: "Split" },
    { value: "preview" as const, icon: IconEye, label: "Preview" },
  ];

  // Candidate root files, so a multi-file document can pick which one compiles.
  const texFiles = $derived(files.files.filter((f) => f.name.endsWith(".tex")));
  const mainName = $derived(files.files.find((f) => f.id === files.mainId)?.name);

  let renaming = $state(false);
  let draft = $state("");
  let field = $state<HTMLInputElement>();

  function startRename(): void {
    if (!ctrl.onRenameProject) return;
    draft = files.displayName;
    renaming = true;
    queueMicrotask(() => field?.select());
  }

  function commitRename(): void {
    renaming = false;
    const next = draft.trim();
    if (next && next !== files.displayName) ctrl.onRenameProject?.(next);
  }
</script>

<header
  class="border-border bg-card flex h-12 shrink-0 items-center gap-2 border-b px-2.5"
>
  <!-- Left: back + breadcrumb -->
  <div class="flex min-w-0 flex-1 items-center gap-1">
    {#if ctrl.backHref}
      <Button
        variant="ghost"
        size="icon-sm"
        href={ctrl.backHref}
        title={ctrl.backLabel ?? "Back"}
        aria-label={ctrl.backLabel ?? "Back"}
      >
        <IconArrowLeft />
      </Button>
    {/if}

    <nav class="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      {#if renaming}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          bind:this={field}
          bind:value={draft}
          autofocus
          class="border-border text-foreground min-w-0 max-w-48 rounded-md border bg-transparent px-1.5 py-0.5 font-medium focus:outline-none"
          onblur={commitRename}
          onkeydown={(e) => {
            if (e.key === "Enter") commitRename();
            else if (e.key === "Escape") renaming = false;
          }}
          aria-label="Document name"
        />
      {:else}
        <button
          class="text-muted-foreground hover:text-foreground max-w-48 truncate rounded-md font-medium transition-colors"
          title={ctrl.onRenameProject
            ? "Double-click to rename"
            : files.displayName}
          ondblclick={startRename}
        >
          {files.displayName}
        </button>
      {/if}
      {#if files.activeFile}
        <span class="text-faint shrink-0" aria-hidden="true">/</span>
        <button
          class="text-foreground max-w-56 truncate font-medium"
          title="Go to file ({shortcutLabel('quick-open')})"
          onclick={() => (layout.paletteOpen = true)}
        >
          {baseName(files.activeFile.name)}
        </button>
      {/if}
    </nav>
  </div>

  <!-- Right: save state · Compile · info · overflow -->
  <div class="inline-flex shrink-0 items-center gap-1.5">
    {#if saving !== undefined}
      <span
        class="text-muted-foreground inline-flex items-center gap-1 pr-1 text-sm"
        aria-live="polite"
      >
        {#if saving}
          <IconLoader2 size={14} class="animate-spin" />
          Saving…
        {:else}
          Saved
          <IconCheck size={14} class="text-success" />
        {/if}
      </span>
    {/if}

    {#if compile.canCompile}
      <Button
        size="sm"
        class="pl-2.5"
        disabled={compile.compiling}
        onclick={() => compile.runCompile(true)}
      >
        {#if compile.compiling}
          <IconLoader2 class="animate-spin" />
        {:else}
          <IconPlayerPlayFilled />
        {/if}
        {compile.compiling ? "Compiling…" : "Compile"}
      </Button>
    {/if}

    <Button
      variant={compile.showProblems ? "secondary" : "ghost"}
      size="icon-sm"
      title="Problems and compile log"
      aria-label="Problems and compile log"
      aria-pressed={compile.showProblems}
      onclick={() => (compile.showProblems = !compile.showProblems)}
    >
      <IconInfoCircle />
    </Button>

    <DropdownMenu>
      <DropdownMenuTrigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            size="icon-sm"
            title="More"
            aria-label="More document actions"
          >
            <IconDots />
          </Button>
        {/snippet}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-56">
        <DropdownMenuGroupHeading>View</DropdownMenuGroupHeading>
        {#each viewOptions as option (option.value)}
          {@const Icon = option.icon}
          <DropdownMenuCheckboxItem
            checked={layout.viewMode === option.value}
            onCheckedChange={() => (layout.viewMode = option.value)}
          >
            <Icon class="text-muted-foreground" />
            {option.label}
          </DropdownMenuCheckboxItem>
        {/each}

        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={settings.autoCompile}
          onCheckedChange={(v) => (settings.autoCompile = v)}
        >
          Live compile
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem onclick={() => compile.syncToPdf()}>
          Sync to PDF
          <DropdownMenuShortcut>{shortcutLabel("sync-pdf")}</DropdownMenuShortcut>
        </DropdownMenuItem>

        {#if texFiles.length > 1}
          <DropdownMenuSeparator />
          <DropdownMenuGroupHeading>Main file</DropdownMenuGroupHeading>
          {#each texFiles as file (file.id)}
            <DropdownMenuItem onclick={() => files.setMain(file.id)}>
              <IconTargetArrow
                class={file.id === files.mainId ? "text-brand" : "opacity-0"}
              />
              <span class="truncate font-mono text-xs">{file.name}</span>
            </DropdownMenuItem>
          {/each}
        {:else if mainName}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <IconTargetArrow class="text-brand" />
            <span class="truncate font-mono text-xs">{mainName}</span>
          </DropdownMenuItem>
        {/if}

        {#if ctrl.onAddFiles}
          <DropdownMenuSeparator />
          <DropdownMenuItem onclick={() => ctrl.onAddFiles?.("")}>
            <IconFilePlus class="text-muted-foreground" /> Add files…
          </DropdownMenuItem>
          <DropdownMenuItem onclick={() => ctrl.onAddFiles?.("image/*")}>
            <IconPhotoPlus class="text-muted-foreground" /> Add images…
          </DropdownMenuItem>
        {/if}
      </DropdownMenuContent>
    </DropdownMenu>

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
