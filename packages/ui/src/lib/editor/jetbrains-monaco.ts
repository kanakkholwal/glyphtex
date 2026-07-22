import type * as Monaco from "monaco-editor";
import type { MonacoNamespace } from "./monaco";

export const ISLAND_DARK = "glyphtex-island-dark";
export const ISLAND_LIGHT = "glyphtex-island-light";

// --- Islands Dark ---

// Transcribed from IntelliJ Community `platform/platform-resources/src/themes/islands/*`;
// exported because app.css derives the workbench tokens from this same palette.
export const islandDarkPalette = {
	bg: "#191a1c",
	fg: "#bcbec4",
	caret: "#ced0d6",
	// Islands leaves selection unset; this comes from its parent scheme, Darcula.
	selection: "#214283",
	selectionMatch: "#373b39",
	// Islands leaves EDITOR_GUTTER_BACKGROUND empty, so the gutter is flush with the
	// text surface; the active line number uses the brand accent, not JetBrains' #a1a3ab.
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
	// --- syntax ---
	keyword: "#cf8e6d",
	comment: "#7a7e85",
	string: "#6aab73",
	number: "#2aacb8",
	func: "#56a8f5",
	constant: "#c77dbb",
	meta: "#b3ae60",
	invalid: "#f75464",
} as const;

// --- Islands Light ---

// Islands Light declares `"editorScheme": "Light"` and ships none of its own, so these
// are New UI Light values from `themes/expUI/expUI_lightScheme.xml`.
export const islandLightPalette = {
	bg: "#ffffff",
	fg: "#080808",
	caret: "#000000",
	selection: "#a6d2ff",
	selectionMatch: "#edebfc",
	// Deliberately cool active-line tint instead of JetBrains' warm cream, and the
	// active line number in accent rather than #767a8a.
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
	// The Light scheme has no Mac scrollbar override, so these are neutral inks at
	// the dark scheme's weights.
	scrollbar: "#0000001a",
	scrollbarHover: "#00000033",
	whitespace: "#adadad",
	error: "#ff0000",
	warning: "#ebc700",
	// --- syntax ---
	keyword: "#0033b3",
	comment: "#8c8c8c",
	string: "#067d17",
	number: "#1750eb",
	func: "#00627a",
	constant: "#871094",
	meta: "#9e880d",
	invalid: "#ff0000",
} as const;

type Palette = typeof islandDarkPalette | typeof islandLightPalette;

// Monaco discards the alpha pair in `rules[].foreground`, so these must be fully
// opaque; only the `colors` map below supports #rrggbbaa.
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

		// --- Semantic tokens (latex-semantic.ts) ---
		// Monaco matches semantic type names against this same rules list, so they are
		// plain entries; they only tint, since a false positive must not read as an error.
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
	rules: rules(islandDarkPalette),
	colors: colors(islandDarkPalette),
};

export const islandLight: Monaco.editor.IStandaloneThemeData = {
	base: "vs",
	inherit: true,
	rules: rules(islandLightPalette),
	colors: colors(islandLightPalette),
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
