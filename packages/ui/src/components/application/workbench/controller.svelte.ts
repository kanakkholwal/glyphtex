import type { EngineManager } from '../engine-settings.svelte';
import type { GitProvider } from '../git-panel.svelte';
import type { PaletteCommand } from '../command-palette.svelte';
import type { ProjectHost } from '../project';
import { matchShortcut, shortcutLabel } from '../shortcuts';
import { settings } from '@glyphtex/ui/settings';
import { toast } from '@glyphtex/ui/sonner';

import { CompileStore } from './compile.svelte';
import { FileStore } from './files.svelte';
import { LayoutStore } from './layout.svelte';
import { NotesStore } from './notes.svelte';
import { baseName } from './paths';
import { SearchStore } from './search.svelte';
import type {
	CompileFilesFn,
	CompileFn,
	CompileProjectFn,
	DocMode,
	GlyphFile,
	Menu,
	MenuAction,
	SaveFileFn
} from './types';

/** A file or folder the user asked to save out of the workbench. */
export type DownloadRequest = {
	kind: 'file' | 'folder';
	/** Suggested download name: the leaf; a folder arrives zipped. */
	name: string;
	/** Project-relative paths to include. */
	paths: string[];
	/** Folder requests only: the folder's path, so the host can re-root the zip. */
	root?: string;
};

export type WorkbenchProps = {
	platform?: 'web' | 'desktop';
	compile?: CompileFn;
	/** Compile a multi-file project on disk (desktop), so `\input` /
	 *  `\includegraphics` / `\bibliography` resolve. */
	compileProject?: CompileProjectFn;
	/** In-memory multi-file compile (web projects); same resolution, no disk. */
	compileFiles?: CompileFilesFn;
	engine?: EngineManager;
	/** Host-injected Git backend (desktop = gitoxide, web = isomorphic-git). Enables
	 *  Source Control. */
	git?: GitProvider;
	/** Repository root when there is no folder project: web passes its virtual
	 *  working-tree path so Source Control works without a folder on disk. */
	gitRoot?: string | null;
	/** Host-injected file save (desktop = Tauri dialog + fs). Browser download on web. */
	saveFile?: SaveFileFn;
	/** Switch documents. Desktop opens a folder; web routes to its document list. */
	onOpenProject?: () => void;
	/** Open a folder as a document. Falls back to the ProjectHost picker (desktop). */
	onOpenFolder?: () => void;
	/** Import an archive as a new document. Falls back to the ProjectHost (desktop). */
	onImportProject?: () => void;
	/** Folder-based project bridge (desktop = Tauri fs / zip). Absent on web. */
	project?: ProjectHost;
	/** A folder / `.tex` / `.glyx` path to open on mount (file-association launch). */
	openPathOnMount?: string;
	/** Workspace name shown in the command centre / explorer. */
	projectName?: string;
	/** Stable id for per-document local state (notes). Falls back to the folder /
	 *  display name, which moves if the document is renamed. */
	documentId?: string;
	/** Files to open with (a project's files). Defaults to a demo document. */
	initialFiles?: GlyphFile[];
	/** Called (debounced) whenever files change, so the host can persist. */
	onpersist?: (files: GlyphFile[]) => void;
	/** Small free-text note shown in the status bar (e.g. web package server). */
	statusNote?: string;
	/** Persistence indicator shown beside the document name. */
	saving?: boolean;
	/** Handed the controller once, so a host can drive the file store directly. */
	onready?: (ctrl: WorkbenchController) => void;
	/** Back link in the header (web: the documents list). */
	backHref?: string;
	backLabel?: string;
	/** Rename the open document from the header (web projects). */
	onRenameProject?: (name: string) => void;
	/** Add files/images from disk into the open document (web projects). */
	onAddFiles?: (accept: string) => void | Promise<string[]>;
	/** Export the whole document as a .zip (web projects). */
	onExportProject?: () => void;
	/** Read a file's bytes for the asset viewer: keyed by `path` on desktop and
	 *  by the project-relative name on web. Absent = assets can't be previewed. */
	readFileBytes?: (key: string) => Promise<Uint8Array>;
	/** Save a file / folder out of the Explorer. Absent hides the menu item. */
	onDownload?: (req: DownloadRequest) => void;
};

