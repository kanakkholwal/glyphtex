/**
 * JetBrains-matched Monaco themes.
 *
 * Two faithful ports of the JetBrains *Islands* colour schemes (the New UI look
 * that became the IDE default in 2025.3):
 *   - `islandDark`  → "Islands Dark"  (editor scheme `IslandSchemeDark.xml`)
 *   - `islandLight` → "Islands Light" (editor scheme `expUI_lightScheme.xml`)
 *
 * Values are transcribed from the IntelliJ Community sources, not guessed:
 * `platform/platform-resources/src/themes/islands/*` for the theme JSON and the
 * dark editor scheme, `themes/expUI/expUI_lightScheme.xml` for the light one
 * (Islands Light declares `"editorScheme": "Light"` — it does NOT ship its own
 * editor scheme, so its text surface is the New UI Light scheme). Anything the
 * Islands scheme leaves unset resolves through its declared parent, `Darcula`
 * (that is where the dark selection blue comes from).
 *
 * Islands Dark is NOT Darcula: it sits on a deeper, neutral #191a1c rather than
 * Darcula's warm #2b2b2b, and the gutter is flush with the text surface instead
 * of being a lighter strip.
 *
 * As with the CodeMirror port in `./jetbrains.ts`, these are intentionally the
 * *real* JetBrains palettes, NOT the warm Clay app chrome — the editor keeps its
 * own IDE identity.
 *
 * Monaco parses `rules[].foreground` with `/^#?([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?$/`
 * and then discards the alpha pair, so token colours here must stay fully
 * opaque; only the `colors` map supports #rrggbbaa.
 */
import type * as Monaco from "monaco-editor";
import type { MonacoNamespace } from "./monaco";

export const ISLAND_DARK = "glyphx-island-dark";
export const ISLAND_LIGHT = "glyphx-island-light";

/* ------------------------------------------------------------ Islands Dark */

const dark = {
	bg: "#191a1c",
	fg: "#bcbec4",
	caret: "#ced0d6",
	selection: "#214283",
	selectionMatch: "#373b39",
	// Gutter is intentionally flush with the text surface (the Islands scheme
	// leaves EDITOR_GUTTER_BACKGROUND empty); the current line number pops in the
	// brand accent instead of JetBrains' #a1a3ab.
	gutterBg: "#191a1c",
	gutterFg: "#4b5059",
	gutterActiveFg: "#34d399",
	lineHighlight: "#1f2024",
	indentGuide: "#323438",
	indentGuideActive: "#4e5157",
	matchedBrace: "#43454a",
	// Popups sit on the "layer 1" island surface, one step above the editor.
	widgetBg: "#26282c",
	widgetBorder: "#33353b",
	widgetSelection: "#2a4371",
	scrollbar: "#ffffff26",
	scrollbarHover: "#ffffff4d",
	whitespace: "#6f737a",
	// The squiggle colours (EFFECT_COLOR), not the quieter error-stripe colours.
	error: "#fa6675",
	warning: "#f2c55c",
	// syntax
	keyword: "#cf8e6d",
	comment: "#7a7e85",
	string: "#6aab73",
	number: "#2aacb8",
	func: "#56a8f5",
	constant: "#c77dbb",
	meta: "#b3ae60",
	invalid: "#f75464",
} as const;

/* ----------------------------------------------------------- Islands Light */

const light = {
	bg: "#ffffff",
	fg: "#080808",
	caret: "#000000",
	selection: "#a6d2ff",
	selectionMatch: "#edebfc",
	// Neutral (cool) active-line tint, matching the CodeMirror port's deliberate
	// departure from the warm cream JetBrains uses here — with the current line
	// number in accent rather than JetBrains' #767a8a.
	gutterBg: "#ffffff",
	gutterFg: "#aeb3c2",
	gutterActiveFg: "#0d9373",
	lineHighlight: "#f5f8fe",
	indentGuide: "#ebecf0",
	indentGuideActive: "#aeb3c2",
	matchedBrace: "#93d9d9",
	widgetBg: "#ffffff",
	widgetBorder: "#e9eaee",
	widgetSelection: "#d0dffe",
	// The Light scheme has no Mac scrollbar override, so these are neutral inks
	// at the same weights the dark scheme uses.
	scrollbar: "#0000001a",
	scrollbarHover: "#00000033",
	whitespace: "#adadad",
	error: "#ff0000",
	warning: "#ebc700",
	// syntax
	keyword: "#0033b3",
	comment: "#8c8c8c",
	string: "#067d17",
	number: "#1750eb",
	func: "#00627a",
	constant: "#871094",
	meta: "#9e880d",
	invalid: "#ff0000",
} as const;

