import type { ActivityView } from '../side-panel/types';
import { classifyFile, editorLanguage } from '../file-kinds';
import type { GitProvider } from '../git-panel.svelte';
import { PersistedState } from '@glyphtex/ui/persisted-state';
import { settings } from '@glyphtex/ui/settings';
import { toast } from '@glyphtex/ui/sonner';

import { GEOMETRY, LAYOUT_KEYS, PREFERENCE, TAB_CONTEXT } from './layout-storage';

import type {
	DiffTarget,
	DockTab,
	DocMode,
	EditorApi,
	RightPanel,
	SplitDirection,
	ViewMode
} from './types';

export type LayoutDeps = {
	git?: GitProvider;
	getProjectRoot: () => string | null;
};

const DOCK_MIN_PX = 120;

/** The Workbench's chrome + geometry, plus the editor `bind:this` handle shared with
 *  the search and compile stores. The component calls {@link observeShell}. */
export class LayoutStore {
	readonly #git?: GitProvider;
	readonly #getProjectRoot: () => string | null;

	// Persisted chrome. Storage area per field is decided in `layout-storage.ts`.
	#activeView = new PersistedState<ActivityView>(LAYOUT_KEYS.activeView, 'files', TAB_CONTEXT);
	#panelCollapsed = new PersistedState<boolean>(LAYOUT_KEYS.panelCollapsed, false, TAB_CONTEXT);
	#docMode = new PersistedState<DocMode>(LAYOUT_KEYS.docMode, 'latex', TAB_CONTEXT);
	#viewMode = new PersistedState<ViewMode>(LAYOUT_KEYS.viewMode, 'split', TAB_CONTEXT);
	#dockTab = new PersistedState<DockTab>(LAYOUT_KEYS.dockTab, 'problems', TAB_CONTEXT);
	#rightPanel = new PersistedState<RightPanel>(LAYOUT_KEYS.rightPanel, 'none', TAB_CONTEXT);
	#splitDir = new PersistedState<SplitDirection>(LAYOUT_KEYS.splitDir, 'horizontal', PREFERENCE);
	#thumbsOpen = new PersistedState<boolean>(LAYOUT_KEYS.thumbsOpen, true, PREFERENCE);
	#splitPct = new PersistedState<number>(LAYOUT_KEYS.splitPct, 52, GEOMETRY);
	#sidebarW = new PersistedState<number>(LAYOUT_KEYS.sidebarW, 300, GEOMETRY);
	#dockH = new PersistedState<number>(LAYOUT_KEYS.dockH, 224, GEOMETRY);

	get activeView(): ActivityView {
		return this.#activeView.current;
	}
	set activeView(value: ActivityView) {
		this.#activeView.current = value;
	}

	get panelCollapsed(): boolean {
		return this.#panelCollapsed.current;
	}
	set panelCollapsed(value: boolean) {
		this.#panelCollapsed.current = value;
	}

	/** Which editor you are in. `viewMode` only applies inside `latex`. */
	get docMode(): DocMode {
		return this.#docMode.current;
	}
	set docMode(value: DocMode) {
		this.#docMode.current = value;
	}

	get viewMode(): ViewMode {
		return this.#viewMode.current;
	}
	set viewMode(value: ViewMode) {
		this.#viewMode.current = value;
	}

	// Editor handle (bound from CodeEditor), shared with search + compile.
	editor = $state<EditorApi>();

	/** A source range the LaTeX view should reveal once its editor exists. Set
	 *  when jumping from a visual block, which unmounts the editor as it switches. */
	revealSpan = $state<{ from: number; to: number } | null>(null);

	/** Apply and clear a queued reveal. Called by the editor pane on mount.
	 *  Held until the editor is actually ready: it is bound before its module
	 *  finishes loading, and calling early would drop the reveal silently. */
	flushReveal(): void {
		const span = this.revealSpan;
		const editor = this.editor;
		if (!span || !editor || editor.ready?.() === false) return;
		this.revealSpan = null;
		editor.selectRange(span.from, span.to);
	}
	// Whether the editor currently has anything to undo / redo (bound from CodeEditor).
	canUndo = $state(false);
	canRedo = $state(false);

	cursor = $state({ line: 1, column: 1 });

	// Help / quick-open dialogs.
	paletteOpen = $state(false);
	aboutOpen = $state(false);
	shortcutsOpen = $state(false);

	// --- Diff view ------------------------------------------------------------
	diffTarget = $state<DiffTarget | null>(null);

	// --- Resizable split ------------------------------------------------------
	// Live during a drag, flushed to storage in `stopResize`: writing per pointer
	// move would hit synchronous localStorage on every frame.
	/** Size of the editor pane, as a % of the split axis. */
	splitPct = $state(52);
	/** `horizontal` = side by side; `vertical` = editor above, preview below. */
	get splitDir(): SplitDirection {
		return this.#splitDir.current;
	}
	set splitDir(value: SplitDirection) {
		this.#splitDir.current = value;
	}
	dragging = $state(false);
	bodyEl = $state<HTMLElement>();

	// --- Resizable sidebar (drag the edge; capped at 30% of the shell width) --
	shellEl = $state<HTMLElement>();
	shellW = $state(2560);
	sidebarW = $state(300);
	resizingSidebar = $state(false);