export class WorkbenchController {
	readonly platform: 'web' | 'desktop';
	readonly statusNote?: string;
	readonly engine?: EngineManager;
	readonly backHref?: string;
	readonly backLabel?: string;
	readonly onRenameProject?: (name: string) => void;
	readonly onAddFiles?: (accept: string) => void | Promise<string[]>;
	readonly onExportProject?: () => void;
	readonly onOpenProject?: () => void;
	readonly #onOpenFolder?: () => void;
	readonly #onImportProject?: () => void;
	readonly readFileBytes?: (key: string) => Promise<Uint8Array>;
	readonly onDownload?: (req: DownloadRequest) => void;

	readonly files: FileStore;
	readonly layout: LayoutStore;
	readonly search: SearchStore;
	readonly compile: CompileStore;
	readonly notes: NotesStore;

	readonly #onpersist?: (files: GlyphFile[]) => void;
	readonly #openPathOnMount?: string;

	constructor(props: WorkbenchProps) {
		this.platform = props.platform ?? 'web';
		this.statusNote = props.statusNote;
		this.engine = props.engine;
		this.backHref = props.backHref;
		this.backLabel = props.backLabel;
		this.onRenameProject = props.onRenameProject;
		this.onAddFiles = props.onAddFiles;
		this.onExportProject = props.onExportProject;
		this.onOpenProject = props.onOpenProject;
		this.#onOpenFolder = props.onOpenFolder;
		this.#onImportProject = props.onImportProject;
		this.readFileBytes = props.readFileBytes ?? props.project?.readFileBytes;
		this.onDownload = props.onDownload;
		this.#onpersist = props.onpersist;
		this.#openPathOnMount = props.openPathOnMount;

		this.files = new FileStore({
			project: props.project,
			git: props.git,
			gitRoot: props.gitRoot,
			initialFiles: props.initialFiles,
			projectName: props.projectName ?? 'glyphtex-project',
			scope: props.documentId ?? props.projectName ?? 'glyphtex-project'
		});
		this.layout = new LayoutStore({
			git: props.git,
			getProjectRoot: () => this.files.scmRoot
		});
		this.search = new SearchStore({
			layout: this.layout,
			files: this.files,
			getSource: () => this.files.source
		});
		this.compile = new CompileStore({
			files: this.files,
			layout: this.layout,
			// Getter, not value: the controller is constructed once, so a captured
			// `compile` never sees the prop flip after the engine is installed.
			getCompile: () => props.compile,
			getCompileFiles: () => props.compileFiles,
			compileProject: props.compileProject,
			saveFile: props.saveFile
		});

		this.notes = new NotesStore(
			() => props.documentId ?? this.files.projectRoot ?? this.files.displayName
		);

		// Opening a project closes any diff left over from the previous one.
		this.files.onProjectLoaded = () => this.layout.closeDiff();
	}

	// --- Which editor is actually on screen ---
	// Getters, not `$derived`: they read constructor-assigned stores, which a field
	// initializer would touch before the constructor runs.
	/** Whether the active file has a document body the block editor can show. A
	 *  `.bib`, a `.md` or a PNG does not, and parsing one as LaTeX would corrupt it. */
	get visualAllowed(): boolean {
		return this.files.activeVisual;
	}

	/** Why Visual is unavailable, for the mode switch's tooltip. */
	get visualBlockedReason(): string | null {
		if (this.visualAllowed) return null;
		const name = this.files.activeFile?.name;
		return name ? `Visual editing is for .tex files: ${baseName(name)} opens as source` : null;
	}

	/**
	 * The surface to render. `layout.docMode` is what the user picked and is kept
	 * as-is, so opening a `.bib` and coming back returns you to Visual rather than
	 * silently demoting the preference.
	 */
	get docMode(): DocMode {
		return this.layout.docMode === 'visual' && this.visualAllowed ? 'visual' : 'latex';
	}

