<script lang="ts" module>
  // Public type kept stable for `@glyphtex/ui/application` consumers.
  export type { ViewMode } from "./workbench/types";
</script>

<script lang="ts">
  import { IconCurrentLocation } from '@tabler/icons-svelte';
  import { settings } from "@glyphtex/ui/settings";
  import { Toaster } from "@glyphtex/ui/sonner";
  import { onDestroy, onMount } from "svelte";

  import AboutDialog from "./about-dialog.svelte";
  import ActivityBar from "./activity-bar.svelte";
  import CommandPalette from "./command-palette.svelte";
  import ProblemsPanel from "./problems-panel.svelte";
  import ShortcutsDialog from "./shortcuts-dialog.svelte";
  import SidePanel from "./side-panel.svelte";
  import {
    WorkbenchController,
    type WorkbenchProps,
  } from "./workbench/controller.svelte";
  import ConflictDialog from "./workbench/conflict-dialog.svelte";
  import EditorPane from "./workbench/editor-pane.svelte";
  import PreviewPane from "./workbench/preview-pane.svelte";
  import StatusBar from "./workbench/status-bar.svelte";
  import TopBar from "./workbench/top-bar.svelte";

  /** Shell for the editor: Svelte glue and chrome layout only. State and behaviour
   *  live in {@link WorkbenchController}; the panes live in `./workbench/*`. */
  let props: WorkbenchProps = $props();
  // The controller intentionally captures the initial (stable) host injections —
  // `compile`, `project`, `git`, … never change after mount.
  // svelte-ignore state_referenced_locally
  const ctrl = new WorkbenchController(props);
  const { files, layout, search, compile } = ctrl;

  $effect(() => ctrl.armPersist());
  $effect(() => ctrl.refreshGitOnStructuralChange());
  $effect(() => ctrl.armAutoSave());
  $effect(() => layout.observeShell());
  $effect(() => ctrl.clearSearchHighlight());
  $effect(() => compile.armAutoCompile());

  onMount(() => {
    props.onready?.(ctrl);
    return ctrl.mountFileAssociation();
  });
  onDestroy(() => compile.disposePdf());
</script>

<svelte:window
  onpointermove={(e) => layout.onPointerMove(e)}
  onpointerup={() => layout.stopResize()}
  onkeydown={(e) => ctrl.onKeydown(e)}
  onblur={() => ctrl.onWindowBlur()}
/>

<!-- `flex-row-reverse` docks the rail + panel on the right edge (VS Code's
     "move primary side bar right"); the editor column keeps the rest. -->
<div
  bind:this={layout.shellEl}
  class="bg-background text-foreground flex h-full min-h-0 overflow-hidden {layout.sidebarRight
    ? 'flex-row-reverse'
    : ''}"
