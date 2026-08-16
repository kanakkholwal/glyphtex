<script lang="ts">
	import { settings } from '@glyphtex/ui/settings';
	import { IconGitBranch } from '@tabler/icons-svelte';
	import { cubicOut } from 'svelte/easing';
	import { MediaQuery } from 'svelte/reactivity';
	import { fly } from 'svelte/transition';

	import type { EngineManager } from './engine-settings.svelte';
	import GitPanel, { type GitHeadInfo, type GitProvider } from './git-panel.svelte';
	import ExplorerView from './side-panel/explorer-view.svelte';
	import OutlineView from './side-panel/outline-view.svelte';
	import PanelHeader from './side-panel/panel-header.svelte';
	import PanelSection from './side-panel/panel-section.svelte';
	import RecentView from './side-panel/recent-view.svelte';
	import ScmFooter from './side-panel/scm-footer.svelte';
	import SearchView from './side-panel/search-view.svelte';
	import { SidePanelStore } from './side-panel/store.svelte';
	import { treeState } from './side-panel/tree-state.svelte';
	import type { ActivityView, FileMeta, SearchOptions, Sel } from './side-panel/types';
	import { EMPTY_SCAN, type Hit, type ScanResult } from './workbench/project-search';

	/**
	 * SidePanel: content for the active rail view. Explorer stacks the file tree,
	 * the document outline and recently closed files; Settings edits the live
	 * preferences; Search is a full find/replace panel wired to the editor; Source
	 * Control is the Git view. Local UI state + behaviour live in
	 * {@link SidePanelStore}; each view is its own component.
	 */
	let {
		view = 'files',
		files = [],
		folders = [],
		recent = [],
		activeId = '',
		mainId = null,
		projectName = 'Project',
		projectPath = null,
		head = null,
		hasProject = false,
		widthPx = 300,
		source = '',
		cursorLine = 1,
		scope = '',
		engine,
		git,
		gitRoot = null,
		onopendiff,
		activeDiffPath = null,
		dirtyIds = new Set(),
		onopen,
		onnew,
		onnewfolder,
		onopenfolder,
		onopenproject,
		onreveal,
		onaddfiles,
		onrenamefile,
		ondeletefile,
		onsetmain,
		onmovefile,
		onmovefolder,
		onrenamefolder,
		ondeletefolder,
		onnewfilein,
		onnewfolderin,
		oncreate,
		onmoveitems,
		ondeleteitems,
		onduplicatefile,
		oncopypath,
		ondownloadfile,
		ondownloadfolder,
		ongotoline,
		onregistershell,
		searchResult = EMPTY_SCAN,
		searchHits = [],
		searchActive = 0,
		searchScanning = false,
		searchCollapsed = {},
		ontogglegroup,
		onsearch,
		ongotoresult,
		onsearchnext,
		onsearchprev,
		onreplacecurrent,
		onreplaceall,
		onopensourcecontrol,
		onselectview
	}: {
		view?: ActivityView;
		files?: FileMeta[];
		/** Extra (possibly empty) folder paths to show in the tree, forward-slashed. */
		folders?: string[];
		/** Files opened earlier that no longer have a tab. */
		recent?: FileMeta[];
		activeId?: string;
		/** Absolute path / id of the project's main (compile-target) file. */
		mainId?: string | null;
		projectName?: string;
		/** Absolute folder backing the document (desktop); shown under the root row. */
		projectPath?: string | null;
		/** Where HEAD is, for the panel footer. Null hides it. */
		head?: GitHeadInfo | null;
		/** Whether a folder-based project host is available (enables Open Folder). */
		hasProject?: boolean;
		widthPx?: number;
		/** Active file's text: drives the Outline (sectioning) view. */
		source?: string;
		/** Where the caret is, so the Outline can mark the section you are in. */
		cursorLine?: number;
		/** Stable key for this document's persisted folder state. */
		scope?: string;
		engine?: EngineManager;
		/** Host-injected Git backend. Enables the Source Control view. */
		git?: GitProvider;
		/** Repository root the Git backend operates on: the open folder on desktop,
		 *  a virtual working-tree path on web. */
		gitRoot?: string | null;
		/** Open a changed file's diff in the editor pane (Source Control click). */
		onopendiff?: (path: string, staged: boolean) => void;
		/** Path currently shown in the editor's diff view, to highlight its row. */
		activeDiffPath?: string | null;
		/** Ids of files with unsaved edits (shown as "modified" dots in the tree). */
		dirtyIds?: Set<string>;
		onopen?: (id: string) => void;
		onnew?: () => void;
		onnewfolder?: () => void;
		onopenfolder?: () => void;
		/** Switch to another document (web routes to its list). Absent hides the item. */
		onopenproject?: () => void;
		/** Reveal the open project folder in the OS file manager. Absent = unavailable. */
		onreveal?: () => void;
		/** Import files from disk into the open document (web projects). */
		onaddfiles?: (accept: string) => void;
		onrenamefile?: (id: string, name: string) => void;
		ondeletefile?: (id: string) => void;
		onsetmain?: (id: string) => void;
		/** Move a file into `targetDir` ('' = root). */
		onmovefile?: (id: string, targetDir: string) => void;
		/** Move a folder into `targetDir` ('' = root). */
		onmovefolder?: (path: string, targetDir: string) => void;
		/** Rename a folder: receives the new leaf name. */
		onrenamefolder?: (path: string, name: string) => void;
		ondeletefolder?: (path: string) => void;
		/** Create a new file inside `dir`. */
		onnewfilein?: (dir: string) => void;
		/** Create a new subfolder inside `dir`. */
		onnewfolderin?: (dir: string) => void;
		/** Create at a full relative path, named in the tree before it exists. */
		oncreate?: (rel: string, kind: 'file' | 'folder') => void;
		/** Batch move; runs sequentially so conflict prompts cannot stack. */
		onmoveitems?: (items: Sel[], targetDir: string) => void;
		/** Batch delete behind one confirmation. */
		ondeleteitems?: (items: Sel[]) => void;
		onduplicatefile?: (id: string) => void;
		/** Copy a file or folder's project-relative path. */
		oncopypath?: (rel: string) => void;
		/** Save one file to disk. Omitted hides the Explorer's Download item. */
		ondownloadfile?: (id: string) => void;
		/** Save a folder as a .zip. Omitted hides the Explorer's Download item. */
		ondownloadfolder?: (path: string) => void;
		/** Jump the editor to a 1-based line (Outline click). */
		ongotoline?: (line: number) => void;
		/** Register the OS "Open with GlyphTeX" folder integration (desktop). */
		onregistershell?: () => void | Promise<boolean>;
		/** Grouped project-search results. */
		searchResult?: ScanResult;
		/** The same matches flattened, for prev/next and the active index. */
		searchHits?: Hit[];
		searchActive?: number;
		searchScanning?: boolean;
		/** Result groups the user folded, by file id. */
		searchCollapsed?: Record<string, boolean>;
		ontogglegroup?: (id: string) => void;
		onsearch?: (o: SearchOptions) => void;
		ongotoresult?: (i: number) => void;
		onsearchnext?: () => void;
		onsearchprev?: () => void;
		onreplacecurrent?: (replace: string) => void;
		onreplaceall?: (replace: string) => void;
		/** Footer click: switch the panel to Source Control. */
		onopensourcecontrol?: () => void;
		/** Change which view the panel shows (the header's tabs). */
		onselectview?: (view: ActivityView) => void;
	} = $props();

	// Views slide toward the tab you picked, so the panel reads as one strip you
	// are moving along rather than three unrelated screens.
	const ORDER: ActivityView[] = ['files', 'search', 'git'];
	const reduced = new MediaQuery('prefers-reduced-motion: reduce');
	let dir = $state(1);
	// Without a Git backend the Changes tab is hidden, so a persisted `git` view
	// would strand the panel on an empty state with no tab to leave by.
	$effect(() => {
		if (view === 'git' && !(git && gitRoot)) onselectview?.('files');
	});

	// Deliberately the initial value: this only ever tracks the *previous* view so
	// the next change knows which way to slide.
	// svelte-ignore state_referenced_locally
	let lastView: ActivityView = view;
	$effect(() => {
		const to = ORDER.indexOf(view);
		const from = ORDER.indexOf(lastView);
		if (to === from) return;
		dir = to > from ? 1 : -1;
		lastView = view;
	});
	const shift = $derived(reduced.current ? 0 : 14);
	const enter = $derived(reduced.current ? 0 : 190);
	const leave = $derived(reduced.current ? 0 : 90);

	// The store reads the live props through getters and wraps the host callbacks.
	// svelte-ignore state_referenced_locally
	const store = new SidePanelStore({
		getView: () => view,
		getFiles: () => files,
		getFolders: () => folders,
		getActiveId: () => activeId,
		getSource: () => source,
		getCursorLine: () => cursorLine,
		getProjectName: () => projectName,
		getDirtyIds: () => dirtyIds,
		getScope: () => scope || projectName,
		onopen,
		onnew,
		onnewfolder,
		onnewfilein,
		onnewfolderin,
		oncreate,
		ondeletefile,
		ondeletefolder,
		onmovefile,
		onmovefolder,
		onmoveitems,
		ondeleteitems,
		onduplicatefile,
		onsearch,
		onregistershell
	});

	// Folder state is per document. Loading it here (not in the constructor) means
	// opening another project swaps the tree instead of inheriting the last one's.
	$effect(() => treeState.load(scope || projectName));
