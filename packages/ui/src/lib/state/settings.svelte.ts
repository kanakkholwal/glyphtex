/**
 * GlyphX settings — appearance (theme) + editor preferences.
 *
 * Built on {@link PersistedState}, so every setting is persisted to
 * localStorage and synced live across every Tauri window / browser tab that
 * shares the origin. Change the theme in one window and the others follow
 * within a tick — no `mode-watcher`, no flash.
 *
 * System-theme detection:
 *   - web: `matchMedia('(prefers-color-scheme: dark)')`
 *   - desktop: the Tauri app calls `settings.setSystemTheme()` from the
 *     native theme API (see apps/desktop). That overrides the media query.
 */
import { PersistedState } from "./persisted-state.svelte";

export type Appearance = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type EditorFont = "jetbrains" | "geist";
/** Source Control changes layout: flat list vs collapsible folder tree. */
export type GitView = "tree" | "list";
/** Diff editor layout: side-by-side (two panes) vs inline (unified). */
export type DiffView = "side" | "inline";
/** Which side of the workbench the activity bar + side panel dock on. */
export type SidebarPosition = "left" | "right";
/**
 * When edits are written back to disk (VS Code parity):
 *  - `off`            — only on an explicit save (⌘/Ctrl+S).
 *  - `afterDelay`     — automatically a short while after you stop typing.
 *  - `onFocusChange`  — when the editor loses focus (switching files, blurring
 *                       the window).
 * Compilation always uses the last *saved* content, so this also controls when
 * the preview refreshes.
 */
export type AutoSaveMode = "off" | "afterDelay" | "onFocusChange";

export const AUTO_SAVE_LABELS: Record<AutoSaveMode, string> = {
	off: "Off",
	afterDelay: "After delay",
	onFocusChange: "On focus change",
};
/** Which compile engine to use. `tectonic` = bundled; `system` = local TeX install. */
export type EngineKind = "tectonic" | "system";
/** TeX program latexmk drives when {@link EngineKind} is `system`. */
export type TexProgram = "pdflatex" | "xelatex" | "lualatex";

export const TEX_PROGRAM_LABELS: Record<TexProgram, string> = {
	pdflatex: "pdfLaTeX",
	xelatex: "XeLaTeX",
	lualatex: "LuaLaTeX",
};

/** Editor monospace font stacks (all self-hosted via @fontsource, offline-safe). */
export const EDITOR_FONT_STACKS: Record<EditorFont, string> = {
	jetbrains: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace",
	geist: "'Geist Mono Variable', 'Geist Mono', ui-monospace, monospace",
};
export const EDITOR_FONT_LABELS: Record<EditorFont, string> = {
	jetbrains: "JetBrains Mono",
	geist: "Geist Mono",
};

export interface EditorSettings {
	font: EditorFont;
	fontSize: number;
	lineWrapping: boolean;
	/** Recompile automatically when the saved content changes (debounced). */
	autoCompile: boolean;
	/** When edits are persisted to disk. See {@link AutoSaveMode}. */
	autoSave: AutoSaveMode;
	/**
	 * Allow `\write18` (shell escape) during compilation — required by packages
	 * that run external tools (e.g. `minted`/Pygments, `gnuplot`). Off by default:
	 * it lets a document run arbitrary system commands, so it's opt-in.
	 */
	shellEscape: boolean;
	/** Compile engine: bundled Tectonic (XeTeX) or a local System TeX install. */
	engineKind: EngineKind;
	/** Which TeX program System TeX drives (via latexmk). */
	texProgram: TexProgram;
}

export const EDITOR_DEFAULTS: EditorSettings = {
	font: "jetbrains",
	fontSize: 13,
	lineWrapping: false,
	autoCompile: true,
	autoSave: "afterDelay",
	shellEscape: false,
	engineKind: "tectonic",
	texProgram: "pdflatex",
};

/** Debounce (ms) before an edit triggers an automatic recompile. */
export const COMPILE_DEBOUNCE_MS = 650;

/** Idle time (ms) before "After delay" auto-save writes the buffer to disk. */
export const AUTO_SAVE_DELAY_MS = 1000;

export const APPEARANCE_KEY = "glyphx:appearance";
export const EDITOR_KEY = "glyphx:editor";
export const GIT_VIEW_KEY = "glyphx:git-view";
export const DIFF_VIEW_KEY = "glyphx:diff-view";
export const SIDEBAR_POSITION_KEY = "glyphx:sidebar-position";

const isBrowser = typeof window !== "undefined";

class SettingsStore {
	#appearance = new PersistedState<Appearance>(APPEARANCE_KEY, "system");
	#editor = new PersistedState<EditorSettings>(EDITOR_KEY, EDITOR_DEFAULTS);
	#gitView = new PersistedState<GitView>(GIT_VIEW_KEY, "tree");
	#diffView = new PersistedState<DiffView>(DIFF_VIEW_KEY, "side");
	#sidebarPosition = new PersistedState<SidebarPosition>(SIDEBAR_POSITION_KEY, "left");

