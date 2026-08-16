/** Top-level surface. `visual` is the WYSIWYG editor over the same source; the
 *  LaTeX text stays the truth in both (see `visual-pane.svelte`). */
export type DocMode = 'visual' | 'latex';

/** How the LaTeX surface is laid out. Only meaningful when `docMode` is `latex`. */
export type ViewMode = 'editor' | 'split' | 'preview';

/** Split axis: side by side, or editor above preview. */
export type SplitDirection = 'horizontal' | 'vertical';

/** Result returned by the host's compile bridges (single-file or project). */
export type CompileResult = {
	pdf?: string;
	log?: string;
	error?: string;
	synctex?: string;
	hint?: string;
};

/** Single-file compile bridge (web/demo). */
export type CompileFn = (source: string) => Promise<CompileResult>;

/**
 * In-memory multi-file compile bridge (web projects). The host receives every
 * text file plus the entry path, and supplies binary assets itself.
 */
export type CompileFilesFn = (files: GlyphFile[], entry: string) => Promise<CompileResult>;

/**
 * Multi-file project compile bridge (desktop). Given the project root and the
 * main file's path relative to it, runs the engine so `\input` /
 * `\includegraphics` / `\bibliography` resolve against the real folder.
 */
export type CompileProjectFn = (root: string, mainRel: string) => Promise<CompileResult>;

/**
 * Host-injected file save (desktop = Tauri dialog + fs). Resolves `true` when
 * written, `false` when the user cancels; throws on failure. When absent (web),
 * the workbench falls back to a browser download.
 */
export type SaveFileFn = (
	bytes: Uint8Array,
	opts: { filename: string; extensions?: string[] }
) => Promise<boolean>;

/**
 * One open document.
 *
 * `path`/`loaded` are set for disk-backed project files: `path` is the absolute
 * on-disk path (also the stable `id`); `loaded` tracks whether the content has
 * been read from disk yet (lazy-loaded on first open).
 */
export type GlyphFile = {
	id: string;
	name: string;
	content: string;
	path?: string;
	loaded?: boolean;
	/**
	 * Last content written to disk (or the loaded baseline). A file is "dirty"
	 * (unsaved) when its live content differs from `saved`. `undefined` until the
	 * file has been loaded: an unloaded file can't be dirty.
	 */
	saved?: string;
};

// --- Find / replace ---------------------------------------------------------
export type SearchOptions = {
	query: string;
	replace?: string;
	caseSensitive?: boolean;
	wholeWord?: boolean;
	regexp?: boolean;
	preserveCase?: boolean;
};
export type SearchMatch = {
	from: number;
	to: number;
	line: number;
	column: number;
	text: string;
};

/** The imperative surface a `CodeEditor` exposes via `bind:this`. */
export type EditorApi = {
	/** False while the editor module is still loading: its methods no-op until
	 *  then, so a queued reveal has to wait rather than be dropped. */
	ready?: () => boolean;
	wrapSelection: (before: string, after?: string) => void;
	insertText: (text: string) => void;
	selectedText: () => string;
	focusEditor: () => void;
	undo: () => void;
	redo: () => void;
	goToLine: (line: number) => void;
	findAll: (o: SearchOptions) => SearchMatch[];
	/** `focus: false` reveals without stealing the caret (find bar navigation). */
	selectRange: (from: number, to: number, opts?: { focus?: boolean }) => void;
	replaceRange: (from: number, to: number, insert: string, opts?: { focus?: boolean }) => void;
	replaceAllMatches: (o: SearchOptions, replacement: string) => number;
	clearSearch: () => void;
};

// --- Command definitions ----------------------------------------------------
/**
 * One invocable action. The controller declares these once; the command palette
 * is what renders them. (They used to also feed a File/Edit/View menu tree in the
 * header, which cost three levels of hover for every action.)
 */
