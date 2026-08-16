import {
	classifyFile,
	editorLanguage,
	isDocumentFile,
	isEditable,
	isSearchable,
	isVisualEditable,
	type FileKind
} from '../file-kinds';
import type { GitHeadInfo, GitProvider } from '../git-panel.svelte';
import type { ProjectHost } from '../project';
import { treeState } from '../side-panel/tree-state.svelte';
import type { Sel } from '../side-panel/types';
import { safeStorage } from '@glyphtex/ui/persisted-state';
import { settings } from '@glyphtex/ui/settings';
import { toast } from '@glyphtex/ui/sonner';

import { baseName, dirOf, joinPath, leafOf, parentDir, samePath, splitExt } from './paths';
import {
	DEMO_FILES,
	type ConflictAction,
	type ConflictChoice,
	type GlyphFile,
	type Pending
} from './types';

export type FileStoreDeps = {
	project?: ProjectHost;
	git?: GitProvider;
	/** Repository root when there is no folder project (web's virtual working tree). */
	gitRoot?: string | null;
	initialFiles?: GlyphFile[];
	projectName: string;
	/** Stable key for this document's persisted tab strip. */
	scope?: string;
};

const tabsKey = (scope: string) => `glyphtex:tabs:${scope}`;

/** The persisted strip: which files are open, and which one you were in. */
type StoredTabs = { tabs: string[]; active: string };

/** The Workbench's document + project model. State and behaviour only: the component
 *  drives auto-save/persist/git-refresh from its own effects, keyed on {@link savedTick}. */
export class FileStore {
	/** Folder-based project bridge (desktop = Tauri fs / zip). Absent on web. */
	readonly project?: ProjectHost;
	/** Host-injected Git backend (desktop = gitoxide). Enables Source Control. */
	readonly git?: GitProvider;
	readonly #projectName: string;

	files = $state<GlyphFile[]>([]);
	activeId = $state('main');
	/** Ids of files with an open editor tab, in tab order. */
	openTabs = $state<string[]>([]);
	/** Ids of recently opened files, newest first: drives the Recent section. */
	recentIds = $state<string[]>([]);
	/** Live buffer for the active file. */
	source = $state('');
	untitledCount = $state(0);
	// Freshly created folders that hold no files yet: shown in the Explorer tree
	// (forward-slash relative paths) until a file lands in them.
	extraFolders = $state<string[]>([]);

	// --- Folder-based project (desktop) ---------------------------------------
	// When a folder is open, `projectRoot` is its absolute path, files are backed
	// by disk (lazy-loaded / saved through `project`), and `mainId` is the compile
	// target. Without a folder we stay on the in-memory demo / web document.
	projectRoot = $state<string | null>(null);
	mainId = $state<string | null>(null);

	// Web has no folder on disk but still has a repository (isomorphic-git over a
	// browser fs), so Source Control keys off this rather than `projectRoot`.
	readonly #gitRoot?: string | null;
	get scmRoot(): string | null {
		return this.projectRoot ?? this.#gitRoot ?? null;
	}

	// Files that turned out to be unreadable as text (binary with a text-y name)
	// get demoted to "binary" so we show the fallback instead of mojibake.
	unreadableIds = $state<Set<string>>(new Set());

	// Bumped whenever a save lands, so the auto-compile effect can key off it.
	savedTick = $state(0);

	// Where HEAD is, for the title bar and the panel footer. Null when there is no
	// repository (or no Git backend at all).
	head = $state<GitHeadInfo | null>(null);

	/** Read HEAD for the current repo. Call from a `$effect`; returns its cleanup. */
	watchHead(): (() => void) | void {
		void this.savedTick; // a save may have been followed by a commit
		const provider = this.git;
		const root = this.scmRoot;
		if (!provider || !root) {
			this.head = null;
			return;
		}
		let stale = false;
		void (async () => {
			try {
				const next = (await provider.isRepo(root)) ? await provider.head(root) : null;
				if (!stale) this.head = next;
			} catch {
				if (!stale) this.head = null; // backend unavailable, or not a repo
			}
		})();
		return () => {
			stale = true;
		};
	}

	// --- Explorer conflict / confirm modal ------------------------------------
	pending = $state<Pending | null>(null);
	conflictName = $state('');
	applyToAll = $state(false);

	constructor(deps: FileStoreDeps) {
		this.project = deps.project;
		this.git = deps.git;
		this.#gitRoot = deps.gitRoot;
		this.#projectName = deps.projectName;
		const seed = deps.initialFiles && deps.initialFiles.length ? deps.initialFiles : DEMO_FILES;
		this.files = seed.map((f) => ({ ...f, saved: f.content }));
		this.activeId = seed[0]?.id ?? 'main';
		this.openTabs = this.activeId ? [this.activeId] : [];
		this.source = seed[0]?.content ?? '';
		const last = this.restoreTabs(deps.scope ?? deps.projectName);
		if (last) {
			this.activeId = last;
			this.source = this.files.find((f) => f.id === last)?.content ?? '';
		}
	}

