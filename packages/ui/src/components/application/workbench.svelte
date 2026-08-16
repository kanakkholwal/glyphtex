<script lang="ts" module>
	// Public type kept stable for `@glyphtex/ui/application` consumers.
	export type { ViewMode } from './workbench/types';
</script>

<script lang="ts">
	import { IconCurrentLocation } from '@tabler/icons-svelte';
	import { settings } from '@glyphtex/ui/settings';
	import { Toaster } from '@glyphtex/ui/sonner';
	import { onDestroy, onMount } from 'svelte';

	import AboutDialog from './about-dialog.svelte';
	import CommandPalette from './command-palette.svelte';
	import ShortcutsDialog from './shortcuts-dialog.svelte';
	import SidePanel from './side-panel.svelte';
	import BottomDock from './workbench/bottom-dock.svelte';
	import { WorkbenchController, type WorkbenchProps } from './workbench/controller.svelte';
	import ConflictDialog from './workbench/conflict-dialog.svelte';
	import EditorPane from './workbench/editor-pane.svelte';
	import PreviewPane from './workbench/preview-pane.svelte';
	import RightPanel from './workbench/right-panel.svelte';
	import TitleBar from './workbench/title-bar.svelte';
	import Toolbar from './workbench/toolbar.svelte';
	import VisualPane from './workbench/visual-pane.svelte';

	/** Shell for the editor: Svelte glue and chrome layout only. State and behaviour
	 *  live in {@link WorkbenchController}; the panes live in `./workbench/*`. */
	let props: WorkbenchProps = $props();
	// The controller intentionally captures the initial (stable) host injections.
	// `compile`, `project`, `git`, … never change after mount.
	// svelte-ignore state_referenced_locally
	const ctrl = new WorkbenchController(props);
	const { files, layout, search, compile, notes } = ctrl;

	$effect(() => ctrl.armPersist());
	$effect(() => ctrl.armAutoSave());
	$effect(() => files.persistTabs());
	$effect(() => layout.observeShell());
	$effect(() => ctrl.clearSearchHighlight());
	$effect(() => compile.armAutoCompile());
	$effect(() => files.watchHead());
	$effect(() => notes.sync());

	onMount(() => {
		props.onready?.(ctrl);
		return ctrl.mountFileAssociation();
	});
	onDestroy(() => compile.disposePdf());

	/** One curve for every panel that opens or closes, so the chrome moves as a set. */
	const PANEL_EASE =
		'duration-300 ease-[cubic-bezier(0.625,0.05,0,1)] motion-reduce:transition-none';
</script>

<svelte:window
	onpointermove={(e) => layout.onPointerMove(e)}
	onpointerup={() => layout.stopResize()}
	onkeydown={(e) => ctrl.onKeydown(e)}
	onblur={() => ctrl.onWindowBlur()}
/>