	/** OS preference. Light on the server; corrected on the client. */
	#system = $state<ResolvedTheme>("light");
	#mediaBound = false;

	constructor() {
		if (isBrowser) this.#bindMedia();
	}

	#bindMedia() {
		if (this.#mediaBound) return;
		this.#mediaBound = true;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		this.#system = mq.matches ? "dark" : "light";
		mq.addEventListener("change", (e) => {
			this.#system = e.matches ? "dark" : "light";
		});
	}

	// --- appearance -----------------------------------------------------------
	get appearance(): Appearance {
		return this.#appearance.current;
	}
	set appearance(value: Appearance) {
		this.#appearance.current = value;
	}

	/** The detected OS theme. */
	get system(): ResolvedTheme {
		return this.#system;
	}

	/** What the UI should actually render (`system` collapsed to light/dark). */
	get resolved(): ResolvedTheme {
		const a = this.#appearance.current;
		return a === "system" ? this.#system : a;
	}

	/** Desktop feeds the native OS theme here (Tauri), overriding matchMedia. */
	setSystemTheme(theme: ResolvedTheme) {
		this.#system = theme;
	}

	/** Flip between light and dark relative to what's currently shown. */
	toggle() {
		this.appearance = this.resolved === "dark" ? "light" : "dark";
	}

	/** Step light → dark → system → light. */
	cycle() {
		const order: Appearance[] = ["light", "dark", "system"];
		const i = order.indexOf(this.#appearance.current);
		this.appearance = order[(i + 1) % order.length];
	}

	/**
	 * Toggle `.dark` on <html>. Call from a component `$effect` so it tracks
	 * `resolved` and re-applies on toggle *and* on cross-window storage sync.
	 */
	apply() {
		if (!isBrowser) return;
		const dark = this.resolved === "dark";
		const root = document.documentElement;
		root.classList.toggle("dark", dark);
		root.style.colorScheme = dark ? "dark" : "light";
	}

	// --- editor preferences ---------------------------------------------------
	get editor(): EditorSettings {
		return this.#editor.current;
	}
	patchEditor(patch: Partial<EditorSettings>) {
		this.#editor.current = { ...this.#editor.current, ...patch };
	}

	get font(): EditorFont {
		return this.#editor.current.font;
	}
	set font(value: EditorFont) {
		this.patchEditor({ font: value });
	}
	get fontStack(): string {
		return EDITOR_FONT_STACKS[this.#editor.current.font];
	}

	get fontSize(): number {
		return this.#editor.current.fontSize;
	}
	set fontSize(value: number) {
		this.patchEditor({ fontSize: value });
	}

	get lineWrapping(): boolean {
		return this.#editor.current.lineWrapping;
	}
	set lineWrapping(value: boolean) {
		this.patchEditor({ lineWrapping: value });
	}

	get autoCompile(): boolean {
		return this.#editor.current.autoCompile;
	}
	set autoCompile(value: boolean) {
		this.patchEditor({ autoCompile: value });
	}

	get autoSave(): AutoSaveMode {
		return this.#editor.current.autoSave ?? "afterDelay";
	}
	set autoSave(value: AutoSaveMode) {
		this.patchEditor({ autoSave: value });
	}

	get shellEscape(): boolean {
		return this.#editor.current.shellEscape ?? false;
	}
	set shellEscape(value: boolean) {
		this.patchEditor({ shellEscape: value });
	}

	get engineKind(): EngineKind {
		return this.#editor.current.engineKind ?? "tectonic";
	}
	set engineKind(value: EngineKind) {
		this.patchEditor({ engineKind: value });
	}

	get texProgram(): TexProgram {
		return this.#editor.current.texProgram ?? "pdflatex";
	}
	set texProgram(value: TexProgram) {
		this.patchEditor({ texProgram: value });
	}

	// --- source control -------------------------------------------------------
	/** Source Control changes layout (persisted). */
	get gitView(): GitView {
		return this.#gitView.current;
	}
	set gitView(value: GitView) {
		this.#gitView.current = value;
	}

	/** Diff editor layout — side-by-side vs inline (persisted). */
	get diffView(): DiffView {
		return this.#diffView.current;
	}
	set diffView(value: DiffView) {
		this.#diffView.current = value;
	}

	/** Which side the activity bar + side panel dock on (persisted). */
	get sidebarPosition(): SidebarPosition {
		return this.#sidebarPosition.current;
	}
	set sidebarPosition(value: SidebarPosition) {
		this.#sidebarPosition.current = value;
	}
}

/** App-wide singleton. */
export const settings = new SettingsStore();