type Palette = typeof dark | typeof light;

/**
 * Maps the tokens the LaTeX Monarch grammar emits onto the scheme.
 *
 * LaTeX has no JetBrains equivalent, so a few mappings are judgement calls:
 * environment names take the declaration colour (they name the construct being
 * opened), `\ref`/`\cite`/`\label` arguments take it too (they are navigable
 * identifiers, not free text), and math delimiters take the number colour so
 * entering math mode is visible at a glance.
 */
function rules(p: Palette): Monaco.editor.ITokenThemeRule[] {
	return [
		{ token: "comment", foreground: p.comment, fontStyle: "italic" },
		{ token: "keyword", foreground: p.keyword },
		{ token: "keyword.control", foreground: p.keyword, fontStyle: "bold" },
		{ token: "string", foreground: p.string },
		{ token: "number", foreground: p.number },
		{ token: "delimiter.curly", foreground: p.fg },
		{ token: "delimiter.square", foreground: p.fg },
		{ token: "delimiter.math", foreground: p.number },
		{ token: "type", foreground: p.func },
		{ token: "variable", foreground: p.func },
		{ token: "constant", foreground: p.constant },
		{ token: "operator", foreground: p.fg },
		{ token: "tag", foreground: p.keyword },
		{ token: "attribute.name", foreground: p.meta },
		{ token: "invalid", foreground: p.invalid, fontStyle: "underline" },

		// --- Semantic tokens (see latex-semantic.ts) -------------------------
		// Monaco resolves these by matching the semantic token TYPE NAME against
		// this same rules list — `standaloneThemeService.getTokenStyleMetadata`
		// does `tokenTheme._match([type, ...modifiers].join("."))` — so they are
		// plain entries here rather than a separate semanticTokenColors map,
		// which the standalone theme format has no field for.
		//
		// These deliberately only *tint*. A false positive is possible (a macro
		// from a package we ship no data for reads as unknown), so nothing here
		// is allowed to look like a hard error the way `invalid` does.
		{ token: "macro", foreground: p.constant },
		{ token: "unknownMacro", foreground: p.invalid },
		{ token: "danglingRef", foreground: p.warning, fontStyle: "underline" },
		{ token: "resolvedRef", foreground: p.func },
	];
}

function colors(p: Palette): Monaco.editor.IColors {
	return {
		"editor.background": p.bg,
		"editor.foreground": p.fg,
		"editorCursor.foreground": p.caret,
		"editor.selectionBackground": p.selection,
		"editor.selectionHighlightBackground": p.selectionMatch,
		"editor.lineHighlightBackground": p.lineHighlight,
		"editorLineNumber.foreground": p.gutterFg,
		"editorLineNumber.activeForeground": p.gutterActiveFg,
		"editorIndentGuide.background1": p.indentGuide,
		"editorIndentGuide.activeBackground1": p.indentGuideActive,
		"editorBracketMatch.background": p.matchedBrace,
		"editorBracketMatch.border": p.indentGuideActive,
		"editorWidget.background": p.widgetBg,
		"editorWidget.border": p.widgetBorder,
		"editorSuggestWidget.background": p.widgetBg,
		"editorSuggestWidget.selectedBackground": p.widgetSelection,
		"editorGutter.background": p.gutterBg,
		"scrollbarSlider.background": p.scrollbar,
		"scrollbarSlider.hoverBackground": p.scrollbarHover,
		"editorWhitespace.foreground": p.whitespace,
		"editorError.foreground": p.error,
		"editorWarning.foreground": p.warning,
	};
}

export const islandDark: Monaco.editor.IStandaloneThemeData = {
	base: "vs-dark",
	inherit: true,
	rules: rules(dark),
	colors: colors(dark),
};

export const islandLight: Monaco.editor.IStandaloneThemeData = {
	base: "vs",
	inherit: true,
	rules: rules(light),
	colors: colors(light),
};

// `defineTheme` re-applies the theme to every editor already using it, so guard
// against redefining on each dynamic monaco import.
const registered = new WeakSet<MonacoNamespace>();

export function registerJetBrainsThemes(monaco: MonacoNamespace): void {
	if (registered.has(monaco)) return;
	monaco.editor.defineTheme(ISLAND_DARK, islandDark);
	monaco.editor.defineTheme(ISLAND_LIGHT, islandLight);
	registered.add(monaco);
}

export function jetbrainsThemeName(theme: "light" | "dark"): string {
	return theme === "dark" ? ISLAND_DARK : ISLAND_LIGHT;
}