<div class="bg-background text-foreground flex h-full min-h-0 flex-col overflow-hidden">
	<TitleBar {ctrl} saving={props.saving} saveFile={props.saveFile} />

	<!-- `flex-row-reverse` docks the panel on the right edge (VS Code's "move
       primary side bar right"); the editor column keeps the rest. -->
	<div
		bind:this={layout.shellEl}
		class="flex min-h-0 flex-1 {layout.sidebarRight ? 'flex-row-reverse' : ''}"
	>
		<!-- Collapses by width, not unmounting, so panel state survives a toggle. -->
		<div
			class="shrink-0 overflow-hidden {PANEL_EASE} {layout.resizingSidebar
				? 'transition-none'
				: 'transition-[width]'} {layout.panelCollapsed ? 'pointer-events-none' : ''}"
			style:width={layout.panelCollapsed ? '0px' : `${layout.sidebarWidth}px`}
			aria-hidden={layout.panelCollapsed}
		>
			<SidePanel
				view={layout.activeView}
				files={files.files}
				folders={files.extraFolders}
				recent={files.recentFiles}
				activeId={files.activeId}
				mainId={files.mainId}
				source={files.source}
				cursorLine={layout.cursor.line}
				projectName={files.displayName}
				projectPath={files.projectRoot}
				head={files.head}
				hasProject={files.hasProject}
				engine={ctrl.engine}
				git={files.git}
				gitRoot={files.scmRoot}
				onopendiff={(path, staged) => layout.openDiff(path, staged)}
				activeDiffPath={layout.diffTarget?.path ?? null}
				widthPx={layout.sidebarWidth}
				onopen={(id) => files.openFile(id)}
				onnew={() => files.newFile()}
				onnewfolder={() => files.newFolder()}
				onopenfolder={ctrl.canOpenFolder ? () => ctrl.openFolder() : undefined}
				onopenproject={ctrl.onOpenProject}
				onopensourcecontrol={() => layout.selectView('git')}
				onselectview={(v) => layout.selectView(v)}
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
				oncreate={(rel, kind) => files.createAt(rel, kind)}
				onmoveitems={(items, dir) => files.moveItems(items, dir)}
				ondeleteitems={(items) => files.deleteItems(items)}
				onduplicatefile={(id) => files.duplicateFile(id)}
				oncopypath={(rel) => ctrl.copyPath(rel)}
				ondownloadfile={ctrl.onDownload ? (id) => ctrl.downloadFile(id) : undefined}
				ondownloadfolder={ctrl.onDownload ? (p) => ctrl.downloadFolder(p) : undefined}
				dirtyIds={files.dirtyIds}
				scope={files.projectRoot ?? files.displayName}
				ongotoline={(n) => ctrl.goToLine(n)}
				onregistershell={files.project?.registerShellIntegration
					? () => files.registerShell()
					: undefined}
				searchResult={search.projectResult}
				searchHits={search.projectHits}
				searchActive={search.projectActive}
				searchScanning={search.projectScanning}
				searchCollapsed={search.collapsedGroups}
				ontogglegroup={(id) => search.toggleGroup(id)}
				onsearch={(o) => search.queueProjectSearch(o)}
				ongotoresult={(i) => search.gotoHit(i)}
				onsearchnext={() => search.projectNext()}
				onsearchprev={() => search.projectPrev()}
				onreplacecurrent={(r) => search.replaceHit(r)}
				onreplaceall={(r) => ctrl.replaceAllInProject(r)}
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
		<main bind:this={layout.mainEl} class="flex min-h-0 min-w-0 flex-1 flex-col">
			<!-- Above the Visual/LaTeX split: a mode is a lens on one file, so "which
			     file" must not change its answer (or its position) when you switch. -->
			<Toolbar {ctrl} />

			<div class="flex min-h-0 min-w-0 flex-1">
				<div class="flex min-h-0 min-w-0 flex-1 flex-col">
					<div
						bind:this={layout.bodyEl}
						id="glyphtex-doc-surface"
						role="tabpanel"
						aria-label={files.activeFile?.name ?? 'Document'}
						class="flex min-h-0 min-w-0 flex-1 {ctrl.docMode === 'latex' &&
						layout.viewMode === 'split' &&
						layout.splitDir === 'vertical'
							? 'flex-col'
							: ''}"
					>
						{#if ctrl.docMode === 'visual'}
							<VisualPane {ctrl} />
						{:else}
							{#if layout.viewMode !== 'preview'}
								<EditorPane {ctrl} />
							{/if}

							{#if layout.viewMode === 'split'}
								{@const stacked = layout.splitDir === 'vertical'}
								<div
									class="group relative z-10 flex shrink-0 touch-none items-center justify-center {stacked
										? 'h-1 w-full cursor-row-resize'
										: 'w-1 cursor-col-resize'}"
									role="separator"
									aria-orientation={stacked ? 'horizontal' : 'vertical'}
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

							{#if layout.viewMode !== 'editor'}
								<PreviewPane {ctrl} />
							{/if}
						{/if}
					</div>

					{#if compile.showProblems}
						<div
							class="group border-border relative z-10 flex h-1 shrink-0 cursor-row-resize touch-none items-center justify-center border-t"
							role="separator"
							aria-orientation="horizontal"
							aria-label="Resize panel"
							tabindex="-1"
							onpointerdown={() => layout.startDockResize()}
						>
							<span
								class="h-0.5 w-10 rounded-full transition-colors {layout.resizingDock
									? 'bg-primary'
									: 'bg-transparent group-hover:bg-primary/60'}"
							></span>
						</div>
					{/if}
					<!-- Collapses by height, not unmounting, so the dock animates and keeps its
           tab + scroll position across a toggle. The inner box holds the real
           height so the content doesn't reflow while the outer one animates. -->
					<div
						class="shrink-0 overflow-hidden {PANEL_EASE} {layout.resizingDock
							? 'transition-none'
							: 'transition-[height]'} {compile.showProblems ? '' : 'pointer-events-none'}"
						style:height={compile.showProblems ? `${layout.dockH}px` : '0px'}
						aria-hidden={!compile.showProblems}
					>
						<div class="flex" style:height={`${layout.dockH}px`}>
							<BottomDock {ctrl} />
						</div>
					</div>
				</div>

				<RightPanel {ctrl} />
			</div>
		</main>
	</div>
</div>

<CommandPalette
	bind:open={layout.paletteOpen}
	files={files.files}
	commands={ctrl.commands}
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
