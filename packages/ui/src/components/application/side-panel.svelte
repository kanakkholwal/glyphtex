<script lang="ts">
	import { Button } from '@glyphx/ui/button';
	import { Segmented } from '@glyphx/ui/segmented';
	import { Separator } from '@glyphx/ui/separator';
	import {
	  EDITOR_FONT_LABELS,
	  settings,
	  type Appearance,
	  type EditorFont,
	  type LatexGrammar
	} from '@glyphx/ui/settings';
	import { SettingsField } from '@glyphx/ui/settings-field';
	import { Switch } from '@glyphx/ui/switch';
	import {
	  IconChevronDown,
	  IconChevronRight,
	  IconChevronUp,
	  IconFilePlus,
	  IconFileText,
	  IconFold,
	  IconFolderOpen,
	  IconFolderPlus,
	  IconFolderShare,
	  IconFolders,
	  IconGitBranch,
	  IconList,
	  IconMinus,
	  IconPlus,
	  IconRefresh,
	  IconReplace,
	  IconReplaceFilled,
	  IconSearchOff,
	  IconTrash
	} from '@tabler/icons-svelte';
	import { cubicOut } from 'svelte/easing';
	import { slide } from 'svelte/transition';
	import type { ActivityView } from './activity-bar.svelte';
	import EngineSettings, { type EngineManager } from './engine-settings.svelte';
	import { canDropInto, getDrag, setDrag } from './file-dnd';
	import FileTree, { type TreeNode } from './file-tree.svelte';
	import GitPanel, { type GitProvider } from './git-panel.svelte';
	import { baseLevel, parseOutline } from './outline';
	import { SEARCH_BTN, SEARCH_COUNT, SEARCH_INPUT, searchPill } from './search-ui';

	type FileMeta = { id: string; name: string };
	type SearchOptions = {
		query: string;
		replace?: string;
		caseSensitive?: boolean;
		wholeWord?: boolean;
		regexp?: boolean;
		preserveCase?: boolean;
	};
	type SearchMatch = { from: number; to: number; line: number; column: number; text: string };

	/**
	 * SidePanel — content for the active rail view. Explorer switches files;
	 * Settings edits the live preferences (Segmented choices + Mac-style
	 * switches). Search is a full find/replace panel wired to the editor. Git is
	 * a placeholder.
	 */
	let {
		view = 'files',
		files = [],
		folders = [],
		activeId = '',
		mainId = null,
		projectName = 'Project',
		hasProject = false,
		widthPx = 240,
		source = '',
		engine,
		git,
		projectRoot = null,
		onopen,
		onnew,
		onnewfolder,
		onopenfolder,
		onreveal,
		onrenamefile,
		ondeletefile,
		onsetmain,
		onmovefile,
		onmovefolder,
		onrenamefolder,
		ondeletefolder,
		onnewfilein,
		onnewfolderin,
		ongotoline,
		onregistershell,
		searchResults = [],
		searchActive = 0,
		onsearch,
		ongotoresult,
		onsearchnext,
		onsearchprev,
		onreplacecurrent,
		onreplaceall
	}: {
		view?: ActivityView;
		files?: FileMeta[];
		/** Extra (possibly empty) folder paths to show in the tree, forward-slashed. */
		folders?: string[];
		activeId?: string;
		/** Absolute path / id of the project's main (compile-target) file. */
		mainId?: string | null;
		projectName?: string;
		/** Whether a folder-based project host is available (enables Open Folder). */
		hasProject?: boolean;
		widthPx?: number;
		/** Active file's text — drives the Outline (sectioning) view. */
		source?: string;
		engine?: EngineManager;
		/** Host-injected Git backend (desktop). Enables the Source Control view. */
		git?: GitProvider;
		/** Absolute path of the open project folder, for Git operations. */
		projectRoot?: string | null;
		onopen?: (id: string) => void;
		onnew?: () => void;
		onnewfolder?: () => void;
		onopenfolder?: () => void;
		/** Reveal the open project folder in the OS file manager. Absent = unavailable. */
		onreveal?: () => void;
		onrenamefile?: (id: string, name: string) => void;
		ondeletefile?: (id: string) => void;
		onsetmain?: (id: string) => void;
		/** Move a file into `targetDir` ('' = root). */
		onmovefile?: (id: string, targetDir: string) => void;
		/** Move a folder into `targetDir` ('' = root). */
		onmovefolder?: (path: string, targetDir: string) => void;
		/** Rename a folder — receives the new leaf name. */
		onrenamefolder?: (path: string, name: string) => void;
		ondeletefolder?: (path: string) => void;
		/** Create a new file inside `dir`. */
		onnewfilein?: (dir: string) => void;
		/** Create a new subfolder inside `dir`. */
		onnewfolderin?: (dir: string) => void;
		/** Jump the editor to a 1-based line (Outline click). */
		ongotoline?: (line: number) => void;
		/** Register the OS "Open with GlyphX" folder integration (desktop). */
		onregistershell?: () => void;
		searchResults?: SearchMatch[];
		searchActive?: number;
		onsearch?: (o: SearchOptions) => void;
		ongotoresult?: (i: number) => void;
		onsearchnext?: () => void;
		onsearchprev?: () => void;
		onreplacecurrent?: (replace: string) => void;
		onreplaceall?: (replace: string) => void;
	} = $props();

	const heading = $derived(
		view === 'files'
			? 'Explorer'
			: view === 'search'
				? 'Search'
				: view === 'git'
					? 'Source Control'
					: 'Settings'
	);

	// --- Source Control header actions (refresh + view toggle live here, next to
	// the heading, like the Explorer/Search views). GitPanel reports its state
	// back so we can show/disable the buttons; bumping the key forces a refresh.
	let gitRefreshKey = $state(0);
	let gitState = $state<{ isRepo: boolean; loading: boolean }>({ isRepo: false, loading: false });

	// Folder-based project tree — file names split on "/" nest into folders.
	// `extraFolders` injects folders that have no files yet (freshly created),
	// so an empty folder still appears. Folders sort before files, alphabetically.
	function buildTree(items: FileMeta[], extraFolders: string[] = []): TreeNode[] {
		const root: TreeNode[] = [];
		const folderChildren = new Map<string, TreeNode[]>();

		function ensureFolder(path: string): TreeNode[] {
			let level = root;
			let cur = '';
			for (const part of path.split('/')) {
				if (!part) continue;
				cur = cur ? `${cur}/${part}` : part;
				let children = folderChildren.get(cur);
				if (!children) {
					children = [];
					folderChildren.set(cur, children);
					level.push({ type: 'folder', name: part, path: cur, children });
				}
				level = children;
			}
			return level;
		}

		for (const f of items) {
			const parts = f.name.split('/');
			const leaf = parts.pop() ?? f.name;
			const level = parts.length ? ensureFolder(parts.join('/')) : root;
			level.push({ type: 'file', id: f.id, name: leaf });
		}
		for (const p of extraFolders) if (p) ensureFolder(p);

		function sort(nodes: TreeNode[]) {
			nodes.sort((a, b) =>
				a.type !== b.type
					? a.type === 'folder'
						? -1
						: 1
					: a.name.localeCompare(b.name, undefined, { numeric: true })
			);
			for (const n of nodes) if (n.type === 'folder') sort(n.children);
		}
		sort(root);
		return root;
	}
	// Root files live at the root (VS Code style); only real subfolders nest.
	const rootNodes = $derived<TreeNode[]>(buildTree(files, folders));
	let treeOpen = $state<Record<string, boolean>>({});
	let rootExpanded = $state(true);

	// --- Explorer selection (VS Code style) -----------------------------------
	// One thing is "selected" at a time: a file or a folder. Clicking sets it.
	// New-file / New-folder / Delete in the header all act on this selection, so
	// creating happens *inside* the selected folder (or next to the selected
	// file), and Delete removes exactly what's highlighted.
	type Sel = { type: 'file'; id: string } | { type: 'folder'; path: string };
	let selected = $state<Sel | null>(null);

	// Fall back to the open file when nothing was explicitly clicked, so the
	// header always has a sensible target.
	const effectiveSel = $derived<Sel | null>(
		selected ?? (activeId ? { type: 'file', id: activeId } : null)
	);
	const selectedFolderPath = $derived(selected?.type === 'folder' ? selected.path : null);

	// Directory new items land in: the selected folder, the selected file's
	// parent, or '' (project root).
	const targetDir = $derived.by(() => {
		const s = effectiveSel;
		if (!s) return '';
		if (s.type === 'folder') return s.path;
		const name = files.find((f) => f.id === s.id)?.name ?? '';
		const i = name.lastIndexOf('/');
		return i === -1 ? '' : name.slice(0, i);
	});

	function selectFile(id: string) {
		selected = { type: 'file', id };
		onopen?.(id);
	}
	function selectFolder(path: string) {
		selected = { type: 'folder', path };
	}
	function createFileHere() {
		const dir = targetDir;
		if (dir) treeOpen[dir] = true;
		if (onnewfilein) onnewfilein(dir);
		else onnew?.();
	}
	function createFolderHere() {
		const dir = targetDir;
		if (dir) treeOpen[dir] = true;
		if (onnewfolderin) onnewfolderin(dir);
		else onnewfolder?.();
	}
	function deleteSelected() {
		const s = effectiveSel;
		if (!s) return;
		if (s.type === 'folder') ondeletefolder?.(s.path);
		else ondeletefile?.(s.id);
		selected = null;
	}

	// --- Outline (sectioning) — pure derive from the active file's text. ---
	const outline = $derived(parseOutline(source));
	const outlineBase = $derived(baseLevel(outline));
	let outlineExpanded = $state(true);

	// --- Collapse / expand all folders. Flat walk over the derived tree; the
	// button only shows when there's at least one folder to act on. ---
	function collectFolderPaths(nodes: TreeNode[], acc: string[] = []): string[] {
		for (const n of nodes)
			if (n.type === 'folder') {
				acc.push(n.path);
				collectFolderPaths(n.children, acc);
			}
		return acc;
	}
	const folderPaths = $derived(collectFolderPaths(rootNodes));
	const isPathOpen = (p: string) => treeOpen[p] ?? true;
	const anyFolderOpen = $derived(folderPaths.some(isPathOpen));
	function toggleCollapseAll() {
		const collapse = anyFolderOpen; // any open → collapse all, else expand all
		const next: Record<string, boolean> = { ...treeOpen };
		for (const p of folderPaths) next[p] = !collapse;
		treeOpen = next;
	}

	// --- Drop onto the project root (move an item out to the top level). ---
	let rootDragOver = $state(false);
	function rootDragOverHandler(e: DragEvent) {
		if (!getDrag()) return;
		const ok = canDropInto('');
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = ok ? 'move' : 'none';
		rootDragOver = ok;
	}
	function rootDrop(e: DragEvent) {
		e.preventDefault();
		rootDragOver = false;
		const it = getDrag();
		setDrag(null);
		if (!it || !canDropInto('')) return;
		if (it.kind === 'file') onmovefile?.(it.id, '');
		else onmovefolder?.(it.path, '');
	}

	const appearanceOpts: { value: Appearance; label: string }[] = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'system', label: 'System' }
	];
	const grammarOpts: { value: LatexGrammar; label: string }[] = [
		{ value: 'legacy', label: 'stex' },
		{ value: 'lezer', label: 'lezer' }
	];
	const fontOpts = (Object.keys(EDITOR_FONT_LABELS) as EditorFont[]).map((id) => ({
		value: id,
		label: EDITOR_FONT_LABELS[id]
	}));

	// --- Find / replace (wired to the editor via callbacks) ---
	let query = $state('');
	let replace = $state('');
	let matchCase = $state(false);
	let wholeWord = $state(false);
	let useRegex = $state(false);
	let preserveCase = $state(false);
	let showReplace = $state(false);
	let resultsCollapsed = $state(false);
	let searchInputEl = $state<HTMLInputElement>();

	function emitSearch() {
		onsearch?.({
			query,
			replace,
			caseSensitive: matchCase,
			wholeWord,
			regexp: useRegex,
			preserveCase
		});
	}

	// The file the matches belong to (search runs over the active document).
	const activeFileName = $derived.by(() => {
		const name = files.find((f) => f.id === activeId)?.name ?? '';
		const i = name.lastIndexOf('/');
		return (i === -1 ? name : name.slice(i + 1)) || projectName;
	});

	// Header actions for the Search view (VS Code parity).
	function refreshResults() {
		if (query) emitSearch();
	}
	function clearSearchView() {
		query = '';
		emitSearch(); // empty query → host clears matches + highlight
		resultsCollapsed = false;
		searchInputEl?.focus();
	}
	const findOptions = $derived([
		{
			key: 'case',
			label: 'Aa',
			title: 'Match case',
			on: matchCase,
			toggle: () => {
				matchCase = !matchCase;
				emitSearch();
			}
		},
		{
			key: 'word',
			label: 'W',
			title: 'Whole word',
			on: wholeWord,
			toggle: () => {
				wholeWord = !wholeWord;
				emitSearch();
			}
		},
		{
			key: 'regex',
			label: '.*',
			title: 'Regular expression',
			on: useRegex,
			toggle: () => {
				useRegex = !useRegex;
				emitSearch();
			}
		}
	]);

	function onSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (e.shiftKey) onsearchprev?.();
			else onsearchnext?.();
		}
	}

	// Autofocus the field when the Search view opens (e.g. via Ctrl/Cmd+F).
	$effect(() => {
		if (view === 'search') searchInputEl?.focus();
	});
