/**
 * ProjectHost — the host-provided bridge to a real, folder-based LaTeX project
 * on disk. The desktop app backs this with Tauri (native dialogs + Rust fs / zip
 * commands); the web build leaves it undefined and the workbench stays on its
 * in-memory demo document.
 *
 * A project is just a folder. The "main file" is the compile target; other
 * files (`\input`, `\includegraphics`, `\bibliography`, …) resolve relative to
 * it on disk, exactly like Overleaf / a normal local LaTeX project.
 */

/** A file inside a project: stable absolute path + forward-slash relative path. */
export type ProjectFile = { abs: string; rel: string };

export type ProjectHost = {
	/**
	 * Create a new project folder in the app's own data directory (no location
	 * prompt — new projects live here by default), returning its absolute root.
	 * Absent on the web (in-memory projects only).
	 */
	createLocalProject?: (name: string) => Promise<string>;
	/**
	 * List the project folders GlyphTeX manages in its own data directory, so the
	 * home page reflects what's actually on disk (not just remembered references).
	 */
	listLocalProjects?: () => Promise<{ root: string; name: string; modified: number }[]>;
	/** Native folder picker → chosen absolute path, or null if cancelled. */
	pickFolder: (title?: string) => Promise<string | null>;
	/** Native file picker for import (.zip / .glyx / .tex) → path, or null. */
	pickImportFile: () => Promise<string | null>;

	/** Recursively list a project folder's files (junk / VCS dirs excluded). */
	readFiles: (root: string) => Promise<ProjectFile[]>;
	/** Read a text file (rejects binary / non-UTF-8). */
	readFile: (abs: string) => Promise<string>;
	/** Read a file's raw bytes — used to preview images / PDFs in the webview. */
	readFileBytes?: (abs: string) => Promise<Uint8Array>;
	/** Write (overwrite) a text file, creating parent folders. */
	writeFile: (abs: string, content: string) => Promise<void>;
	/** Create a new empty file (or folder when `dir`). */
	createEntry: (abs: string, dir: boolean) => Promise<void>;
	/** Rename / move a file or folder. */
	rename: (from: string, to: string) => Promise<void>;
	/** Delete a file or folder (folders recursively). */
	remove: (abs: string) => Promise<void>;
	/** Whether a path exists. */
	exists: (abs: string) => Promise<boolean>;

	/** Import a `.zip`: prompts for a destination, extracts, returns the new root (or null). */
	importZip: (zipPath: string) => Promise<string | null>;
	/** Export a project folder to a `.zip` via a native save dialog. False = cancelled. */
	exportZip: (root: string, defaultName: string) => Promise<boolean>;

	/** Reveal a file / folder in the OS file manager (Explorer / Finder / …). */
	revealInOS?: (path: string) => Promise<void>;

	/** Path GlyphTeX was launched to open (file association); consumed once. */
	takeLaunchPath?: () => Promise<string | null>;
	/** Subscribe to later open-path events (a second launch). Returns an unsubscribe fn. */
	onOpenPath?: (cb: (path: string) => void) => Promise<() => void>;
	/** Best-effort: register the "Open with GlyphTeX" folder context menu (Windows). */
	registerShellIntegration?: () => Promise<string>;
	/** Remove the "Open with GlyphTeX" folder context menu (Windows). */
	unregisterShellIntegration?: () => Promise<string>;
	/** Whether the "Open with GlyphTeX" folder context menu is currently registered. */
	shellIntegrationRegistered?: () => Promise<boolean>;
};