	// --- Bottom dock (Problems / Logs / History) ------------------------------
	get dockTab(): DockTab {
		return this.#dockTab.current;
	}
	set dockTab(value: DockTab) {
		this.#dockTab.current = value;
	}
	dockH = $state(224);
	resizingDock = $state(false);
	mainEl = $state<HTMLElement>();

	// --- Right column (Notes / Settings) --------------------------------------
	// One column for both. Settings used to be a left-rail view and Notes its own
	// docked column; between them they cost two rail entries and two layouts.
	get rightPanel(): RightPanel {
		return this.#rightPanel.current;
	}
	set rightPanel(value: RightPanel) {
		this.#rightPanel.current = value;
	}

	get notesOpen(): boolean {
		return this.rightPanel === 'notes';
	}
	set notesOpen(open: boolean) {
		this.rightPanel = open ? 'notes' : 'none';
	}

	toggleRightPanel(panel: Exclude<RightPanel, 'none'>): void {
		this.rightPanel = this.rightPanel === panel ? 'none' : panel;
	}

	/** PDF thumbnail rail, on the preview's outer edge. */
	get thumbsOpen(): boolean {
		return this.#thumbsOpen.current;
	}
	set thumbsOpen(value: boolean) {
		this.#thumbsOpen.current = value;
	}

	constructor(deps: LayoutDeps) {
		this.#git = deps.git;
		this.#getProjectRoot = deps.getProjectRoot;

		this.splitPct = this.#splitPct.current;
		this.sidebarW = this.#sidebarW.current;
		this.dockH = this.#dockH.current;
	}

	readonly maxSidebar = $derived(Math.max(200, Math.round(this.shellW * 0.3)));
	readonly sidebarWidth = $derived(Math.min(this.sidebarW, this.maxSidebar));
	// VS Code-style: the activity bar + side panel can dock on either edge.
	readonly sidebarRight = $derived(settings.sidebarPosition === 'right');

	readonly diffLanguage = $derived(
		this.diffTarget ? editorLanguage(classifyFile(this.diffTarget.path)) : 'plain'
	);

	/** Observe the shell width so the sidebar cap tracks the window. Called from
	 *  the component inside a `$effect`; returns its cleanup. */
	observeShell(): (() => void) | void {
		if (!this.shellEl || typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver(() => {
			if (this.shellEl) this.shellW = this.shellEl.getBoundingClientRect().width;
		});
		ro.observe(this.shellEl);
		return () => ro.disconnect();
	}

	startResize(): void {
		if (this.viewMode === 'split') this.dragging = true;
	}
	startSidebarResize(): void {
		this.resizingSidebar = true;
	}
	startDockResize(): void {
		this.resizingDock = true;
	}
	onPointerMove(e: PointerEvent): void {
		if (this.resizingDock && this.mainEl) {
			const rect = this.mainEl.getBoundingClientRect();
			// Leave room for the toolbar + a usable editor above the dock.
			const max = Math.max(DOCK_MIN_PX, rect.height - 180);
			this.dockH = Math.min(max, Math.max(DOCK_MIN_PX, rect.bottom - e.clientY));
			return;
		}
		if (this.resizingSidebar && this.shellEl) {
			const rect = this.shellEl.getBoundingClientRect();
			// Docked right, the panel grows as the cursor moves left, so measure from
			// the opposite edge.
			const w = this.sidebarRight ? rect.right - e.clientX : e.clientX - rect.left;
			this.sidebarW = Math.min(this.maxSidebar, Math.max(200, w));
			return;
		}
		if (!this.dragging || this.viewMode !== 'split' || !this.bodyEl) return;
		const rect = this.bodyEl.getBoundingClientRect();
		const pct =
			this.splitDir === 'vertical'
				? ((e.clientY - rect.top) / rect.height) * 100
				: ((e.clientX - rect.left) / rect.width) * 100;
		this.splitPct = Math.min(72, Math.max(28, pct));
	}
	stopResize(): void {
		if (this.dragging) this.#splitPct.current = this.splitPct;
		if (this.resizingSidebar) this.#sidebarW.current = this.sidebarW;
		if (this.resizingDock) this.#dockH.current = this.dockH;
		this.dragging = false;
		this.resizingSidebar = false;
		this.resizingDock = false;
	}

	/** Switch the panel's view. Collapsing is the title bar's toggle: the tabs
	 *  live *inside* the panel now, so clicking one can't also close it. */
	selectView(view: ActivityView): void {
		this.activeView = view;
		this.panelCollapsed = false;
	}

	// --- Diff (VS Code-style read-only comparison over the editor pane) -------
	async openDiff(path: string, staged: boolean): Promise<void> {
		const root = this.#getProjectRoot();
		if (!this.#git || !root) return;
		try {
			const v = await this.#git.fileVersions(root, path, staged);
			this.diffTarget = { path, staged, ...v };
			// Reveal the editor pane: neither the PDF nor the visual surface has one.
			this.docMode = 'latex';
			if (this.viewMode === 'preview') this.viewMode = 'split';
		} catch (e) {
			toast.error(`Could not open diff: ${e}`);
		}
	}
	closeDiff(): void {
		this.diffTarget = null;
	}
	async refreshDiff(): Promise<void> {
		if (this.diffTarget) await this.openDiff(this.diffTarget.path, this.diffTarget.staged);
	}
}
