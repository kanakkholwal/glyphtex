<script lang="ts">
  import { settings } from "@glyphx/ui/settings";
  import {
    IconArrowBackUp,
    IconArrowForwardUp,
    IconBaselineDensityMedium,
    IconDeviceFloppy,
    IconFolderShare,
    IconLayoutColumns,
    IconRefresh,
    IconSearch,
    IconX,
  } from "@tabler/icons-svelte";

  import { setWorkspaceFiles } from "@glyphx/ui/editor";

  import AssetViewer from "../asset-viewer.svelte";
  import CodeEditor from "../code-editor.svelte";
  import DiffView from "../diff-view.svelte";
  import EditorFindBar from "../editor-find-bar.svelte";
  import FormatToolbar from "../format-toolbar.svelte";
  import type { WorkbenchController } from "./controller.svelte";
  import { baseName } from "./paths";

  /**
   * Editor pane — the left/main column when not preview-only. Renders one of:
   * a read-only diff (Source Control), the code editor with its format/save/find
   * toolbar, or the asset viewer (image / PDF / unsupported binary).
   */
  let { ctrl }: { ctrl: WorkbenchController } = $props();
  const files = $derived(ctrl.files);
  const layout = $derived(ctrl.layout);
  const search = $derived(ctrl.search);

  // Publish the project to the language providers, which otherwise only ever
  // see the one file Monaco has a model for. This is what lets `\cite{` read a
  // sibling .bib and `\ref{` reach a label in another chapter.
  //
  // Deliberately keyed on `savedTick` rather than on live buffers: reindexing
  // every keystroke across every file would be wasteful, and a label only
  // becomes referenceable once it is written down. The open file's own labels
  // come from its live model inside the provider, so they stay instant.
  $effect(() => {
    void files.savedTick;
    setWorkspaceFiles(
      files.files
        .filter((f) => f.loaded !== false)
        .map((f) => ({
          path: f.path ?? f.name,
          content: files.liveContent(f),
        })),
    );
  });
</script>

<section
  class="flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden {layout.viewMode ===
  'split'
    ? 'border-border border-r'
    : ''}"
  style={layout.viewMode === "split"
    ? `width:${layout.splitPct}%`
    : "width:100%"}
