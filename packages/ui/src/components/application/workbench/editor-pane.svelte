<script lang="ts">
  import { Button } from "@glyphtex/ui/button";
  import { settings } from "@glyphtex/ui/settings";
  import {
    IconArrowBackUp,
    IconArrowForwardUp,
    IconBaselineDensityMedium,
    IconFolderShare,
    IconLayoutColumns,
    IconRefresh,
    IconSearch,
    IconX,
  } from '@tabler/icons-svelte';

  import { setWorkspaceFiles } from "@glyphtex/ui/editor";

  import AssetViewer from "../asset-viewer.svelte";
  import CodeEditor from "../code-editor.svelte";
  import DiffView from "../diff-view.svelte";
  import EditorFindBar from "../editor-find-bar.svelte";
  import EditorTabs from "./editor-tabs.svelte";
  import FormatToolbar from "../format-toolbar.svelte";
  import type { WorkbenchController } from "./controller.svelte";
  import { baseName } from "./paths";

  /** The main editor column: a read-only diff, the code editor, or the asset viewer,
   *  depending on what is active. */
  let { ctrl }: { ctrl: WorkbenchController } = $props();
  const files = $derived(ctrl.files);
  const layout = $derived(ctrl.layout);
  const search = $derived(ctrl.search);

  // Assets are read by absolute path on desktop and by project-relative name on
  // web (IndexedDB), so the viewer takes whichever the host can resolve.
  const assetKey = $derived(files.activeFile?.path ?? files.activeFile?.name);

  // Publishes siblings to the language providers so `\cite{`/`\ref{` resolve across
  // files. Keyed on `savedTick`, not live buffers — reindexing every keystroke is waste.
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
  class="flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden {layout.viewMode !==
  'split'
    ? ''
    : layout.splitDir === 'vertical'
      ? 'border-border w-full border-b'
      : 'border-border h-full border-r'}"
  style={layout.viewMode !== "split"
    ? "width:100%;height:100%"
    : layout.splitDir === "vertical"
      ? `height:${layout.splitPct}%`
      : `width:${layout.splitPct}%`}
>
  {#if layout.diffTarget}
    <div
      class="text-muted-foreground border-border bg-card flex h-9 shrink-0 items-center gap-2 border-b px-1.5 text-xs"
    >
      <span class="truncate pl-1" title={layout.diffTarget.path}>
        {baseName(layout.diffTarget.path)}
        <span class="text-muted-foreground/60">
          — {layout.diffTarget.staged ? "Staged changes" : "Working tree"}
        </span>
      </span>
      <div class="ml-auto flex shrink-0 items-center gap-0.5">
        <Button
          variant={settings.diffView === "side" ? "secondary" : "ghost"}
          size="icon-sm"
          title="Side by side"
          aria-label="Side by side"
          aria-pressed={settings.diffView === "side"}
          onclick={() => (settings.diffView = "side")}
        >
          <IconLayoutColumns />
        </Button>
        <Button
          variant={settings.diffView === "inline" ? "secondary" : "ghost"}
          size="icon-sm"
          title="Inline"
          aria-label="Inline"
          aria-pressed={settings.diffView === "inline"}
          onclick={() => (settings.diffView = "inline")}
        >
          <IconBaselineDensityMedium />
        </Button>
        <span class="bg-border/60 mx-1 h-5 w-px"></span>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Refresh diff"
          aria-label="Refresh diff"
          onclick={() => layout.refreshDiff()}
        >
          <IconRefresh />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Close diff"
          aria-label="Close diff"
          onclick={() => layout.closeDiff()}
        >
          <IconX />
        </Button>
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
  {:else}
    <EditorTabs {files}>
      {#snippet actions()}
        {#if files.activeEditable}
          <Button
            variant="ghost"
            size="icon-sm"
            title="Undo (⌘/Ctrl+Z)"
            aria-label="Undo"
            disabled={!layout.canUndo}
            onclick={() => layout.editor?.undo()}
          >
            <IconArrowBackUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Redo (⌘/Ctrl+Shift+Z)"
            aria-label="Redo"
            disabled={!layout.canRedo}
            onclick={() => layout.editor?.redo()}
          >
            <IconArrowForwardUp />
          </Button>
          <span class="bg-border/60 mx-1 h-5 w-px"></span>
          <Button
            variant={search.showFind ? "secondary" : "ghost"}
            size="icon-sm"
            title="Find / replace (⌘/Ctrl+F)"
            aria-label="Find in document"
            aria-pressed={search.showFind}
            onclick={() => (search.showFind ? search.closeFind() : search.openFind())}
          >
            <IconSearch />
          </Button>
        {:else if files.project?.revealInOS && files.activeFile?.path}
          <Button
            variant="ghost"
            size="icon-sm"
            title="Reveal in folder"
            aria-label="Reveal in folder"
            onclick={() => files.revealActiveFile()}
          >
            <IconFolderShare />
          </Button>
        {/if}
      {/snippet}
    </EditorTabs>

    {#if files.activeEditable}
      {#if files.activeHasToolbar}
        <div
          class="border-border bg-card flex h-9 shrink-0 items-center border-b px-1.5"
        >
          <FormatToolbar
            wrap={(b, a) => layout.editor?.wrapSelection(b, a)}
            insert={(t) => layout.editor?.insertText(t)}
          />
        </div>
      {/if}
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
      <div class="min-h-0 flex-1">
        <AssetViewer
          kind={files.activeKind}
          name={files.activeFile?.name ?? ""}
          {assetKey}
          readBytes={ctrl.readFileBytes}
          onreveal={files.project?.revealInOS && files.activeFile?.path
            ? () => files.revealActiveFile()
            : undefined}
        />
      </div>
    {/if}
  {/if}
</section>