>
  <ActivityBar
    active={layout.activeView}
    onselect={(v) => layout.selectView(v)}
    position={settings.sidebarPosition}
    menus={ctrl.menus}
    homeHref={ctrl.backHref}
    homeLabel={ctrl.backLabel}
    onnewfile={() => files.newFile()}
    onopenproject={files.project ? () => files.openFolder() : undefined}
  />

    <!-- Collapses by width, not unmounting, so panel state survives a toggle. -->
    <div
      class="shrink-0 overflow-hidden {layout.resizingSidebar
        ? ''
        : 'transition-[width] duration-300 ease-[cubic-bezier(0.625,0.05,0,1)]'} {layout.panelCollapsed
        ? 'pointer-events-none'
        : ''}"
      style:width={layout.panelCollapsed ? "0px" : `${layout.sidebarWidth}px`}
      aria-hidden={layout.panelCollapsed}
    >
      <SidePanel
        view={layout.activeView}
        files={files.files}
        folders={files.extraFolders}
        activeId={files.activeId}
        mainId={files.mainId}
        source={files.source}
        projectName={files.displayName}
        hasProject={files.hasProject}
        engine={ctrl.engine}
        git={files.git}
        projectRoot={files.projectRoot}
        onopendiff={(path, staged) => layout.openDiff(path, staged)}
        activeDiffPath={layout.diffTarget?.path ?? null}
        widthPx={layout.sidebarWidth}
        onopen={(id) => files.openFile(id)}
        onnew={() => files.newFile()}
        onnewfolder={() => files.newFolder()}
        onopenfolder={() => files.openFolder()}
        onreveal={files.project?.revealInOS && files.projectRoot
          ? () => files.revealProject()
          : undefined}
        onaddfiles={ctrl.onAddFiles}
        onrenamefile={(id, name) => files.renameFile(id, name)}
        ondeletefile={(id) => files.deleteFile(id)}
        onsetmain={(id) => files.setMain(id)}
        onmovefile={(id, dir) => files.moveFile(id, dir)}
        onmovefolder={(src, dir) => files.moveFolder(src, dir)}
        onrenamefolder={(src, leaf) => files.renameFolder(src, leaf)}
        ondeletefolder={(p) => files.deleteFolder(p)}
        onnewfilein={(dir) => files.newFile(dir)}
        onnewfolderin={(dir) => files.newFolder(dir)}
        ondownloadfile={ctrl.onDownload ? (id) => ctrl.downloadFile(id) : undefined}
        ondownloadfolder={ctrl.onDownload ? (p) => ctrl.downloadFolder(p) : undefined}
        dirtyIds={files.dirtyIds}
        gitStatus={files.gitStatus}
        ongotoline={(n) => layout.editor?.goToLine(n)}
        onregistershell={files.project?.registerShellIntegration
          ? () => files.registerShell()
          : undefined}
        searchResults={search.searchResults}
        searchActive={search.searchActive}
        onsearch={(o) => search.runSearch(o)}
        ongotoresult={(i) => search.gotoResult(i)}
        onsearchnext={() => search.searchNext()}
        onsearchprev={() => search.searchPrev()}
        onreplacecurrent={(r) => search.replaceCurrent(r)}
        onreplaceall={(r) => search.replaceAll(r)}
      />
    </div>

    {#if !layout.panelCollapsed}
      <div
        class="group relative z-10 flex w-1 shrink-0 cursor-col-resize touch-none items-center justify-center"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        tabindex="-1"
        onpointerdown={() => layout.startSidebarResize()}
      >
        <span
          class="h-10 w-0.5 rounded-full transition-colors {layout.resizingSidebar
            ? 'bg-primary'
            : 'bg-border group-hover:bg-primary/60'}"
        ></span>
      </div>
    {/if}

    <!-- min-w-0: without it a wide PDF page or long log line pushes the layout past
         the window edge, hiding the preview toolbar and log copy button. -->
    <main class="flex min-h-0 min-w-0 flex-1 flex-col">
      <TopBar {ctrl} saveFile={props.saveFile} saving={props.saving} />

      <div
        bind:this={layout.bodyEl}
        class="flex min-h-0 min-w-0 flex-1 {layout.viewMode === 'split' &&
        layout.splitDir === 'vertical'
          ? 'flex-col'
          : ''}"
      >
        {#if layout.viewMode !== "preview"}
          <EditorPane {ctrl} />
        {/if}

        {#if layout.viewMode === "split"}
          {const stacked = layout.splitDir === "vertical"}
          <div
            class="group relative z-10 flex shrink-0 touch-none items-center justify-center {stacked
              ? 'h-1 w-full cursor-row-resize'
              : 'w-1 cursor-col-resize'}"
            role="separator"
            aria-orientation={stacked ? "horizontal" : "vertical"}
            aria-valuenow={Math.round(layout.splitPct)}
            tabindex="-1"
            onpointerdown={() => layout.startResize()}
          >
            <span
              class="rounded-full transition-colors {stacked
                ? 'h-0.5 w-10'
                : 'h-10 w-0.5'} {layout.dragging
                ? 'bg-primary'
                : 'bg-border group-hover:bg-primary/60'}"
            ></span>
            <!-- SyncTeX: jump from the cursor's line to that spot in the PDF.
                 Reverse (PDF→source) is a double-click in the preview. -->
            <button
              class="bg-card text-muted-foreground hover:bg-primary hover:text-primary-foreground border-border absolute grid size-6 place-items-center rounded-full border opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              title="Jump to this line in the PDF (⌘/Ctrl+J)"
              aria-label="Jump to this line in the PDF"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={() => compile.syncToPdf()}
            >
              <IconCurrentLocation size={13} />
            </button>
          </div>
        {/if}

        {#if layout.viewMode !== "editor"}
          <PreviewPane {ctrl} />
        {/if}
      </div>

      {#if compile.showProblems}
        <ProblemsPanel
          problems={compile.problems}
          log={compile.compileLog}
          hint={compile.compileHint}
          ongoto={(l) => {
            layout.editor?.goToLine(l);
            if (layout.viewMode === "preview") layout.viewMode = "split";
          }}
          onclose={() => (compile.showProblems = false)}
        />
      {/if}

      <StatusBar {ctrl} />
    </main>
</div>

<CommandPalette
  bind:open={layout.paletteOpen}
  files={files.files}
  activeId={files.activeId}
  projectName={files.displayName}
  onopen={(id) => files.openFile(id)}
/>

<ConflictDialog {files} />

<AboutDialog bind:open={layout.aboutOpen} platform={ctrl.platform} />
<ShortcutsDialog bind:open={layout.shortcutsOpen} />

<Toaster />

<style>
  /* PDF export = print the preview page only, until Tectonic compiles for real. */
  @media print {
    :global(body *) {
      visibility: hidden !important;
    }
    :global(.glyphtex-print-area),
    :global(.glyphtex-print-area *) {
      visibility: visible !important;
    }
    :global(.glyphtex-print-area) {
      position: fixed;
      inset: 0;
      max-width: none;
      border: none;
      overflow: visible;
    }
  }
</style>