	// --- Tab strip ------------------------------------------------------------
	// `openTabs` holds file ids, and a project file's id *is* its absolute path, so
	// every rename / move / delete has to maintain this list or tabs silently
	// vanish (and a recreated path inherits a ghost tab).
	/** Point an open tab at a file's new id, keeping its place in the strip. */
	#remapTab(oldId: string, newId: string): void {
		if (oldId === newId) return;
		this.openTabs = this.openTabs.map((t) => (t === oldId ? newId : t));
		this.#closedTabs = this.#closedTabs.map((t) => (t === oldId ? newId : t));
		this.recentIds = this.recentIds.map((r) => (r === oldId ? newId : r));
	}

	/** Forget a tab whose file is gone. Remembered so ⌘⌥T can bring it back. */
	#dropTab(id: string, remember = true): void {
		if (remember && this.openTabs.includes(id)) {
			this.#closedTabs = [...this.#closedTabs.filter((t) => t !== id), id].slice(-12);
		}
		this.openTabs = this.openTabs.filter((t) => t !== id);
		this.recentIds = this.recentIds.filter((r) => r !== id);
	}

	/** Ids of tabs closed in this session, oldest first: the ⌘⌥T stack. */
	#closedTabs = $state<string[]>([]);

	// The document key the strip is stored under. Re-pointed by `restoreTabs` when
	// a folder is opened, so tabs follow the project rather than the window.
	#tabScope = '';

	/**
	 * Load this document's tab strip. Ids that no longer resolve are dropped.
	 * Returns the file that was active last time, for the caller to open.
	 */
	restoreTabs(scope: string): string | null {
		this.#tabScope = scope;
		if (!scope) return null;
		const saved = safeStorage.get<StoredTabs | null>(tabsKey(scope), null);
		const ids = Array.isArray(saved?.tabs) ? saved.tabs : [];
		if (!ids.length) return null;
		const known = new Set(this.files.map((f) => f.id));
		const live = ids.filter((id) => typeof id === 'string' && known.has(id));
		if (!live.length) return null;
		this.openTabs = live.includes(this.activeId) ? live : [...live, this.activeId].filter(Boolean);
		return known.has(saved?.active ?? '') ? (saved?.active ?? null) : null;
	}

	/** Write the strip back. Called from an effect that tracks `openTabs`. */
	persistTabs(): void {
		void this.openTabs; // tracked by the caller's effect
		if (!this.#tabScope) return;
		safeStorage.set<StoredTabs>(tabsKey(this.#tabScope), {
			tabs: this.openTabFiles.map((f) => f.id),
			active: this.activeId
		});
	}

	/**
	 * Files with an open tab, in order: always including the active file even if
	 * a rename/delete dropped its id, so the tab strip never loses the current
	 * file.
	 */
	readonly openTabFiles = $derived.by(() => {
		const ids = [...this.openTabs];
		if (this.activeId && !ids.includes(this.activeId)) ids.push(this.activeId);
		return ids
			.map((id) => this.files.find((f) => f.id === id))
			.filter((f): f is GlyphFile => Boolean(f));
	});

	/**
	 * Label per open tab. Two chapters both called `intro.tex` are indistinguishable
	 * by leaf alone, so a colliding tab earns its parent folder: only the ones that
	 * actually collide, and at every width.
	 */
	readonly tabLabels = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const f of this.openTabFiles) {
			const leaf = baseName(f.name);
			counts.set(leaf, (counts.get(leaf) ?? 0) + 1);
		}
		return new Map(
			this.openTabFiles.map((f) => {
				const leaf = baseName(f.name);
				const dir = (counts.get(leaf) ?? 0) > 1 ? leafOf(parentDir(f.name)) : '';
				return [f.id, { leaf, dir }] as const;
			})
		);
	});

	/** Recently opened files that no longer have a tab: reopening them is one click. */
	readonly recentFiles = $derived.by(() => {
		const open = new Set(this.openTabFiles.map((f) => f.id));
		return this.recentIds
			.filter((id) => !open.has(id))
			.map((id) => this.files.find((f) => f.id === id))
			.filter((f): f is GlyphFile => Boolean(f))
			.slice(0, 6);
	});

	/** Close a tab, activating a neighbour; the last remaining tab stays open. */
	closeTab(id: string): void {
		const visible = this.openTabFiles.map((f) => f.id);
		if (visible.length <= 1) return;
		const at = visible.indexOf(id);
		this.#dropTab(id);
		if (id === this.activeId) {
			const next = visible[at + 1] ?? visible[at - 1];
			if (next) void this.openFile(next);
		}
	}

	/** Whether closing is offered at all: the strip never empties itself. */
	readonly canCloseTab = $derived(this.openTabFiles.length > 1);

	closeOtherTabs(id: string): void {
		for (const f of this.openTabFiles) if (f.id !== id) this.#dropTab(f.id);
		if (id !== this.activeId) void this.openFile(id);
	}

	closeTabsToRight(id: string): void {
		const visible = this.openTabFiles.map((f) => f.id);
		const at = visible.indexOf(id);
		if (at === -1) return;
		for (const victim of visible.slice(at + 1)) this.#dropTab(victim);
		if (!visible.slice(0, at + 1).includes(this.activeId)) void this.openFile(id);
	}

	/** Close everything but the active file: an empty strip has nothing to show. */
	closeAllTabs(): void {
		this.closeOtherTabs(this.activeId);
	}

	/** Reopen the most recently closed tab (⌘⌥T), skipping files that are gone. */
	reopenClosedTab(): void {
		while (this.#closedTabs.length) {
			const id = this.#closedTabs[this.#closedTabs.length - 1];
			this.#closedTabs = this.#closedTabs.slice(0, -1);
			if (this.files.some((f) => f.id === id)) {
				if (!this.openTabs.includes(id)) this.openTabs = [...this.openTabs, id];
				void this.openFile(id);
				return;
			}
		}
	}

	/** Drag-reorder: put `id` where `beforeId` sits (end of the strip when null). */
	moveTab(id: string, beforeId: string | null): void {
		const order = this.openTabFiles.map((f) => f.id);
		const from = order.indexOf(id);
		if (from === -1 || id === beforeId) return;
		order.splice(from, 1);
		const to = beforeId === null ? order.length : order.indexOf(beforeId);
		order.splice(to === -1 ? order.length : to, 0, id);
		this.openTabs = order;
	}

	/** Step through the strip. Wraps, so ⌘⌥→ off the end lands on the first tab. */
	cycleTab(direction: 1 | -1): void {
		const order = this.openTabFiles.map((f) => f.id);
		if (order.length < 2) return;
		const at = order.indexOf(this.activeId);
		void this.openFile(order[(at + direction + order.length) % order.length]);
	}

	/** ⌘1…⌘8 by position; ⌘9 is "the last one", as everywhere else. */
	selectTabAt(index: number): void {
		const order = this.openTabFiles.map((f) => f.id);
		const id = index >= 8 ? order[order.length - 1] : order[index];
		if (id) void this.openFile(id);
	}

	get hasProject(): boolean {
		return Boolean(this.project);
	}

	/**
	 * Insert or replace files by relative path, without touching the rest of the
	 * tree. The host uses this to add imported or uploaded files to a live
	 * session; binary members carry a placeholder body it re-injects on save.
	 */
	addFiles(entries: { name: string; content: string }[]): void {
		for (const entry of entries) {
			const existing = this.files.find((f) => f.name === entry.name);
			if (existing) {
				existing.content = entry.content;
				existing.saved = entry.content;
				existing.loaded = true;
			} else {
				this.files.push({
					id: entry.name,
					name: entry.name,
					content: entry.content,
					saved: entry.content,
					loaded: true
				});
			}
		}
	}

	/** Replace the session after something rewrote the tree behind the editor (pull,
	 *  clone, discard). Unsaved buffers are dropped: the tree has already won. */
	async reloadFrom(entries: { name: string; content: string }[]): Promise<void> {
		const keep = new Set(entries.map((e) => e.name));
		for (const f of [...this.files]) if (!keep.has(f.name)) await this.removeRel(f.name);
		this.addFiles(entries);
		const active = this.files.find((f) => f.id === this.activeId) ?? this.files[0];
		if (!active) return;
		this.activeId = active.id;
		this.source = active.content ?? '';
		if (!this.openTabs.includes(active.id)) this.openTabs = [active.id];
	}

	// --- Derived view of the active file --------------------------------------
	readonly activeFile = $derived(this.files.find((f) => f.id === this.activeId) ?? this.files[0]);
	readonly activeKind = $derived<FileKind>(
		!this.activeFile
			? 'text'
			: this.unreadableIds.has(this.activeFile.id)
				? 'binary'
				: classifyFile(this.activeFile.name)
	);
	readonly activeEditable = $derived(isEditable(this.activeKind));
	readonly activeLanguage = $derived(editorLanguage(this.activeKind));
	// The whole LaTeX family (sources, .bib, .toc, .aux …) gets the format toolbar;
	// markdown / plain text / code do not.
	readonly activeHasToolbar = $derived(this.activeKind === 'latex');
	/** Whether the active file can open in the Visual editor at all. */
	readonly activeVisual = $derived(
		this.activeEditable && isVisualEditable(this.activeFile?.name ?? '')
	);

	// Project name shown in chrome: the open folder's name, else the prop default.
	// A getter (not `$derived`) so it can reference the constructor-assigned
	// `#projectName` without tripping field-initialization order.
	get displayName(): string {
		return this.projectRoot ? baseName(this.projectRoot) : this.#projectName;
	}

	// Ids of files with unsaved edits: drives the Explorer's "modified" dots.
	readonly dirtyIds = $derived(
		new Set(this.files.filter((f) => this.fileDirty(f)).map((f) => f.id))
	);
	readonly activeDirty = $derived(this.activeFile ? this.dirtyIds.has(this.activeFile.id) : false);

	readonly lineCount = $derived(this.source.split('\n').length);
	readonly charCount = $derived(this.source.length);
	readonly wordCount = $derived(this.source.trim() ? this.source.trim().split(/\s+/).length : 0);

	// --- Save / dirty model ---------------------------------------------------
	/** The current in-memory content for a file (live buffer if it's active). */
	liveContent(f: GlyphFile): string {
		return f.id === this.activeId ? this.source : f.content;
	}
	fileDirty(f: GlyphFile): boolean {
		if (f.saved === undefined) return false;
		return this.liveContent(f) !== f.saved;
	}

	/** Pull a project file's text off disk if it has not been opened yet. Shared by
	 *  `openFile` and project search, which has to read files nobody has opened. */
	async ensureLoaded(f: GlyphFile): Promise<void> {
		if (!this.project || !f.path || f.loaded) return;
		if (!isEditable(classifyFile(f.name))) return;
		try {
			f.content = await this.project.readFile(f.path);
			f.saved = f.content;
			f.loaded = true;
		} catch {
			// A text-looking name that is actually binary: leave it empty rather than
			// failing the whole scan.
			this.unreadableIds = new Set(this.unreadableIds).add(f.id);
			f.content = '';
			f.loaded = true;
		}
	}

	/** Every file project search may read, with unsaved edits included. Each is
	 *  tagged with whether it is part of the document, which sets the default scope. */
	async searchableFiles(): Promise<
		{ id: string; name: string; text: string; document: boolean }[]
	> {
		this.syncBuffer();
		const out: { id: string; name: string; text: string; document: boolean }[] = [];
		for (const f of this.files) {
			if (!isSearchable(f.name) || this.unreadableIds.has(f.id)) continue;
			await this.ensureLoaded(f);
			// `ensureLoaded` demotes a text-named binary, so re-check after reading.
			if (this.unreadableIds.has(f.id)) continue;
			out.push({
				id: f.id,
				name: f.name,
				text: this.liveContent(f),
				document: isDocumentFile(f.name)
			});
		}
		return out;
	}

	/** Overwrite one file's text, live buffer included when it is the open one. */
	setContent(id: string, text: string): void {
		const f = this.files.find((x) => x.id === id);
		if (!f) return;
		if (id === this.activeId) this.source = text;
		else f.content = text;
	}

	/** Mirror the live buffer into the active file's in-memory content (no disk). */
	syncBuffer(): void {
		const f = this.files.find((x) => x.id === this.activeId);
		if (f) f.content = this.source;
	}

	/** Write one file's live content to disk (project) and mark it saved. */
	async persistFile(f: GlyphFile): Promise<boolean> {
		const content = this.liveContent(f);
		if (this.project && f.path) {
			try {
				await this.project.writeFile(f.path, content);
			} catch (e) {
				toast.error(`Could not save ${baseName(f.name)}: ${e}`);
				return false;
			}
		}
		f.content = content;
		f.saved = content;
		return true;
	}

	/** Save the active file if dirty. `bumpCompile` re-arms the auto-compile. */
	async saveActive(bumpCompile = true): Promise<boolean> {
		const f = this.files.find((x) => x.id === this.activeId);
		if (!f || !this.fileDirty(f)) return false;
		const ok = await this.persistFile(f);
		if (ok) {
			if (bumpCompile) this.savedTick += 1;
		}
		return ok;
	}

	/** Save every dirty file (used before export / on demand). */
	async saveAll(): Promise<void> {
		this.syncBuffer();
		let any = false;
		for (const f of this.files) if (this.fileDirty(f)) any = (await this.persistFile(f)) || any;
		if (any) {
			this.savedTick += 1;
		}
	}

	async openFile(id: string, force = false): Promise<void> {
		if (!force && id === this.activeId) return;
		// Commit the outgoing buffer: always to memory; to disk unless auto-save is
		// off (so a file switch persists under "after delay" / "on focus change").
		this.syncBuffer();
		if (settings.autoSave !== 'off') await this.saveActive();
		this.activeId = id;
		this.recentIds = [id, ...this.recentIds.filter((r) => r !== id)].slice(0, 12);
		if (!this.openTabs.includes(id)) this.openTabs = [...this.openTabs, id];
		const f = this.files.find((x) => x.id === id);
		// Only editable kinds get a text buffer; images / PDFs / binaries are read
		// lazily as bytes by the AssetViewer, so we never read them as text here.
		const editable = f ? isEditable(classifyFile(f.name)) : true;
		if (f) await this.ensureLoaded(f);
		this.source = f && editable && !this.unreadableIds.has(f.id) ? (f.content ?? '') : '';
	}

	// --- New file / folder ----------------------------------------------------
	async newFile(dir = ''): Promise<void> {
		this.syncBuffer();
		const relFor = (n: number) => (dir ? `${dir}/untitled-${n}.tex` : `untitled-${n}.tex`);
		if (this.project && this.projectRoot) {
			this.untitledCount += 1;
			let rel = relFor(this.untitledCount);
			let abs = joinPath(this.projectRoot, rel);
			// Avoid clobbering an existing file.
			while (await this.project.exists(abs)) {
				this.untitledCount += 1;
				rel = relFor(this.untitledCount);
				abs = joinPath(this.projectRoot, rel);
			}
			try {
				await this.project.createEntry(abs, false);
			} catch (e) {
				toast.error(`Could not create file: ${e}`);
				return;
			}
			this.files = [
				...this.files,
				{ id: abs, name: rel, content: '', path: abs, loaded: true, saved: '' }
			];
			this.activeId = abs;
			this.source = '';
			return;
		}
		this.untitledCount += 1;
		let rel = relFor(this.untitledCount);
		while (this.relExists(rel)) {
			this.untitledCount += 1;
			rel = relFor(this.untitledCount);
		}
		const id = `untitled-${this.untitledCount}`;
		this.files = [...this.files, { id, name: rel, content: '', saved: '' }];
		this.activeId = id;
		this.source = '';
	}

	// Existing folder paths (forward-slashed) derived from the file list + the
	// already-created empty folders, so "New folder" never picks a name in use.
	existingFolderPaths(): Set<string> {
		const set = new Set(this.extraFolders);
		for (const f of this.files) {
			const parts = f.name.split('/');
			let cur = '';
			for (let i = 0; i < parts.length - 1; i++) {
				cur = cur ? `${cur}/${parts[i]}` : parts[i];
				set.add(cur);
			}
		}
		return set;
	}

	async newFolder(dir = ''): Promise<void> {
		const taken = this.existingFolderPaths();
		const relFor = (n: number) => {
			const leaf = n === 1 ? 'new-folder' : `new-folder-${n}`;
			return dir ? `${dir}/${leaf}` : leaf;
		};
		let n = 1;
		let rel = relFor(1);
		while (taken.has(rel)) rel = relFor(++n);

		if (this.project && this.projectRoot) {
			const abs = joinPath(this.projectRoot, rel);
			try {
				await this.project.createEntry(abs, true);
			} catch (e) {
				toast.error(`Could not create folder: ${e}`);
				return;
			}
		}
		this.extraFolders = [...this.extraFolders, rel];
	}

	/** Create at an exact relative path, named in the Explorer before it existed.
	 *  A clash is suffixed rather than rejected: the draft row is already gone, so
	 *  there is nothing left on screen to correct. */
	async createAt(rel: string, kind: 'file' | 'folder'): Promise<void> {
		this.syncBuffer();
		const dir = dirOf(rel);
		const leaf = leafOf(rel).trim();
		if (!leaf) return;
		const path = (unique: string) => (dir ? `${dir}/${unique}` : unique);

		if (kind === 'folder') {
			const target = path(this.uniqueFolder(dir, leaf));
			if (this.project && this.projectRoot) {
				try {
					await this.project.createEntry(joinPath(this.projectRoot, target), true);
				} catch (e) {
					toast.error(`Could not create folder: ${e}`);
					return;
				}
			}
			this.extraFolders = [...this.extraFolders, target];
			return;
		}

		const target = path(this.uniqueLeaf(dir, leaf));
		if (this.project && this.projectRoot) {
			const abs = joinPath(this.projectRoot, target);
			try {
				await this.project.createEntry(abs, false);
			} catch (e) {
				toast.error(`Could not create file: ${e}`);
				return;
			}
			this.files = [
				...this.files,
				{ id: abs, name: target, content: '', path: abs, loaded: true, saved: '' }
			];
			this.activeId = abs;
			this.source = '';
			return;
		}
		this.untitledCount += 1;
		const id = `file-${this.untitledCount}`;
		this.files = [...this.files, { id, name: target, content: '', saved: '' }];
		this.activeId = id;
		this.source = '';
	}

	/** Copy a file beside itself, "name (2).tex" style. */
	async duplicateFile(id: string): Promise<void> {
		this.syncBuffer();
		const source = this.files.find((f) => f.id === id);
		if (!source) return;
		const dir = dirOf(source.name);
		const rel = dir
			? `${dir}/${this.uniqueLeaf(dir, leafOf(source.name))}`
			: this.uniqueLeaf('', leafOf(source.name));
		const content = source.id === this.activeId ? this.source : source.content;
		if (this.project && this.projectRoot) {
			const abs = joinPath(this.projectRoot, rel);
			try {
				await this.project.createEntry(abs, false);
				await this.project.writeFile(abs, content);
			} catch (e) {
				toast.error(`Duplicate failed: ${e}`);
				return;
			}
			this.files = [
				...this.files,
				{ id: abs, name: rel, content, path: abs, loaded: true, saved: content }
			];
			return;
		}
		this.untitledCount += 1;
		this.files = [
			...this.files,
			{ id: `file-${this.untitledCount}`, name: rel, content, saved: content }
		];
	}

	/** Move a whole selection. Sequential on purpose: each item can raise its own
	 *  name-conflict prompt, and the dialog is a single slot. */
	async moveItems(items: Sel[], targetDir: string): Promise<void> {
		for (const item of items) {
			if (item.type === 'folder') await this.moveFolder(item.path, targetDir);
			else await this.moveFile(item.id, targetDir);
		}
	}

	/** Delete a whole selection behind one confirmation. */
	async deleteItems(items: Sel[]): Promise<void> {
		if (!items.length) return;
		if (items.length === 1) {
			const only = items[0];
			if (only.type === 'folder') return this.deleteFolder(only.path);
			return this.deleteFile(only.id);
		}
		const folders = items.filter((i) => i.type === 'folder').length;
		const files = items.length - folders;
		const parts = [
			files ? `${files} file${files > 1 ? 's' : ''}` : '',
			folders ? `${folders} folder${folders > 1 ? 's' : ''}` : ''
		].filter(Boolean);
		const ok = await this.askConfirm(
			'Delete items',
			`Delete ${parts.join(' and ')}? This cannot be undone.`,
			'Delete'
		);
		if (!ok) return;
		// Folders first: deleting one may remove files also listed here, and a
		// second pass over a vanished id would report a spurious failure.
		const ordered = [...items].sort((a, b) => (a.type === b.type ? 0 : a.type === 'folder' ? -1 : 1));
		let failed = 0;
		for (const item of ordered) {
			try {
				if (item.type === 'folder') await this.removeFolder(item.path);
				else if (this.files.some((f) => f.id === item.id)) await this.removeFile(item.id);
			} catch {
				failed += 1;
			}
		}
		if (failed) toast.error(`${failed} item${failed > 1 ? 's' : ''} could not be deleted.`);
		else toast.success('Deleted');
	}

	// --- Conflict-name helpers ------------------------------------------------
	relExists(rel: string, exceptId?: string): boolean {
		return this.files.some((f) => f.id !== exceptId && f.name.toLowerCase() === rel.toLowerCase());
	}
	folderExists(path: string): boolean {
		const lower = path.toLowerCase();
		for (const p of this.existingFolderPaths()) if (p.toLowerCase() === lower) return true;
		return false;
	}
	uniqueLeaf(dir: string, leaf: string): string {
		const { base, ext } = splitExt(leaf);
		let candidate = leaf;
		let n = 1;
		while (this.relExists(dir ? `${dir}/${candidate}` : candidate))
			candidate = `${base} (${++n})${ext}`;
		return candidate;
	}
	uniqueFolder(dir: string, name: string): string {
		let candidate = name;
		let n = 1;
		while (this.folderExists(dir ? `${dir}/${candidate}` : candidate))
			candidate = `${name} (${++n})`;
		return candidate;
	}

	// --- Promise-based conflict / confirm modal -------------------------------
	askConflict(
		name: string,
		isFolder: boolean,
		suggestion: string,
		opts: { canMerge?: boolean; canApplyAll?: boolean } = {}
	): Promise<ConflictChoice> {
		this.conflictName = suggestion;
		this.applyToAll = false;
		return new Promise((resolve) => {
			this.pending = {
				kind: 'conflict',
				name,
				isFolder,
				canMerge: !!opts.canMerge,
				canApplyAll: !!opts.canApplyAll,
				resolve
			};
		});
	}
	askConfirm(title: string, message: string, confirmLabel: string): Promise<boolean> {
		return new Promise((resolve) => {
			this.pending = { kind: 'confirm', title, message, confirmLabel, resolve };
		});
	}
	resolveConflict(action: ConflictAction, newName?: string): void {
		const p = this.pending;
		const all = this.applyToAll;
		this.pending = null;
		this.applyToAll = false;
		if (p?.kind === 'conflict') p.resolve({ action, newName, applyToAll: all });
	}
	resolveConfirm(ok: boolean): void {
		const p = this.pending;
		this.pending = null;
		if (p?.kind === 'confirm') p.resolve(ok);
	}
	cancelPending(): void {
		const p = this.pending;
		this.pending = null;
		this.applyToAll = false;
		if (p?.kind === 'conflict') p.resolve({ action: 'skip' });
		else if (p?.kind === 'confirm') p.resolve(false);
	}

	// --- Rename / move / delete -----------------------------------------------
	/** Apply a fully-resolved new relative path to one file (disk + state). */
	async applyRename(f: GlyphFile, newRel: string): Promise<string | null> {
		if (this.project && this.projectRoot && f.path) {
			const newAbs = joinPath(this.projectRoot, newRel);
			try {
				await this.project.rename(f.path, newAbs);
			} catch (e) {
				toast.error(`Move failed: ${e}`);
				return null;
			}
			const wasActive = f.id === this.activeId;
			const wasMain = f.id === this.mainId;
			this.files = this.files.map((x) =>
				x.id === f.id ? { ...x, id: newAbs, name: newRel, path: newAbs } : x
			);
			this.#remapTab(f.id, newAbs);
			if (wasActive) this.activeId = newAbs;
			if (wasMain) {
				this.mainId = newAbs;
				void this.writeManifest();
			}
			return newAbs;
		}
		this.files = this.files.map((x) => (x.id === f.id ? { ...x, name: newRel } : x));
		return f.id;
	}

	/** Delete the file currently occupying `rel` (used by "Replace"). */
	async removeRel(rel: string, exceptId?: string): Promise<void> {
		const victim = this.files.find(
			(x) => x.id !== exceptId && x.name.toLowerCase() === rel.toLowerCase()
		);
		if (!victim) return;
		if (this.project && victim.path) await this.project.remove(victim.path);
		if (victim.id === this.mainId) {
			this.mainId = null;
			void this.writeManifest();
		}
		if (victim.id === this.activeId) this.activeId = '';
		this.#dropTab(victim.id, false);
		this.files = this.files.filter((x) => x.id !== victim.id);
	}

	async moveFile(id: string, targetDir: string): Promise<void> {
		this.syncBuffer();
		const f = this.files.find((x) => x.id === id);
		if (!f) return;
		const leaf = leafOf(f.name);
		let newRel = targetDir ? `${targetDir}/${leaf}` : leaf;
		if (newRel.toLowerCase() === f.name.toLowerCase()) return; // no-op
		if (this.relExists(newRel, id)) {
			const res = await this.askConflict(leaf, false, this.uniqueLeaf(targetDir, leaf));
			if (res.action === 'skip') return;
			if (res.action === 'rename') {
				const nl = this.uniqueLeaf(targetDir, (res.newName || leaf).trim() || leaf);
				newRel = targetDir ? `${targetDir}/${nl}` : nl;
			} else if (res.action === 'replace') {
				try {
					await this.removeRel(newRel, id);
				} catch (e) {
					toast.error(`Replace failed: ${e}`);
					return;
				}
			}
		}
		const finalId = await this.applyRename(f, newRel);
		if (finalId && this.activeId === '') await this.openFile(finalId, true);
	}

	/** Move every file under `srcPath` to `newPath` (disk + state). Shared by
	 * folder move and folder rename. */
	async relocateFolder(srcPath: string, newPath: string): Promise<void> {
		this.syncBuffer();
		// The Explorer keys expanded folders by path, so a rename or move would
		// otherwise strand that state on a path that no longer exists.
		treeState.remap(srcPath, newPath);
		if (this.project && this.projectRoot) {
			try {
				await this.project.rename(
					joinPath(this.projectRoot, srcPath),
					joinPath(this.projectRoot, newPath)
				);
			} catch (e) {
				toast.error(`Move failed: ${e}`);
				return;
			}
		}
		const prefix = `${srcPath}/`;
		let nextActive = this.activeId;
		let nextMain = this.mainId;
		let mainMoved = false;
		// Collected, then applied in one pass: remapping inside the map would rebuild
		// `openTabs` once per moved file.
		const remapped: [string, string][] = [];
		this.files = this.files.map((f) => {
			if (f.name !== srcPath && !f.name.startsWith(prefix)) return f;
			const newName = newPath + f.name.slice(srcPath.length);
			if (this.project && this.projectRoot) {
				const newAbs = joinPath(this.projectRoot, newName);
				if (f.id === this.activeId) nextActive = newAbs;
				if (f.id === this.mainId) {
					nextMain = newAbs;
					mainMoved = true;
				}
				remapped.push([f.id, newAbs]);
				return { ...f, id: newAbs, name: newName, path: newAbs };
			}
			return { ...f, name: newName };
		});
		if (remapped.length) {
			const moves = new Map(remapped);
			this.openTabs = this.openTabs.map((t) => moves.get(t) ?? t);
			this.recentIds = this.recentIds.map((r) => moves.get(r) ?? r);
		}
		this.extraFolders = this.extraFolders.map((p) =>
			p === srcPath ? newPath : p.startsWith(prefix) ? newPath + p.slice(srcPath.length) : p
		);
		this.activeId = nextActive;
		this.mainId = nextMain;
		if (mainMoved) void this.writeManifest();
	}

	async moveFolder(srcPath: string, targetDir: string): Promise<void> {
		const name = leafOf(srcPath);
		// Guard: never move into self / a descendant.
		if (targetDir === srcPath || targetDir.startsWith(`${srcPath}/`)) return;
		let newPath = targetDir ? `${targetDir}/${name}` : name;
		if (newPath.toLowerCase() === srcPath.toLowerCase()) return; // no-op
		if (this.folderExists(newPath)) {
			const res = await this.askConflict(name, true, this.uniqueFolder(targetDir, name), {
				canMerge: true
			});
			if (res.action === 'skip') return;
			if (res.action === 'merge') {
				await this.mergeFolder(srcPath, newPath);
				return;
			}
			if (res.action === 'rename') {
				const nn = this.uniqueFolder(targetDir, (res.newName || name).trim() || name);
				newPath = targetDir ? `${targetDir}/${nn}` : nn;
			} else if (res.action === 'replace') {
				try {
					await this.removeFolder(newPath);
				} catch (e) {
					toast.error(`Replace failed: ${e}`);
					return;
				}
			}
		}
		await this.relocateFolder(srcPath, newPath);
	}

	/** Merge `srcPath` into an existing `dstPath`: move each file across, resolving
	 * file-level name collisions (with an optional "apply to all"), then drop the
	 * now-empty source folder. */
	async mergeFolder(srcPath: string, dstPath: string): Promise<void> {
		this.syncBuffer();
		const prefix = `${srcPath}/`;
		const movers = this.files.filter((f) => f.name === srcPath || f.name.startsWith(prefix));
		let batch: ConflictChoice | null = null;
		let moved = 0;

		for (const f of movers) {
			// Re-fetch: an earlier "replace" may have removed/renamed this entry.
			const cur = this.files.find((x) => x.id === f.id);
			if (!cur) continue;
			let newRel = dstPath + cur.name.slice(srcPath.length);
			if (newRel.toLowerCase() === cur.name.toLowerCase()) continue;

			if (this.relExists(newRel, cur.id)) {
				let choice: ConflictChoice | null = batch;
				if (!choice) {
					const leaf = leafOf(cur.name);
					choice = await this.askConflict(leaf, false, this.uniqueLeaf(dirOf(newRel), leaf), {
						canApplyAll: movers.length > 1
					});
					if (choice.applyToAll) batch = choice;
				}
				if (choice.action === 'skip') continue;
				if (choice.action === 'rename') {
					const nl = this.uniqueLeaf(dirOf(newRel), leafOf(newRel));
					newRel = dirOf(newRel) ? `${dirOf(newRel)}/${nl}` : nl;
				} else if (choice.action === 'replace') {
					try {
						await this.removeRel(newRel, cur.id);
					} catch (e) {
						toast.error(`Replace failed: ${e}`);
						continue;
					}
				}
			}
			const finalId = await this.applyRename(cur, newRel);
			if (finalId) moved += 1;
			if (finalId && this.activeId === '') await this.openFile(finalId, true);
		}

		// Remap empty subfolders of src into dst; drop the src folder itself.
		this.extraFolders = [
			...new Set(
				this.extraFolders
					.filter((p) => p !== srcPath)
					.map((p) => (p.startsWith(prefix) ? dstPath + p.slice(srcPath.length) : p))
			)
		];
		// Clean up the source folder on disk only if nothing was left behind (skips).
		const leftover = this.files.some((f) => f.name === srcPath || f.name.startsWith(prefix));
		if (!leftover && this.project && this.projectRoot) {
			try {
				await this.project.remove(joinPath(this.projectRoot, srcPath));
			} catch {
				/* best-effort: empty dir cleanup */
			}
		}
		toast.success(`Merged ${moved} file${moved === 1 ? '' : 's'}`);
	}

	async renameFolder(srcPath: string, newLeaf: string): Promise<void> {
		const leaf = newLeaf.trim();
		if (!leaf || /[\\/]/.test(leaf) || leaf === leafOf(srcPath)) return;
		const parent = dirOf(srcPath);
		const newPath = parent ? `${parent}/${leaf}` : leaf;
		if (this.folderExists(newPath)) {
			toast.error(`A folder named “${leaf}” already exists here.`);
			return;
		}
		await this.relocateFolder(srcPath, newPath);
	}

	/** Remove a folder and everything under it (disk + state). */
	async removeFolder(path: string): Promise<void> {
		if (this.project && this.projectRoot) {
			await this.project.remove(joinPath(this.projectRoot, path));
		}
		treeState.drop(path);
		const prefix = `${path}/`;
		const removed = this.files.filter((f) => f.name === path || f.name.startsWith(prefix));
		const hadMain = removed.some((f) => f.id === this.mainId);
		const hadActive = removed.some((f) => f.id === this.activeId);
		for (const f of removed) this.#dropTab(f.id, false);
		this.files = this.files.filter((f) => !(f.name === path || f.name.startsWith(prefix)));
		this.extraFolders = this.extraFolders.filter((p) => !(p === path || p.startsWith(prefix)));
		if (hadMain) {
			this.mainId = null;
			void this.writeManifest();
		}
		if (hadActive) {
			if (this.files[0]) await this.openFile(this.files[0].id, true);
			else {
				this.activeId = '';
				this.source = '';
			}
		}
	}

	async deleteFolder(path: string): Promise<void> {
		const prefix = `${path}/`;
		const count = this.files.filter((f) => f.name === path || f.name.startsWith(prefix)).length;
		const tail = count ? ` and its ${count} file${count > 1 ? 's' : ''}` : '';
		const ok = await this.askConfirm(
			'Delete folder',
			`Delete “${leafOf(path)}”${tail}? This cannot be undone.`,
			'Delete'
		);
		if (!ok) return;
		try {
			await this.removeFolder(path);
			toast.success('Deleted');
		} catch (e) {
			toast.error(`Delete failed: ${e}`);
		}
	}

	// Rename a file from the Explorer. The tree edits the *leaf* name; keep the
	// folder prefix so a nested file stays in its folder.
	async renameFile(id: string, newLeaf: string): Promise<void> {
		const target = this.files.find((f) => f.id === id);
		const leaf = newLeaf.trim();
		if (!target || !leaf || leaf === baseName(target.name)) return;
		const slash = target.name.lastIndexOf('/');
		const dir = slash === -1 ? '' : target.name.slice(0, slash + 1);
		const newRel = dir + leaf;
		if (this.project && this.projectRoot && target.path) {
			const newAbs = joinPath(this.projectRoot, newRel);
			try {
				await this.project.rename(target.path, newAbs);
			} catch (e) {
				toast.error(`Rename failed: ${e}`);
				return;
			}
			const wasMain = id === this.mainId;
			this.files = this.files.map((f) =>
				f.id === id ? { ...f, id: newAbs, name: newRel, path: newAbs } : f
			);
			this.#remapTab(id, newAbs);
			if (id === this.activeId) this.activeId = newAbs;
			if (wasMain) {
				this.mainId = newAbs;
				void this.writeManifest();
			}
			return;
		}
		this.files = this.files.map((f) => (f.id === id ? { ...f, name: newRel } : f));
	}

	/** Remove one file (disk + state), no prompt. Throws so a batch caller can
	 *  count the failures instead of firing a toast per item. */
	async removeFile(id: string): Promise<void> {
		const target = this.files.find((f) => f.id === id);
		if (!target) return;
		if (this.project && target.path) await this.project.remove(target.path);
		const wasActive = id === this.activeId;
		const remaining = this.files.filter((f) => f.id !== id);
		this.#dropTab(id, false);
		this.files = remaining;
		if (id === this.mainId) {
			this.mainId = null;
			void this.writeManifest();
		}
		if (wasActive) {
			if (remaining[0]) await this.openFile(remaining[0].id, true);
			else {
				this.activeId = '';
				this.source = '';
			}
		}
	}

	async deleteFile(id: string): Promise<void> {
		if (this.files.length === 1 && !this.project) {
			toast.error("Can't delete the last file in a project.");
			return;
		}
		const target = this.files.find((f) => f.id === id);
		const ok = await this.askConfirm(
			'Delete file',
			`Delete “${baseName(target?.name ?? '')}”? This cannot be undone.`,
			'Delete'
		);
		if (!ok) return;
		try {
			await this.removeFile(id);
			toast.success('Deleted');
		} catch (e) {
			toast.error(`Delete failed: ${e}`);
		}
	}

	/** Mark a file as the compile target and remember it in the `.glyx` manifest. */
	async setMain(id: string): Promise<void> {
		this.mainId = id;
		await this.writeManifest();
		toast.success(
			`${baseName(this.files.find((f) => f.id === id)?.name ?? '')} is now the main file`
		);
	}

	// The `.glyx` manifest (project root, named after the folder) records the main
	// file so reopening the folder: or double-clicking the .glyx: restores it.
	manifestPath(): string | null {
		if (!this.projectRoot) return null;
		return joinPath(this.projectRoot, `${baseName(this.projectRoot)}.glyx`);
	}
	async writeManifest(): Promise<void> {
		if (!this.project || !this.projectRoot) return;
		const mp = this.manifestPath();
		if (!mp) return;
		const mainRel = this.files.find((f) => f.id === this.mainId)?.name ?? null;
		const data = JSON.stringify(
			{ glyph: 1, main: mainRel, name: baseName(this.projectRoot) },
			null,
			2
		);
		try {
			await this.project.writeFile(mp, data);
		} catch {
			/* best-effort */
		}
	}

	// --- Open / import / export a project -------------------------------------
	/** Pick the main file from a manifest, else a sensible heuristic. */
	async resolveMain(list: { abs: string; rel: string }[]): Promise<string | null> {
		if (!this.project) return null;
		const glyx = list.find((f) => f.rel.toLowerCase().endsWith('.glyx'));
		if (glyx) {
			try {
				const m = JSON.parse(await this.project.readFile(glyx.abs));
				if (m && typeof m.main === 'string') {
					const hit = list.find((f) => f.rel === m.main);
					if (hit) return hit.abs;
				}
			} catch {
				/* fall through to heuristics */
			}
		}
		const mainTex = list.find((f) => f.rel.toLowerCase() === 'main.tex');
		if (mainTex) return mainTex.abs;
		const rootTex = list.find((f) => /^[^/]+\.tex$/i.test(f.rel));
		if (rootTex) return rootTex.abs;
		const anyTex = list.find((f) => f.rel.toLowerCase().endsWith('.tex'));
		return anyTex?.abs ?? list[0]?.abs ?? null;
	}

	/** Called by {@link loadProject} so the host can close any open diff. */
	onProjectLoaded?: () => void;

	async loadProject(root: string, focusPath?: string): Promise<void> {
		if (!this.project) return;
		try {
			const list = await this.project.readFiles(root);
			this.onProjectLoaded?.(); // close any diff from the previous project
			this.projectRoot = root;
			// `.glyx` manifest is project metadata: keep it on disk, hide from the tree.
			const visible = list.filter((f) => !f.rel.toLowerCase().endsWith('.glyx'));
			this.files = visible.map((f) => ({
				id: f.abs,
				name: f.rel,
				content: '',
				path: f.abs,
				loaded: false
			}));
			this.mainId = await this.resolveMain(list);
			this.untitledCount = 0;
			this.extraFolders = [];
			const focusId = focusPath
				? this.files.find((f) => samePath(f.path, focusPath))?.id
				: undefined;
			this.activeId = '';
			// The strip belongs to the project, not the window: reopening a folder
			// restores the files you had open in it, and the one you left off in.
			this.openTabs = [];
			this.recentIds = [];
			const last = this.restoreTabs(root);
			// A launch path is an explicit request and outranks where you left off.
			const first = focusId ?? last ?? this.mainId ?? this.files[0]?.id;
			if (first) await this.openFile(first, true);
			else this.source = '';
			toast.success(`Opened ${baseName(root)}`);
		} catch (e) {
			toast.error(`Could not open project: ${e}`);
		}
	}

	/** Resolve a launched / picked path (folder, `.glyx`, or `.tex`) → open it. */
	async openPath(p: string): Promise<void> {
		if (!this.project) return;
		const lower = p.toLowerCase();
		if (lower.endsWith('.glyx')) {
			await this.loadProject(parentDir(p));
		} else if (/\.[a-z0-9]+$/i.test(lower)) {
			await this.loadProject(parentDir(p), p);
		} else {
			await this.loadProject(p);
		}
	}

	async openFolder(): Promise<void> {
		if (!this.project) return;
		const root = await this.project.pickFolder('Open LaTeX project folder');
		if (root) await this.loadProject(root);
	}

	async importProject(): Promise<void> {
		if (!this.project) return;
		const file = await this.project.pickImportFile();
		if (!file) return;
		if (/\.zip$/i.test(file)) {
			const root = await this.project.importZip(file);
			if (root) await this.loadProject(root);
		} else {
			await this.openPath(file);
		}
	}

	async exportProject(): Promise<void> {
		if (!this.project || !this.projectRoot) {
			toast.info('Open a project folder first to export it.');
			return;
		}
		await this.saveAll();
		try {
			const ok = await this.project.exportZip(
				this.projectRoot,
				`${baseName(this.projectRoot)}.zip`
			);
			if (ok) toast.success('Exported project as ZIP');
		} catch (e) {
			toast.error(`Export failed: ${e}`);
		}
	}

	/** Reveal the open project folder in the OS file manager. */
	async revealProject(): Promise<void> {
		if (!this.project?.revealInOS || !this.projectRoot) return;
		try {
			await this.project.revealInOS(this.projectRoot);
		} catch (e) {
			toast.error(`Could not reveal the folder: ${e}`);
		}
	}

	/** Reveal the active file in the OS file manager (used by the asset viewer). */
	async revealActiveFile(): Promise<void> {
		if (!this.project?.revealInOS || !this.activeFile?.path) return;
		try {
			await this.project.revealInOS(this.activeFile.path);
		} catch (e) {
			toast.error(`Could not reveal the file: ${e}`);
		}
	}

	/** Register the OS "Open with GlyphTeX" folder integration (desktop, Windows).
	 *  Resolves `true` on success so the caller can show inline confirmation. */
	async registerShell(): Promise<boolean> {
		if (!this.project?.registerShellIntegration) return false;
		try {
			toast.success(await this.project.registerShellIntegration());
			return true;
		} catch (e) {
			toast.error(`Could not register shell integration: ${e}`);
			return false;
		}
	}

	// Snapshot of the current files (active file's live source merged in).
	snapshotFiles(): GlyphFile[] {
		return this.files.map((f) => (f.id === this.activeId ? { ...f, content: this.source } : f));
	}
}