	/**
	 * Every menu action, flattened for the command palette. One searchable list
	 * beats a three-level hover tree for anything the mouse doesn't reach daily,
	 * which is why the header no longer carries a File/Edit/View menu.
	 */
	get commands(): PaletteCommand[] {
		return this.menus.flatMap((menu) =>
			menu.items
				.filter((item): item is MenuAction => item.type !== 'separator')
				.map((item) => ({
					id: `${menu.label}:${item.label}`,
					group: menu.label,
					// Checkbox items read as a state, not an action, without this.
					label:
						item.checked === undefined
							? item.label
							: `${item.label} (${item.checked ? 'on' : 'off'})`,
					shortcut: item.shortcut,
					disabled: item.disabled,
					run: () => item.run?.()
				}))
		);
	}

	// --- Editing, routed to whichever surface is on screen ---
	undo(): void {
		this.layout.editing?.undo();
	}
	redo(): void {
		this.layout.editing?.redo();
	}
	/** Inline emphasis. The block editor toggles a real mark; the source editor
	 *  wraps the selection in the command that produces one. */
	mark(id: 'bold' | 'italic'): void {
		if (this.layout.visualApi) this.layout.visualApi.mark(id);
		else this.layout.editor?.wrapSelection(id === 'bold' ? '\\textbf{' : '\\textit{', '}');
	}

	/** Project-wide search. Distinct from ⌘F, which is find-in-file. */
	searchProject(): void {
		this.layout.selectView('search');
		// Seed from the selection so "find this word everywhere" is one keystroke.
		const selected = this.layout.editor?.selectedText?.() ?? '';
		if (selected && !selected.includes('\n')) {
			void this.search.runProjectSearch({ ...this.search.projectOpts, query: selected });
		}
	}

	/** Replace every match in the project. Confirms once it spans more than the
	 *  file you are looking at: undo is per file, so this is hard to walk back. */
	async replaceAllInProject(replace: string): Promise<void> {
		const total = this.search.visibleTotal;
		const files = this.search.visibleGroups.length;
		if (!total) return;
		if (files > 1) {
			const ok = await this.files.askConfirm(
				'Replace across files',
				`Replace ${total} matches in ${files} files? Undo works per file, not in one step.`,
				'Replace all'
			);
			if (!ok) return;
		}
		const n = await this.search.replaceAllProject(replace);
		toast.success(`Replaced ${n} ${n === 1 ? 'match' : 'matches'}`);
	}

	/** Copy a file's path. Absolute where there is a folder on disk, since that is
	 *  the form you would paste into a terminal. */
	async copyPath(rel: string): Promise<void> {
		const root = this.files.projectRoot;
		const text = root ? `${root}/${rel}`.replace(/\\/g, '/') : rel;
		try {
			await navigator.clipboard.writeText(text);
			toast.success('Path copied');
		} catch {
			toast.error('Could not copy the path.');
		}
	}

	/** Outline / go-to-line, routed to the surface on screen. Visual has no
	 *  CodeMirror handle, so the jump is queued for its block list instead. */
	goToLine(line: number): void {
		if (this.docMode !== 'visual') {
			this.layout.editor?.goToLine(line);
			return;
		}
		this.layout.revealLine = line;
		// The caret has not moved, so nothing else would tell the outline you
		// navigated; a click that scrolls but leaves the old row lit reads as broken.
		this.layout.cursor = { line, column: 1 };
	}