</script>

<aside
	class="bg-card border-border flex h-full min-h-0 shrink-0 flex-col border-r"
	style:width={`${widthPx}px`}
	aria-label={heading}
>
	<div
		class="text-muted-foreground flex h-9 shrink-0 items-center justify-between px-3 text-xs font-medium tracking-wider uppercase"
	>
		<span>{heading}</span>
		{#if view === 'files'}
			<div class="-mr-1 flex items-center gap-0.5">
				<button
					class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
					title={targetDir ? `New file in ${targetDir}` : 'New file'}
					aria-label="New file"
					onclick={createFileHere}
				>
					<IconFilePlus size={15} />
				</button>
				{#if onnewfolder || onnewfolderin}
					<button
						class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
						title={targetDir ? `New folder in ${targetDir}` : 'New folder'}
						aria-label="New folder"
						onclick={createFolderHere}
					>
						<IconFolderPlus size={15} />
					</button>
				{/if}
				{#if ondeletefile || ondeletefolder}
					<button
						class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors disabled:opacity-40"
						title={effectiveSel
							? effectiveSel.type === 'folder'
								? 'Delete selected folder'
								: 'Delete selected file'
							: 'Delete'}
						aria-label="Delete selected"
						disabled={!effectiveSel}
						onclick={deleteSelected}
					>
						<IconTrash size={15} />
					</button>
				{/if}
				{#if folderPaths.length}
					<button
						class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
						title={anyFolderOpen ? 'Collapse all folders' : 'Expand all folders'}
						aria-label={anyFolderOpen ? 'Collapse all folders' : 'Expand all folders'}
						onclick={toggleCollapseAll}
					>
						<IconFold size={15} />
					</button>
				{/if}
				{#if onreveal}
					<!-- A project is open: reveal it in the OS file manager. Opening a
					     different project stays on ⌘/Ctrl+O and the File menu. -->
					<button
						class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
						title="Reveal in file explorer"
						aria-label="Reveal in file explorer"
						onclick={() => onreveal?.()}
					>
						<IconFolderShare size={15} />
					</button>
				{:else if hasProject}
					<button
						class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
						title="Open folder (⌘/Ctrl+O)"
						aria-label="Open folder"
						onclick={() => onopenfolder?.()}
					>
						<IconFolderOpen size={15} />
					</button>
				{/if}
			</div>
		{:else if view === 'search'}
			<div class="-mr-1 flex items-center gap-0.5">
				<button
					class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors disabled:opacity-40"
					title="Refresh results"
					aria-label="Refresh results"
					disabled={!query}
					onclick={refreshResults}
				>
					<IconRefresh size={15} />
				</button>
				<button
					class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors disabled:opacity-40"
					title="Clear search"
					aria-label="Clear search"
					disabled={!query}
					onclick={clearSearchView}
				>
					<IconSearchOff size={15} />
				</button>
				<button
					class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors disabled:opacity-40"
					title={resultsCollapsed ? 'Expand results' : 'Collapse results'}
					aria-label={resultsCollapsed ? 'Expand results' : 'Collapse results'}
					aria-pressed={resultsCollapsed}
					disabled={!searchResults.length}
					onclick={() => (resultsCollapsed = !resultsCollapsed)}
				>
					<IconFold size={15} />
				</button>
			</div>
		{:else if view === 'git' && git && projectRoot && gitState.isRepo}
			<div class="-mr-1 flex items-center gap-0.5">
				<button
					class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
					title={settings.gitView === 'tree' ? 'View as list' : 'View as tree'}
					aria-label={settings.gitView === 'tree' ? 'View as list' : 'View as tree'}
					onclick={() => (settings.gitView = settings.gitView === 'tree' ? 'list' : 'tree')}
				>
					{#if settings.gitView === 'tree'}<IconList size={15} />{:else}<IconFolders size={15} />{/if}
				</button>
				<button
					class="hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors disabled:opacity-40"
					title="Refresh"
					aria-label="Refresh"
					disabled={gitState.loading}
					onclick={() => (gitRefreshKey += 1)}
				>
					<IconRefresh size={15} />
				</button>
			</div>
		{/if}
	</div>

	<div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1.5 pb-2 text-[13px]">
		{#if view === 'files'}
			<!-- Workspace root header (the project / directory name, VS Code style).
			     Doubles as a drop target to move items out to the top level. -->
			<button
				class="text-foreground flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold tracking-wide uppercase transition-colors {rootDragOver
					? 'bg-brand-subtle ring-brand/40 ring-1 ring-inset'
					: 'hover:bg-muted/60'}"
				aria-expanded={rootExpanded}
				ondragover={rootDragOverHandler}
				ondragleave={() => (rootDragOver = false)}
				ondrop={rootDrop}
				onclick={() => (rootExpanded = !rootExpanded)}
			>
				<IconChevronRight
					size={13}
					class="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] {rootExpanded
						? 'rotate-90'
						: ''}"
				/>
				<span class="truncate">{projectName}</span>
			</button>
			{#if rootExpanded}
				<div transition:slide={{ duration: 200, easing: cubicOut }}>
					<FileTree
						nodes={rootNodes}
						{activeId}
						{mainId}
						selectedPath={selectedFolderPath}
						bind:open={treeOpen}
						onopen={selectFile}
						onselectfolder={selectFolder}
						onrename={(id, name) => onrenamefile?.(id, name)}
						ondelete={(id) => ondeletefile?.(id)}
						onsetmain={hasProject ? (id) => onsetmain?.(id) : undefined}
						{onmovefile}
						{onmovefolder}
						{onrenamefolder}
						{ondeletefolder}
						onnewfilein={(dir) => {
							treeOpen[dir] = true;
							onnewfilein?.(dir);
						}}
						onnewfolderin={(dir) => {
							treeOpen[dir] = true;
							onnewfolderin?.(dir);
						}}
					/>
				</div>
			{/if}

			<!-- Outline — the active file's sectioning structure (table of contents). -->
			<div class="mt-2 border-t border-border/60 pt-1.5">
				<button
					class="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold tracking-wide uppercase transition-colors"
					aria-expanded={outlineExpanded}
					onclick={() => (outlineExpanded = !outlineExpanded)}
				>
					<IconChevronRight
						size={13}
						class="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] {outlineExpanded
							? 'rotate-90'
							: ''}"
					/>
					<IconList size={14} class="shrink-0 opacity-70" />
					<span class="truncate">Outline</span>
				</button>
				{#if outlineExpanded}
					<div transition:slide={{ duration: 200, easing: cubicOut }}>
						{#if outline.length}
							<ul class="flex flex-col pb-1">
								{#each outline as item, i (i)}
									<li>
										<button
											class="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-1.5 rounded py-0.5 pr-2 text-left transition-colors"
											style:padding-left={`${(item.level - outlineBase) * 12 + 12}px`}
											title={item.title}
											onclick={() => ongotoline?.(item.line)}
										>
											<span
												class="bg-muted-foreground/30 size-1 shrink-0 rounded-full"
											></span>
											<span class="truncate text-[13px]">{item.title}</span>
										</button>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="text-muted-foreground/60 px-3 py-1.5 text-[11px]">
								No sections found. Add <span class="font-mono">\section&#123;…&#125;</span> headings to
								build an outline.
							</p>
						{/if}
					</div>
				{/if}
			</div>
		{:else if view === 'search'}
			<div class="flex flex-col gap-1 pt-0.5">
				<div class="flex items-start gap-0.5">
					<button
						class="{SEARCH_BTN} mt-0.5 shrink-0"
						title={showReplace ? 'Hide replace' : 'Toggle replace'}
						aria-label="Toggle replace"
						aria-expanded={showReplace}
						onclick={() => (showReplace = !showReplace)}
					>
						<IconChevronRight
							size={15}
							class="transition-transform duration-200 {showReplace ? 'rotate-90' : ''}"
						/>
					</button>

					<div class="flex min-w-0 flex-1 flex-col gap-1">
						<!-- Find — toggles live inside the field (VS Code parity) -->
						<div class="relative">
							<input
								bind:this={searchInputEl}
								bind:value={query}
								oninput={emitSearch}
								onkeydown={onSearchKeydown}
								class="{SEARCH_INPUT} w-full pr-[4.75rem]"
								placeholder="Find"
								aria-label="Find in document"
								spellcheck="false"
							/>
							<div class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
								{#each findOptions as opt (opt.key)}
									<button
										class={searchPill(opt.on)}
										title={opt.title}
										aria-label={opt.title}
										aria-pressed={opt.on}
										onclick={opt.toggle}
									>
										{opt.label}
									</button>
								{/each}
							</div>
						</div>

						<!-- Replace — preserve-case toggle lives inside the field (VS Code
						     parity); replace / replace-all sit alongside it. -->
						{#if showReplace}
							<div class="flex items-center gap-1">
								<div class="relative min-w-0 flex-1">
									<input
										bind:value={replace}
										class="{SEARCH_INPUT} w-full pr-7"
										placeholder={useRegex ? 'Replace ($1, $&…)' : 'Replace'}
										aria-label="Replace with"
										spellcheck="false"
									/>
									<div class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
										<button
											class={searchPill(preserveCase)}
											title="Preserve case"
											aria-label="Preserve case"
											aria-pressed={preserveCase}
											onclick={() => {
												preserveCase = !preserveCase;
												emitSearch();
											}}
										>
											AB
										</button>
									</div>
								</div>
								<button
									class="{SEARCH_BTN} shrink-0"
									title="Replace next match"
									aria-label="Replace next match"
									disabled={!searchResults.length}
									onclick={() => onreplacecurrent?.(replace)}
								>
									<IconReplace size={15} />
								</button>
								<button
									class="{SEARCH_BTN} shrink-0"
									title="Replace all matches"
									aria-label="Replace all matches"
									disabled={!searchResults.length}
									onclick={() => onreplaceall?.(replace)}
								>
									<IconReplaceFilled size={15} />
								</button>
							</div>
						{/if}
					</div>
				</div>

				<!-- Results header: match count + navigation, attached to the list. -->
				{#if query}
					<div class="flex items-center gap-1 px-0.5">
						<span class={SEARCH_COUNT}>
							{#if searchResults.length}
								{searchActive + 1} of {searchResults.length}
							{:else}
								No results
							{/if}
						</span>
						<button
							class="{SEARCH_BTN} ml-auto"
							title="Previous match (Shift+Enter)"
							aria-label="Previous match"
							disabled={!searchResults.length}
							onclick={() => onsearchprev?.()}
						>
							<IconChevronUp size={15} />
						</button>
						<button
							class={SEARCH_BTN}
							title="Next match (Enter)"
							aria-label="Next match"
							disabled={!searchResults.length}
							onclick={() => onsearchnext?.()}
						>
							<IconChevronDown size={15} />
						</button>
					</div>
				{/if}

				<!-- Results — grouped under the active file, collapsible (VS Code parity). -->
				{#if query && searchResults.length}
					<div class="mt-1">
						<button
							class="text-muted-foreground hover:bg-muted/60 flex w-full items-center gap-1 rounded px-1 py-1 text-left transition-colors"
							aria-expanded={!resultsCollapsed}
							onclick={() => (resultsCollapsed = !resultsCollapsed)}
						>
							<IconChevronRight
								size={13}
								class="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] {resultsCollapsed
									? ''
									: 'rotate-90'}"
							/>
							<IconFileText size={14} class="shrink-0" />
							<span class="text-foreground truncate text-[13px] font-medium">{activeFileName}</span>
						</button>
						{#if !resultsCollapsed}
							<ul class="flex flex-col">
								{#each searchResults.slice(0, 500) as m, i (i)}
									<li>
										<button
											class="flex w-full items-baseline gap-1.5 rounded py-0.5 pr-2 pl-6 text-left transition-colors {i ===
											searchActive
												? 'bg-accent text-accent-foreground'
												: 'hover:bg-muted text-muted-foreground'}"
											onclick={() => ongotoresult?.(i)}
											title={`Line ${m.line}`}
										>
											<span class="text-muted-foreground/50 w-7 shrink-0 text-right font-mono text-[10px] tabular-nums">
												{m.line}
											</span>
											<span class="truncate font-mono text-[11px]">{m.text.trim() || ' '}</span>
										</button>
									</li>
								{/each}
							</ul>
							{#if searchResults.length > 500}
								<p class="text-muted-foreground/60 px-2 text-[11px]">
									Showing first 500 of {searchResults.length}.
								</p>
							{/if}
						{/if}
					</div>
				{:else if !query}
					<p class="text-muted-foreground/70 mt-1 px-1.5 text-[11px]">
						Find &amp; replace in the active file.
					</p>
				{/if}
			</div>
		{:else if view === 'git'}
			{#if git}
				<GitPanel
					{git}
					root={projectRoot}
					refreshKey={gitRefreshKey}
					onstatechange={(s) => (gitState = s)}
				/>
			{:else}
				<div
					class="text-muted-foreground flex flex-col items-center gap-2 px-2 py-8 text-center text-xs"
				>
					<IconGitBranch size={22} />
					<p>Source control isn't available here.</p>
				</div>
			{/if}
		{:else}
			<!-- Settings — same SettingsField / Separator primitives as the
			     /settings route, in the compact (sm) size. -->
			<div class="flex flex-col gap-3 px-1 pt-0.5 pb-2">
				<SettingsField size="sm" label="Appearance">
					<Segmented
						options={appearanceOpts}
						value={settings.appearance}
						onValueChange={(v) => (settings.appearance = v)}
						size="sm"
						aria-label="Appearance"
					/>
				</SettingsField>

				<SettingsField size="sm" label="LaTeX grammar">
					<Segmented
						options={grammarOpts}
						value={settings.grammar}
						onValueChange={(v) => (settings.grammar = v)}
						size="sm"
						aria-label="LaTeX grammar"
					/>
				</SettingsField>

				<SettingsField size="sm" label="Editor font">
					<Segmented
						options={fontOpts}
						value={settings.font}
						onValueChange={(v) => (settings.font = v)}
						size="sm"
						aria-label="Editor font"
					/>
				</SettingsField>

				<SettingsField size="sm" label="Editor font size" layout="row">
					<div class="flex items-center gap-1">
						<Button
							variant="outline"
							size="icon-sm"
							aria-label="Decrease font size"
							disabled={settings.fontSize <= 10}
							onclick={() => (settings.fontSize = Math.max(10, settings.fontSize - 1))}
						>
							<IconMinus size={15} />
						</Button>
						<span class="text-foreground w-9 text-center text-[13px] tabular-nums">
							{settings.fontSize}px
						</span>
						<Button
							variant="outline"
							size="icon-sm"
							aria-label="Increase font size"
							disabled={settings.fontSize >= 24}
							onclick={() => (settings.fontSize = Math.min(24, settings.fontSize + 1))}
						>
							<IconPlus size={15} />
						</Button>
					</div>
				</SettingsField>

				<Separator />

				<SettingsField size="sm" label="Line wrapping" layout="row">
					<Switch
						checked={settings.lineWrapping}
						onCheckedChange={(v) => (settings.lineWrapping = v)}
						aria-label="Line wrapping"
					/>
				</SettingsField>

				<SettingsField
					size="sm"
					label="Live compile"
					description="Recompile as you type"
					layout="row"
				>
					<Switch
						checked={settings.autoCompile}
						onCheckedChange={(v) => (settings.autoCompile = v)}
						aria-label="Live compile"
					/>
				</SettingsField>

				{#if engine}
					<EngineSettings {engine} />
				{/if}

				{#if onregistershell}
					<Separator />
					<SettingsField
						size="sm"
						label="System integration"
						description="Add an “Open with GlyphX” entry to the folder right-click menu. (.tex and .glyx files are associated by the installer.)"
					>
						<Button
							variant="outline"
							size="xs"
							class="self-start"
							onclick={() => onregistershell?.()}
						>
							Add “Open with GlyphX”
						</Button>
					</SettingsField>
				{/if}
			</div>
		{/if}
	</div>
</aside>
