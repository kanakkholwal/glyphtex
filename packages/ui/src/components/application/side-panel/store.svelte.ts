import { activeOutlineRow, baseLevel, buildOutlineRows, parseOutline, sectionAt } from '../outline';
import { canDropInto, droppable, getDrag, setDrag, type DndItem } from '../file-dnd';
import type { ActivityView } from './types';
import type { TreeNode } from '../file-tree.svelte';

import { isGeneratedFile } from '../file-kinds';
import { settings } from '@glyphtex/ui/settings';
import {
	buildTree,
	collectFolderPaths,
	filterTree,
	flattenTree,
	hideGenerated,
	rowKeyToSel,
	type TreeRow
} from './tree';
import { treeState } from './tree-state.svelte';
import type { FileMeta, SearchOptions, Sel } from './types';

export type SidePanelDeps = {
	getView: () => ActivityView;
	getFiles: () => FileMeta[];
	getFolders: () => string[];
	getActiveId: () => string;
	getSource: () => string;
	getCursorLine: () => number;
	getProjectName: () => string;
	getDirtyIds: () => Set<string>;
	/** Stable key for this document's persisted folder state. */
	getScope: () => string;
	onopen?: (id: string) => void;
	onnew?: () => void;
	onnewfolder?: () => void;
	onnewfilein?: (dir: string) => void;
	onnewfolderin?: (dir: string) => void;
	/** Create at a full relative path, named in the tree before it exists. */
	oncreate?: (rel: string, kind: 'file' | 'folder') => void;
	ondeletefile?: (id: string) => void;
	ondeletefolder?: (path: string) => void;
	onmovefile?: (id: string, targetDir: string) => void;
	onmovefolder?: (path: string, targetDir: string) => void;
	/** Batch move. Runs sequentially upstream: each item can raise its own
	 *  name-conflict prompt, and parallel prompts would stack. */
	onmoveitems?: (items: Sel[], targetDir: string) => void;
	/** Batch delete behind a single confirmation. */
	ondeleteitems?: (items: Sel[]) => void;
	onduplicatefile?: (id: string) => void;
	onsearch?: (o: SearchOptions) => void;
	onregistershell?: () => void | Promise<boolean>;
};

/** UI state for the side panel's views. Reactive inputs arrive as getters so the store
 *  always reads the parent's live props. */
export class SidePanelStore {
	readonly #d: SidePanelDeps;

	// --- Source Control header (refresh + state reported by GitPanel) ----------
	gitRefreshKey = $state(0);
	gitState = $state<{ isRepo: boolean; loading: boolean }>({
		isRepo: false,
		loading: false
	});

	// --- Explorer tree ---------------------------------------------------------
	rootExpanded = $state(true);
	outlineExpanded = $state(true);
	/** Folded outline subtrees, keyed by heading rather than index so an edit
	 *  above them does not shuffle what is open. */
	outlineClosed = $state<Record<string, boolean>>({});
	recentExpanded = $state(true);
	rootDragOver = $state(false);
	/** Substring filter over the tree. Distinct from the Search view, which lists
	 *  matches found *inside* files. */
	treeFilter = $state('');
	/** A row being named before the file or folder exists. */
	draft = $state<{ dir: string; kind: 'file' | 'folder' } | null>(null);
	/** Row the keyboard focus sits on. One tab stop for the whole tree. */
	focusedKey = $state<string | null>(null);

	// --- Settings: shell-integration button feedback ---------------------------
	shellStatus = $state<'idle' | 'busy' | 'done'>('idle');

	// --- Find / replace form ---------------------------------------------------
	query = $state('');
	replace = $state('');
	matchCase = $state(false);
	wholeWord = $state(false);
	useRegex = $state(false);
	preserveCase = $state(false);
	showReplace = $state(false);
	resultsCollapsed = $state(false);
	searchInputEl = $state<HTMLInputElement>();

	constructor(deps: SidePanelDeps) {
		this.#d = deps;
	}