export type MenuAction = {
	type?: 'item';
	label: string;
	shortcut?: string;
	checked?: boolean;
	disabled?: boolean;
	run?: () => void;
	/** Item edits the document: put the caret back in the editor afterwards. */
	refocusEditor?: boolean;
};
export type MenuSeparator = { type: 'separator' };
export type MenuEntry = MenuAction | MenuSeparator;
/** A named group of actions, e.g. "File". The name becomes the palette's group. */
export type Menu = { label: string; items: MenuEntry[] };

/**
 * What the Visual pane exposes to the chrome around it. Deliberately small: the
 * block editor's structural inserts belong to its own slash menu, not to a menu
 * bar that cannot know where the caret is.
 */
export type VisualApi = {
	undo: () => void;
	redo: () => void;
	canUndo: () => boolean;
	canRedo: () => boolean;
	/** Apply an inline mark to the selection (`bold`, `italic`, …). */
	mark: (id: string) => void;
};

// --- Compilation ------------------------------------------------------------
export type CompileStatus = 'idle' | 'compiling' | 'success' | 'error';

/** One finished compile, kept for the build-stats sparkline. */
export type BuildRecord = { ms: number; ok: boolean; bytes: number; at: number };

/** How many builds the stats card charts. */
export const BUILD_HISTORY_LIMIT = 24;

// --- Bottom dock ------------------------------------------------------------
export type DockTab = 'problems' | 'logs' | 'stats' | 'history';

/** What the right-edge column is showing. */
export type RightPanel = 'none' | 'notes' | 'settings';

// --- Explorer move / folder conflict prompts --------------------------------
export type ConflictAction = 'replace' | 'rename' | 'skip' | 'merge';
export type ConflictChoice = {
	action: ConflictAction;
	newName?: string;
	applyToAll?: boolean;
};
/**
 * A promise-based modal request: an op `await`s the user's choice; the dialog
 * markup resolves it. One pending request at a time (moves are sequential).
 */
export type Pending =
	| {
			kind: 'conflict';
			name: string;
			isFolder: boolean;
			/** Offer "Merge" (folder-into-folder). */
			canMerge: boolean;
			/** Offer the "apply to all" checkbox (batch file conflicts during a merge). */
			canApplyAll: boolean;
			resolve: (c: ConflictChoice) => void;
	  }
	| {
			kind: 'confirm';
			title: string;
			message: string;
			confirmLabel: string;
			resolve: (ok: boolean) => void;
	  };

// --- Diff view (Source Control → open a change in the editor pane) ----------
export type DiffTarget = {
	path: string;
	staged: boolean;
	original: string;
	modified: string;
	binary: boolean;
};

// --- Sample / demo content --------------------------------------------------
export const SAMPLE_LATEX = String.raw`% GlyphTeX document
\documentclass{article}
\usepackage{amsmath}

\title{Hello from GlyphTeX}
\author{}
\date{}

\begin{document}
\maketitle

GlyphTeX compiles \LaTeX{} entirely on your machine with Tectonic.
Nothing is uploaded. Nothing leaves this device.

\begin{equation}
  E = m c^2
\end{equation}

\end{document}
`;

export const SAMPLE_BIB = String.raw`@article{glyph2026,
  title   = {Local-first Typesetting},
  author  = {GlyphTeX},
  journal = {Journal of Private Research},
  year    = {2026}
}
`;

/**
 * Fallback document used when the host doesn't inject a project (e.g. the web
 * /editor route, or a quick demo).
 */
export const DEMO_FILES: GlyphFile[] = [
	{ id: 'main', name: 'main.tex', content: SAMPLE_LATEX },
	{
		id: 'intro',
		name: 'sections/introduction.tex',
		content: String.raw`\section{Introduction}

Local-first typesetting keeps your unpublished work on your own machine.
This section motivates the approach.
`
	},
	{
		id: 'results',
		name: 'sections/results.tex',
		content: String.raw`\section{Results}

We observe that $\hat{\theta}$ is consistent, with $\alpha$ scaling as $\beta^2$.
`
	},
	{ id: 'refs', name: 'references.bib', content: SAMPLE_BIB }
];

/** PDF preview zoom presets (percent). */
export const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200];