>
  {#if layout.diffTarget}
    <!-- Diff view (VS Code-style): file name + side-by-side / inline toggle +
         refresh + close. Read-only comparison of the change. -->
    <div
      class="text-muted-foreground border-border flex h-9 shrink-0 items-center gap-2 border-b px-2 text-xs"
    >
      <span class="truncate pl-1" title={layout.diffTarget.path}>
        {baseName(layout.diffTarget.path)}
        <span class="text-muted-foreground/60">
          — {layout.diffTarget.staged ? "Staged changes" : "Working tree"}
        </span>
      </span>
      <div class="ml-auto flex shrink-0 items-center gap-1 pl-1">
        <button
          class="hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded transition-colors {settings.diffView ===
          'side'
            ? 'bg-muted text-foreground'
            : ''}"
          title="Side by side"
          aria-label="Side by side"
          aria-pressed={settings.diffView === "side"}
          onclick={() => (settings.diffView = "side")}
        >
          <IconLayoutColumns size={15} />
        </button>
        <button
          class="hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded transition-colors {settings.diffView ===
          'inline'
            ? 'bg-muted text-foreground'
            : ''}"
          title="Inline"
          aria-label="Inline"
          aria-pressed={settings.diffView === "inline"}
          onclick={() => (settings.diffView = "inline")}
        >
          <IconBaselineDensityMedium size={15} />
        </button>
        <div class="bg-border/70 mx-0.5 h-5 w-px"></div>
        <button
          class="hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded transition-colors"
          title="Refresh diff"
          aria-label="Refresh diff"
          onclick={() => layout.refreshDiff()}
        >
          <IconRefresh size={15} />
        </button>
        <button
          class="hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded transition-colors"
          title="Close diff"
          aria-label="Close diff"
          onclick={() => layout.closeDiff()}
        >
          <IconX size={15} />
        </button>
      </div>
    </div>
    <div class="min-h-0 flex-1">
      {#if layout.diffTarget.binary}
        <div
          class="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-xs"
        >
          Binary file — no text diff to show.
        </div>
      {:else}
        <DiffView
          original={layout.diffTarget.original}
          modified={layout.diffTarget.modified}
          mode={settings.diffView}
          theme={settings.resolved}
          language={layout.diffLanguage}
          fontSize={settings.fontSize}
          fontFamily={settings.fontStack}
        />
      {/if}
    </div>
  {:else if files.activeEditable}
    <div
      class="text-muted-foreground border-border flex h-9 shrink-0 items-center gap-2 border-b px-2 text-xs"
    >
      <!-- The LaTeX format toolbar is only meaningful for TeX *source*; aux
           files, markdown and code just get a kind label. -->
      {#if files.activeHasToolbar}
        <FormatToolbar
          wrap={(b, a) => layout.editor?.wrapSelection(b, a)}
          insert={(t) => layout.editor?.insertText(t)}
        />
      {:else}
        <span class="text-muted-foreground/60 pl-1">
          {files.activeKind === "markdown" ? "Markdown" : "Plain text"}
        </span>
      {/if}

      <!-- Right cluster: save, history, find. -->
      <div class="ml-auto flex shrink-0 items-center gap-1 pl-1">
        <button
          class="hover:bg-muted hover:text-foreground relative grid size-7 place-items-center rounded transition-colors disabled:pointer-events-none disabled:opacity-40"
          title={files.activeDirty ? "Save (⌘/Ctrl+S)" : "Saved"}
          aria-label="Save"
          disabled={!files.activeDirty}
          onclick={() => void files.saveActive()}
        >
          <IconDeviceFloppy size={15} />
          {#if files.activeDirty}
            <span
              class="bg-brand absolute top-0.5 right-0.5 size-1.5 rounded-full"
            ></span>
          {/if}
        </button>
        <div class="bg-border/70 mx-0.5 h-5 w-px"></div>
        <button
          class="hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded transition-colors disabled:pointer-events-none disabled:opacity-40"
          title="Undo (⌘/Ctrl+Z)"
          aria-label="Undo"
          disabled={!layout.canUndo}
          onclick={() => layout.editor?.undo()}
        >
          <IconArrowBackUp size={15} />
        </button>
        <button
          class="hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded transition-colors disabled:pointer-events-none disabled:opacity-40"
          title="Redo (⌘/Ctrl+Shift+Z)"
          aria-label="Redo"
          disabled={!layout.canRedo}
          onclick={() => layout.editor?.redo()}
        >
          <IconArrowForwardUp size={15} />
        </button>
        <div class="bg-border/70 mx-0.5 h-5 w-px"></div>
        <button
          class="hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded transition-colors {search.showFind
            ? 'bg-muted text-foreground'
            : ''}"
          title="Find / replace (⌘/Ctrl+F)"
          aria-label="Find in document"
          aria-pressed={search.showFind}
          onclick={() => (search.showFind ? search.closeFind() : search.openFind())}
        >
          <IconSearch size={15} />
        </button>
      </div>
    </div>
    <div class="min-h-0 flex-1">
      <CodeEditor
        bind:this={layout.editor}
        bind:value={files.source}
        bind:canUndo={layout.canUndo}
        bind:canRedo={layout.canRedo}
        docKey={files.activeId}
        theme={settings.resolved}
        language={files.activeLanguage}
        fontSize={settings.fontSize}
        fontFamily={settings.fontStack}
        lineWrapping={settings.lineWrapping}
        oncursor={(p) => (layout.cursor = p)}
      />
    </div>
    {#if search.showFind}
      <EditorFindBar
        bind:this={search.findBar}
        initial={search.searchOpts}
        resultCount={search.searchResults.length}
        activeIndex={search.searchActive}
        onsearch={(o) => search.runSearch(o)}
        onnext={() => search.searchNext()}
        onprev={() => search.searchPrev()}
        onreplacecurrent={(r) => search.replaceCurrent(r)}
        onreplaceall={(r) => search.replaceAll(r)}
        onclose={() => search.closeFind()}
      />
    {/if}
  {:else}
    <!-- Non-text file (image / PDF / unsupported): a slim header with a reveal
         action, then the AssetViewer renders it directly. -->
    <div
      class="text-muted-foreground border-border flex h-9 shrink-0 items-center justify-between gap-2 border-b px-2 text-xs"
    >
      <span class="truncate pl-1" title={files.activeFile?.name}>
        {baseName(files.activeFile?.name ?? "")}
      </span>
      {#if files.project?.revealInOS && files.activeFile?.path}
        <button
          class="hover:bg-muted hover:text-foreground grid size-6 shrink-0 place-items-center rounded transition-colors"
          title="Reveal in folder"
          aria-label="Reveal in folder"
          onclick={() => files.revealActiveFile()}
        >
          <IconFolderShare size={15} />
        </button>
      {/if}
    </div>
    <div class="min-h-0 flex-1">
      <AssetViewer
        kind={files.activeKind}
        name={files.activeFile?.name ?? ""}
        path={files.activeFile?.path}
        readBytes={files.project?.readFileBytes}
        onreveal={files.project?.revealInOS && files.activeFile?.path
          ? () => files.revealActiveFile()
          : undefined}
      />
    </div>
  {/if}
</section>