	// --- Open / import (host hook, else the desktop ProjectHost) ---
	get canOpenFolder(): boolean {
		return Boolean(this.#onOpenFolder || this.files.project);
	}
	get canImportProject(): boolean {
		return Boolean(this.#onImportProject || this.files.project);
	}

	openFolder(): void {
		if (this.#onOpenFolder) this.#onOpenFolder();
		else void this.files.openFolder();
	}
	importProject(): void {
		if (this.#onImportProject) this.#onImportProject();
		else void this.files.importProject();
	}

	// --- Download (Explorer "…" menu) ---
	/** Hand one file to the host to save. Saves first, so the download is current. */
	async downloadFile(id: string): Promise<void> {
		const file = this.files.files.find((f) => f.id === id);
		if (!file || !this.onDownload) return;
		this.files.syncBuffer();
		await this.files.saveActive();
		this.onDownload({
			kind: 'file',
			name: file.name.slice(file.name.lastIndexOf('/') + 1),
			paths: [file.name]
		});
	}

	/** Hand a folder (zipped by the host) to save, including everything under it. */
	async downloadFolder(path: string): Promise<void> {
		if (!this.onDownload) return;
		this.files.syncBuffer();
		await this.files.saveActive();
		const prefix = `${path}/`;
		const paths = this.files.files.map((f) => f.name).filter((n) => n.startsWith(prefix));
		if (paths.length === 0) return;
		this.onDownload({
			kind: 'folder',
			name: path.slice(path.lastIndexOf('/') + 1),
			paths,
			root: path
		});
	}

	// --- Application menu ---
	// A getter, not a field: recomputed on read so checkmarks stay in sync, and it
	// can reference constructor-assigned stores without initialization-order issues.
	get menus(): Menu[] {
		return [
			{
				label: 'File',
				items: [
					{
						label: 'New File',
						shortcut: shortcutLabel('new-file'),
						run: () => this.files.newFile()
					},
					{
						label: 'Open File…',
						shortcut: shortcutLabel('quick-open'),
						run: () => (this.layout.paletteOpen = true)
					},
					...(this.onOpenProject
						? [
								{
									label: 'Open Project…',
									run: () => this.onOpenProject?.()
								}
							]
						: []),
					{
						label: 'Open Folder…',
						shortcut: shortcutLabel('open-folder'),
						disabled: !this.canOpenFolder,
						run: () => this.openFolder()
					},
					...(this.onAddFiles
						? [
								{
									label: 'Add Files…',
									run: () => this.onAddFiles?.('')
								},
								{
									label: 'Add Images…',
									run: () => this.onAddFiles?.('image/*')
								}
							]
						: []),
					{ type: 'separator' as const },
					{
						label: 'Import Project…',
						disabled: !this.canImportProject,
						run: () => this.importProject()
					},
					{
						// Web supplies its own in-memory zip export; desktop writes to disk.
						label: 'Export as Zip',
						disabled: this.onExportProject ? false : !this.files.project || !this.files.projectRoot,
						run: () => (this.onExportProject ? this.onExportProject() : this.files.exportProject())
					},
					{ type: 'separator' },
					{
						label: 'Save',
						shortcut: shortcutLabel('save'),
						disabled: !this.files.activeDirty,
						run: () => void this.files.saveActive()
					},
					{
						label: 'Save All',
						shortcut: shortcutLabel('save-all'),
						disabled: this.files.dirtyIds.size === 0,
						run: () => void this.files.saveAll()
					}
					// Compile is not a File action: the Compile control owns it, and the
					// palette makes it searchable.
				]
			},
			{
				label: 'Edit',
				// Routed through `layout.editing`, not the CodeMirror handle: in Visual
				// that handle does not exist, so every item here used to silently no-op
				// while still looking live.
				items: [
					{
						label: 'Undo',
						shortcut: shortcutLabel('undo'),
						disabled: !this.layout.undoable,
						refocusEditor: true,
						run: () => this.undo()
					},
					{
						label: 'Redo',
						shortcut: shortcutLabel('redo'),
						disabled: !this.layout.redoable,
						refocusEditor: true,
						run: () => this.redo()
					},
					{ type: 'separator' },
					{ label: 'Bold', refocusEditor: true, run: () => this.mark('bold') },
					{ label: 'Italic', refocusEditor: true, run: () => this.mark('italic') },
					// Structural inserts are source edits. In Visual the block editor's
					// own "/" menu places them, because it knows where the caret is.
					...(this.layout.visualApi
						? []
						: [
								{ type: 'separator' as const },
								{
									label: 'Insert Section',
									refocusEditor: true,
									// wrapSelection, not insertText: this leaves the caret inside the
									// braces, where the title goes, rather than past the newline.
									run: () => this.layout.editor?.wrapSelection('\\section{', '}')
								},
								{
									label: 'Insert List',
									refocusEditor: true,
									run: () =>
										this.layout.editor?.insertText('\\begin{itemize}\n  \\item \n\\end{itemize}\n')
								},
								{
									label: 'Insert Equation',
									refocusEditor: true,
									run: () =>
										this.layout.editor?.insertText('\\begin{equation}\n  \n\\end{equation}\n')
								}
							]),
					{ type: 'separator' },
					{
						label: 'Find in File',
						shortcut: shortcutLabel('find'),
						disabled: Boolean(this.layout.visualApi),
						run: () => this.search.openFind()
					},
					{
						label: 'Search in Project',
						shortcut: shortcutLabel('search-project'),
						run: () => this.searchProject()
					}
				]
			},
			{
				label: 'View',
				items: [
					{
						label: 'Explorer',
						checked: !this.layout.panelCollapsed && this.layout.activeView === 'files',
						run: () => this.layout.selectView('files')
					},
					{
						label: 'Search',
						checked: !this.layout.panelCollapsed && this.layout.activeView === 'search',
						run: () => this.layout.selectView('search')
					},
					{
						label: 'Source Control',
						checked: !this.layout.panelCollapsed && this.layout.activeView === 'git',
						run: () => this.layout.selectView('git')
					},
					{ type: 'separator' },
					{
						label: 'Editor',
						checked: this.layout.viewMode === 'editor',
						run: () => (this.layout.viewMode = 'editor')
					},
					{
						label: 'Split',
						checked: this.layout.viewMode === 'split',
						run: () => (this.layout.viewMode = 'split')
					},
					{
						label: 'Preview',
						checked: this.layout.viewMode === 'preview',
						run: () => (this.layout.viewMode = 'preview')
					},
					{ type: 'separator' },
					{
						label: 'Split Side by Side',
						checked: this.layout.splitDir === 'horizontal',
						disabled: this.layout.viewMode !== 'split',
						run: () => (this.layout.splitDir = 'horizontal')
					},
					{
						label: 'Split Stacked',
						checked: this.layout.splitDir === 'vertical',
						disabled: this.layout.viewMode !== 'split',
						run: () => (this.layout.splitDir = 'vertical')
					},
					{ type: 'separator' },
					{
						label: 'Toggle Sidebar',
						shortcut: shortcutLabel('toggle-sidebar'),
						checked: !this.layout.panelCollapsed,
						run: () => (this.layout.panelCollapsed = !this.layout.panelCollapsed)
					},
					{
						label: 'Toggle Panel',
						checked: this.compile.showProblems,
						run: () => (this.compile.showProblems = !this.compile.showProblems)
					},
					{
						label: 'Notes',
						checked: this.layout.notesOpen,
						run: () => (this.layout.notesOpen = !this.layout.notesOpen)
					},
					{
						label: 'PDF Thumbnails',
						checked: this.layout.thumbsOpen,
						disabled: this.layout.viewMode === 'editor',
						run: () => (this.layout.thumbsOpen = !this.layout.thumbsOpen)
					}
				]
			},
			{
				label: 'Go',
				items: [
					{
						label: 'Go to File…',
						shortcut: shortcutLabel('quick-open'),
						run: () => (this.layout.paletteOpen = true)
					},
					{ type: 'separator' },
					{
						label: 'Next Open File',
						shortcut: shortcutLabel('next-tab'),
						disabled: this.files.openTabFiles.length < 2,
						run: () => this.files.cycleTab(1)
					},
					{
						label: 'Previous Open File',
						shortcut: shortcutLabel('prev-tab'),
						disabled: this.files.openTabFiles.length < 2,
						run: () => this.files.cycleTab(-1)
					},
					{
						label: 'Close Open File',
						shortcut: shortcutLabel('close-tab'),
						disabled: !this.files.canCloseTab,
						run: () => this.files.closeTab(this.files.activeId)
					},
					{
						label: 'Reopen Closed File',
						shortcut: shortcutLabel('reopen-tab'),
						run: () => this.files.reopenClosedTab()
					},
					{ type: 'separator' },
					{
						label: 'Sync to PDF',
						shortcut: shortcutLabel('sync-pdf'),
						run: () => this.compile.syncToPdf()
					}
				]
			},
			{
				label: 'Help',
				items: [
					{
						label: 'Keyboard Shortcuts',
						run: () => (this.layout.shortcutsOpen = true)
					},
					{ type: 'separator' },
					{
						label: 'About GlyphTeX',
						run: () => (this.layout.aboutOpen = true)
					}
				]
			}
		];
	}

	// --- Global keyboard shortcuts ---
	// Matched against the shared registry so keys, menu hints and the shortcuts
	// dialog can't drift. Undo/Redo are left to the editor when it has focus.
	onKeydown(e: KeyboardEvent): void {
		// Cheap early-out: every app shortcut carries a Mod (⌘/Ctrl).
		if (!(e.ctrlKey || e.metaKey)) return;
		// ⌘1…⌘9 by position. Matched here rather than as nine registry entries,
		// which would be nine near-identical rows in the shortcuts dialog.
		if (!e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
			e.preventDefault();
			this.files.selectTabAt(Number(e.key) - 1);
			return;
		}
		const actions: Array<[string, () => void]> = [
			// Save-all before save so ⌘⇧S isn't shadowed by the ⌘S match.
			['save-all', () => void this.files.saveAll()],
			['save', () => void this.files.saveActive()],
			['next-tab', () => this.files.cycleTab(1)],
			['prev-tab', () => this.files.cycleTab(-1)],
			['close-tab', () => this.files.closeTab(this.files.activeId)],
			['reopen-tab', () => this.files.reopenClosedTab()],
			['compile', () => this.compile.runCompile(true)],
			['sync-pdf', () => this.compile.syncToPdf()],
			['quick-open', () => (this.layout.paletteOpen = true)],
			// Search-project before find so ⇧⌘F isn't shadowed by the ⌘F match.
			['search-project', () => this.searchProject()],
			['find', () => this.search.openFind()],
			['new-file', () => void this.files.newFile()],
			['toggle-sidebar', () => (this.layout.panelCollapsed = !this.layout.panelCollapsed)],
			['toggle-panel', () => (this.compile.showProblems = !this.compile.showProblems)],
			['toggle-notes', () => (this.layout.notesOpen = !this.layout.notesOpen)]
		];
		if (this.files.project) actions.push(['open-folder', () => void this.files.openFolder()]);
		for (const [id, run] of actions) {
			if (matchShortcut(e, id)) {
				e.preventDefault();
				run();
				return;
			}
		}
	}

	// "On focus change" auto-save: persist when the window loses focus. (Switching
	// files is handled in openFile, which saves whenever auto-save isn't off.)
	onWindowBlur(): void {
		if (settings.autoSave === 'onFocusChange') void this.files.saveActive();
	}

	// --- Side-effect drivers (run from the component's `$effect`s) ---
	/** Persist back to the host (in-memory projects only), debounced. */
	armPersist(): (() => void) | void {
		void this.files.source; // track edits
		void this.files.files; // track add/remove/rename
		if (!this.#onpersist || this.files.projectRoot) return;
		const persist = this.#onpersist;
		const t = setTimeout(() => persist(this.files.snapshotFiles()), 500);
		return () => clearTimeout(t);
	}

	/** "After delay" auto-save: persist the active file a beat after typing stops. */
	armAutoSave(): (() => void) | void {
		void this.files.source; // track edits
		if (settings.autoSave !== 'afterDelay') return;
		const f = this.files.files.find((x) => x.id === this.files.activeId);
		if (!f || !this.files.fileDirty(f)) return;
		const t = setTimeout(() => void this.files.saveActive(), settings.autoSaveDelayMs);
		return () => clearTimeout(t);
	}

	/** Clear the editor highlight when neither Search view nor find bar is open. */
	/** The find bar owns the editor's highlight decorations; the panel searches the
	 *  document model and never sets any, so closing the bar is the only trigger. */
	clearSearchHighlight(): void {
		if (!this.search.showFind) this.layout.editor?.clearSearch();
	}

	// --- Lifecycle helpers (run from onMount / onDestroy) ---
	/** Open a launched folder/file and listen for later "Open with GlyphTeX" paths.
	 *  Returns the unlisten cleanup (for `onMount`'s return). */
	mountFileAssociation(): () => void {
		const project = this.files.project;
		if (!project) return () => {};
		let unlisten: (() => void) | undefined;
		void (async () => {
			if (this.#openPathOnMount) {
				try {
					await this.files.openPath(this.#openPathOnMount);
				} catch {
					/* ignore: bad launch path */
				}
			}
			try {
				unlisten = await project.onOpenPath?.((path) => void this.files.openPath(path));
			} catch {
				/* event bridge unavailable */
			}
		})();
		return () => unlisten?.();
	}
}