</script>

<aside
	class="bg-sidebar border-sidebar-border flex h-full min-h-0 shrink-0 flex-col {settings.sidebarPosition ===
	'right'
		? 'border-l'
		: 'border-r'}"
	style:width={`${widthPx}px`}
	aria-label={store.heading}
>
	<PanelHeader
		{store}
		{view}
		{hasProject}
		hasNewFolder={Boolean(onnewfolder || onnewfolderin)}
		hasDelete={Boolean(ondeletefile || ondeletefolder)}
		gitReady={Boolean(git && gitRoot)}
		searchResultCount={searchResult.total}
		{onselectview}
		{onreveal}
		{onopenfolder}
		{onopenproject}
		{onaddfiles}
	/>

	<!-- One grid cell holds both the outgoing and incoming view, so the crossfade
	     cannot push the panel's height around mid-transition. -->
	<div class="grid min-h-0 flex-1 overflow-hidden pt-2">
		{#key view}
			<div
				data-panel-scroll
				class="col-start-1 row-start-1 min-h-0 overflow-x-hidden overflow-y-auto px-1.5 pb-2 text-sm"
				in:fly={{ x: dir * shift, duration: enter, delay: leave, easing: cubicOut, opacity: 0 }}
				out:fly={{ x: -dir * shift, duration: leave, easing: cubicOut, opacity: 0 }}
			>
				{#if view === 'files'}
					<ExplorerView
						{store}
						{projectName}
						{projectPath}
						{activeId}
						{mainId}
						{onrenamefile}
						{onsetmain}
						{onrenamefolder}
						{ondownloadfile}
						{ondownloadfolder}
						{oncopypath}
					/>

					<!-- Outline and Recent live under the tree rather than behind rail tabs:
           in a thesis you navigate by section far more often than by file. -->
					<PanelSection
						title="Outline"
						bind:open={store.outlineExpanded}
						count={store.outline.length}
					>
						<OutlineView {store} {ongotoline} />
					</PanelSection>

					{#if recent.length}
						<PanelSection title="Recent" bind:open={store.recentExpanded}>
							<RecentView files={recent} onopen={(id) => store.selectFile(id)} />
						</PanelSection>
					{/if}
				{:else if view === 'search'}
					<SearchView
						{store}
						result={searchResult}
						hits={searchHits}
						activeHit={searchActive}
						scanning={searchScanning}
						collapsed={searchCollapsed}
						{ontogglegroup}
						{onsearchnext}
						{onsearchprev}
						{ongotoresult}
						{onreplacecurrent}
						{onreplaceall}
					/>
				{:else if view === 'git'}
					{#if git}
						<GitPanel
							{git}
							root={gitRoot}
							refreshKey={store.gitRefreshKey}
							onstatechange={(s) => (store.gitState = s)}
							{onopendiff}
							{activeDiffPath}
						/>
					{:else}
						<div
							class="text-muted-foreground flex flex-col items-center gap-2 px-2 py-8 text-center text-xs"
						>
							<IconGitBranch size={22} />
							<p>Source control isn't available here.</p>
						</div>
					{/if}
				{/if}
			</div>
		{/key}
	</div>

	{#if view !== 'git'}
		<ScmFooter {head} onopen={() => onopensourcecontrol?.()} />
	{/if}
</aside>