	// --- Derived ---------------------------------------------------------------
	// The inputs (view / files / source / …) arrive through the constructor-set
	// `#d`, so the views that read it are getters (not `$derived` fields) to avoid
	// referencing `#d` before its initialization. They still read reactive props.
	get heading(): string {
		const view = this.#d.getView();
		return view === 'files'
			? 'Project'
			: view === 'search'
				? 'Search'
				: view === 'git'
					? 'Source Control'
					: 'Settings';
	}

	get rootNodes(): TreeNode[] {
		return buildTree(this.#d.getFiles(), this.#d.getFolders());
	}

	/** Rows as rendered. A filter forces everything open: hits are useless behind
	 *  a folder you would have to expand to see them. */
	get rows(): TreeRow[] {
		const filtering = this.treeFilter.trim().length > 0;
		let nodes = settings.hideGenerated
			? hideGenerated(this.rootNodes, this.#d.getActiveId())
			: this.rootNodes;
		if (filtering) nodes = filterTree(nodes, this.treeFilter);
		return flattenTree(
			nodes,
			filtering ? () => true : (path) => treeState.isOpen(path),
			this.#d.getDirtyIds()
		);
	}

	/** How many rows the "hide generated" preference is currently folding away. */
	get generatedCount(): number {
		return this.#d.getFiles().filter((f) => isGeneratedFile(f.name)).length;
	}

	// --- Selection -------------------------------------------------------------
	get selectedKeys(): string[] {
		return treeState.selectedKeys;
	}
	/** The row actions act on: the last one picked. */
	get selected(): Sel | null {
		const last = treeState.selectedKeys.at(-1);
		return last ? rowKeyToSel(last) : null;
	}
	set selected(value: Sel | null) {
		treeState.selectedKeys = value
			? [value.type === 'folder' ? `d:${value.path}` : `f:${value.id}`]
			: [];
		treeState.anchor = treeState.selectedKeys[0] ?? null;
	}
	/** Every selected row, for batch move and delete. */
	get selection(): Sel[] {
		return treeState.selectedKeys.map(rowKeyToSel);
	}
	isSelected(key: string): boolean {
		return treeState.selectedKeys.includes(key);
	}

	// Fall back to the open file when nothing was explicitly clicked.
	get effectiveSel(): Sel | null {
		return (
			this.selected ?? (this.#d.getActiveId() ? { type: 'file', id: this.#d.getActiveId() } : null)
		);
	}
	get selectedFolderPath(): string | null {
		const sel = this.selected;
		return sel?.type === 'folder' ? sel.path : null;
	}

	/**
	 * Pick a row. Ctrl/Cmd adds or removes one; Shift takes the range from the
	 * anchor through `key`, measured in rendered order so it matches what you see.
	 */
	pick(key: string, mods: { meta?: boolean; shift?: boolean } = {}): void {
		if (mods.shift && treeState.anchor) {
			const order = this.rows.map((r) => r.key);
			const from = order.indexOf(treeState.anchor);
			const to = order.indexOf(key);
			if (from !== -1 && to !== -1) {
				const [lo, hi] = from < to ? [from, to] : [to, from];
				treeState.selectedKeys = order.slice(lo, hi + 1);
				this.focusedKey = key;
				return;
			}
		}
		if (mods.meta) {
			treeState.selectedKeys = treeState.selectedKeys.includes(key)
				? treeState.selectedKeys.filter((k) => k !== key)
				: [...treeState.selectedKeys, key];
			treeState.anchor = key;
			this.focusedKey = key;
			return;
		}
		treeState.selectedKeys = [key];
		treeState.anchor = key;
		this.focusedKey = key;
	}

	// Directory new items land in: the selected folder, the selected file's
	// parent, or '' (project root).
	get targetDir(): string {
		const s = this.effectiveSel;
		if (!s) return '';
		if (s.type === 'folder') return s.path;
		const name = this.#d.getFiles().find((f) => f.id === s.id)?.name ?? '';
		const i = name.lastIndexOf('/');
		return i === -1 ? '' : name.slice(0, i);
	}

	// Outline (sectioning): pure derive from the active file's text. Fields, not
	// getters, so a 20k-line parse runs once per edit rather than once per read.
	// They read `#d` through accessors: TS rejects a field initializer that names
	// a private the constructor has not assigned yet.
	get #source(): string {
		return this.#d.getSource();
	}
	get #cursorLine(): number {
		return this.#d.getCursorLine();
	}
	readonly outline = $derived(parseOutline(this.#source));
	readonly outlineBase = $derived(baseLevel(this.outline));
	/** Section the caret sits in, so the outline says where you *are*, not only
	 *  where you could go. -1 above the first heading. */
	readonly outlineActive = $derived(sectionAt(this.outline, this.#cursorLine));
	readonly outlineRows = $derived(
		buildOutlineRows(this.outline, this.outlineBase, this.outlineClosed)
	);
	readonly outlineActiveRow = $derived(activeOutlineRow(this.outlineRows, this.outlineActive));

	toggleOutlineNode(key: string): void {
		this.outlineClosed = { ...this.outlineClosed, [key]: !this.outlineClosed[key] };
	}

	readonly folderPaths = $derived(collectFolderPaths(this.rootNodes));
	readonly anyFolderOpen = $derived(this.folderPaths.some((p) => this.isPathOpen(p)));

	/** Worth its 28px once you cannot take the project in at a glance: either too
	 *  many files to scan, or nesting deep enough to hide them. */
	get showTreeFilter(): boolean {
		if (!this.rootNodes.length) return false;
		return this.#d.getFiles().length >= 8 || this.folderPaths.some((p) => p.includes('/'));
	}

	// The file the matches belong to (search runs over the active document).
	get activeFileName(): string {
		const name = this.#d.getFiles().find((f) => f.id === this.#d.getActiveId())?.name ?? '';
		const i = name.lastIndexOf('/');
		return (i === -1 ? name : name.slice(i + 1)) || this.#d.getProjectName();
	}

	readonly findOptions = $derived([
		{
			key: 'case',
			label: 'Aa',
			title: 'Match case',
			on: this.matchCase,
			toggle: () => {
				this.matchCase = !this.matchCase;
				this.emitSearch();
			}
		},
		{
			key: 'word',
			label: 'W',
			title: 'Whole word',
			on: this.wholeWord,
			toggle: () => {
				this.wholeWord = !this.wholeWord;
				this.emitSearch();
			}
		},
		{
			key: 'regex',
			label: '.*',
			title: 'Regular expression',
			on: this.useRegex,
			toggle: () => {
				this.useRegex = !this.useRegex;
				this.emitSearch();
			}
		}
	]);

	// --- Explorer actions ------------------------------------------------------
	isPathOpen(p: string): boolean {
		return treeState.isOpen(p);
	}
	toggleFolder(path: string): void {
		treeState.toggle(path);
	}
	/** Expand only. Selecting a folder used to toggle it, so there was no way to
	 *  target a folder for "New file" without collapsing the thing you aimed at. */
	openFolder(path: string): void {
		if (!treeState.isOpen(path)) treeState.set(path, true);
	}
	/** Fold every sibling of `path`, leaving one branch open (⌥click a chevron). */
	collapseSiblings(path: string): void {
		const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
		const siblings = this.folderPaths.filter((p) => {
			if (p === path) return false;
			const at = p.lastIndexOf('/');
			return (at === -1 ? '' : p.slice(0, at)) === parent;
		});
		treeState.setMany(siblings, false);
		treeState.set(path, true);
	}
	selectFile(id: string): void {
		this.selected = { type: 'file', id };
		this.#d.onopen?.(id);
	}
	selectFolder(path: string): void {
		this.selected = { type: 'folder', path };
	}
	/** Scroll the open file into view, expanding whatever hides it. */
	revealActive(): void {
		const id = this.#d.getActiveId();
		const file = this.#d.getFiles().find((f) => f.id === id);
		if (!file) return;
		treeState.revealPath(file.name);
		this.treeFilter = '';
		this.selected = { type: 'file', id };
		this.focusedKey = `f:${id}`;
	}
	createFileHere(): void {
		this.startDraft('file');
	}
	createFolderHere(): void {
		this.startDraft('folder');
	}
	/** Name it in the tree first, then create it. Creating an "Untitled" and then
	 *  renaming it was two steps, and left a stray file if you changed your mind. */
	startDraft(kind: 'file' | 'folder', dir = this.targetDir): void {
		if (dir) treeState.set(dir, true);
		this.treeFilter = '';
		this.draft = { dir, kind };
	}
	commitDraft(name: string): void {
		const draft = this.draft;
		this.draft = null;
		const leaf = name.trim();
		if (!draft || !leaf) return;
		this.#d.oncreate?.(draft.dir ? `${draft.dir}/${leaf}` : leaf, draft.kind);
	}
	deleteSelected(): void {
		const items = this.selection.length
			? this.selection
			: this.effectiveSel
				? [this.effectiveSel]
				: [];
		if (!items.length) return;
		if (this.#d.ondeleteitems) this.#d.ondeleteitems(items);
		else if (items[0].type === 'folder') this.#d.ondeletefolder?.(items[0].path);
		else this.#d.ondeletefile?.(items[0].id);
		this.selected = null;
	}
	duplicateSelected(): void {
		const sel = this.effectiveSel;
		if (sel?.type === 'file') this.#d.onduplicatefile?.(sel.id);
	}
	/** Create inside `dir` specifically, whatever is selected. */
	newFileIn(dir: string): void {
		this.startDraft('file', dir);
	}
	newFolderIn(dir: string): void {
		this.startDraft('folder', dir);
	}
	toggleCollapseAll(): void {
		const collapse = this.anyFolderOpen; // any open → collapse all, else expand all
		treeState.setMany(this.folderPaths, !collapse);
	}

	// --- Drops -----------------------------------------------------------------
	dragOverRoot(e: DragEvent): void {
		if (!getDrag().length) return;
		const ok = canDropInto('');
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = ok ? 'move' : 'none';
		this.rootDragOver = ok;
	}
	rootDrop(e: DragEvent): void {
		e.preventDefault();
		this.rootDragOver = false;
		this.dropInto('');
	}
	/** Move whatever is being dragged into `dir`, skipping the items that cannot. */
	dropInto(dir: string): void {
		const items = droppable(dir);
		setDrag(null);
		if (!items.length) return;
		const sel: Sel[] = items.map((it) =>
			it.kind === 'file' ? { type: 'file', id: it.id } : { type: 'folder', path: it.path }
		);
		if (this.#d.onmoveitems) this.#d.onmoveitems(sel, dir);
		else if (items[0].kind === 'file') this.#d.onmovefile?.(items[0].id, dir);
		else this.#d.onmovefolder?.(items[0].path, dir);
	}
	/** Payload for a drag started on `key`: the whole selection when the grabbed
	 *  row is part of it, else just that row. */
	dragPayload(key: string): DndItem[] {
		const keys = this.isSelected(key) && this.selectedKeys.length > 1 ? this.selectedKeys : [key];
		const files = this.#d.getFiles();
		return keys.map((k) => {
			const sel = rowKeyToSel(k);
			if (sel.type === 'folder')
				return { kind: 'folder', path: sel.path, name: sel.path.split('/').pop() ?? sel.path };
			const name = files.find((f) => f.id === sel.id)?.name ?? sel.id;
			return { kind: 'file', id: sel.id, name };
		});
	}

	// --- Settings: shell integration -------------------------------------------
	async addShellIntegration(): Promise<void> {
		if (this.shellStatus === 'busy' || !this.#d.onregistershell) return;
		this.shellStatus = 'busy';
		const ok = await this.#d.onregistershell();
		this.shellStatus = ok ? 'done' : 'idle';
	}

	// --- Search ----------------------------------------------------------------
	emitSearch(): void {
		this.#d.onsearch?.({
			query: this.query,
			replace: this.replace,
			caseSensitive: this.matchCase,
			wholeWord: this.wholeWord,
			regexp: this.useRegex,
			preserveCase: this.preserveCase
		});
	}
	refreshResults(): void {
		if (this.query) this.emitSearch();
	}
	clearSearchView(): void {
		this.query = '';
		this.emitSearch(); // empty query → host clears matches + highlight
		this.resultsCollapsed = false;
		this.searchInputEl?.focus();
	}
	togglePreserveCase(): void {
		this.preserveCase = !this.preserveCase;
		this.emitSearch();
	}
}
