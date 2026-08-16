import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

// --- Islands Dark ---

// Transcribed from IntelliJ Community `platform/platform-resources/src/themes/islands/*`;
// exported because app.css derives the workbench tokens from this same palette.
export const islandDarkPalette = {
	bg: "#191919",
	fg: "#d4d4d4",
	caret: "#e0e0e0",
	// Islands leaves selection unset; this comes from its parent scheme, Darcula.
	selection: "#214283",
	selectionMatch: "#373b39",
	// Islands leaves EDITOR_GUTTER_BACKGROUND empty, so the gutter is flush with the
	// text surface; the active line number uses the brand accent, not JetBrains' #a1a3ab.
	gutterBg: "#191919",
	gutterFg: "#5a5a5a",
	gutterActiveFg: "#34d399",
	lineHighlight: "#202020",
	indentGuide: "#303030",
	indentGuideActive: "#4a4a4a",
	matchedBrace: "#404040",
	// Popups sit on the "layer 1" island surface, one step above the editor.
	widgetBg: "#282828",
	widgetBorder: "#373737",
	widgetSelection: "#2a4371",
	scrollbar: "#ffffff26",
	scrollbarHover: "#ffffff4d",
	whitespace: "#6b6b6b",
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
	invalid: "#f75464"
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
	invalid: "#ff0000"
} as const;

export type EditorPalette = typeof islandDarkPalette | typeof islandLightPalette;

function highlight(p: EditorPalette): HighlightStyle {
	return HighlightStyle.define([
		{ tag: t.comment, color: p.comment, fontStyle: "italic" },
		{ tag: t.keyword, color: p.keyword },
		// stex marks \begin / \end as tags; they are the document's scaffolding.
		{ tag: t.tagName, color: p.keyword, fontWeight: "bold" },
		{ tag: t.string, color: p.string },
		{ tag: t.number, color: p.number },
		{ tag: t.atom, color: p.constant },
		{ tag: t.bracket, color: p.fg },
		{ tag: [t.brace, t.squareBracket, t.paren], color: p.fg },
		// StreamLanguage maps the legacy `builtin` token onto variableName.standard.
		{ tag: t.standard(t.variableName), color: p.func },
		{ tag: t.variableName, color: p.func },
		{ tag: t.special(t.variableName), color: p.func },
		{ tag: t.typeName, color: p.func },
		{ tag: t.meta, color: p.meta },
		{ tag: t.operator, color: p.fg },
		{ tag: t.invalid, color: p.invalid, textDecoration: "underline" }
	]);
}

function theme(p: EditorPalette, dark: boolean): Extension {
	return EditorView.theme(
		{
			"&": { backgroundColor: p.bg, color: p.fg },
			".cm-content": { caretColor: p.caret, lineHeight: "1.6" },
			".cm-cursor, .cm-dropCursor": { borderLeftColor: p.caret, borderLeftWidth: "2px" },
			// CM6 paints selection on a child layer when focused and via ::selection
			// when not; both need the colour or the selection vanishes on blur.
			"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
				backgroundColor: p.selection
			},
			".cm-selectionMatch": { backgroundColor: p.selectionMatch },
			".cm-activeLine": { backgroundColor: p.lineHighlight },
			".cm-gutters": {
				backgroundColor: p.gutterBg,
				color: p.gutterFg,
				border: "none"
			},
			".cm-activeLineGutter": { backgroundColor: p.lineHighlight, color: p.gutterActiveFg },
			".cm-foldGutter .cm-gutterElement": { opacity: "0", transition: "opacity 120ms" },
			".cm-gutters:hover .cm-foldGutter .cm-gutterElement": { opacity: "1" },
			".cm-foldPlaceholder": {
				backgroundColor: p.widgetBg,
				border: `1px solid ${p.widgetBorder}`,
				color: p.comment,
				borderRadius: "4px",
				padding: "0 6px",
				margin: "0 2px"
			},
			"&.cm-focused .cm-matchingBracket": {
				backgroundColor: p.matchedBrace,
				outline: `1px solid ${p.indentGuideActive}`
			},
			"&.cm-focused .cm-nonmatchingBracket": { color: p.invalid },
			".cm-tooltip": {
				backgroundColor: p.widgetBg,
				border: `1px solid ${p.widgetBorder}`,
				borderRadius: "6px",
				color: p.fg,
				overflow: "hidden"
			},
			".cm-tooltip.cm-tooltip-autocomplete > ul": { fontFamily: "inherit", maxHeight: "18em" },
			".cm-tooltip.cm-tooltip-autocomplete > ul > li": { padding: "3px 8px" },
			".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
				backgroundColor: p.widgetSelection,
				color: p.fg
			},
			".cm-completionIcon": { display: "none" },
			".cm-completionDetail": { color: p.comment, fontStyle: "normal", marginLeft: "1em" },
			".cm-completionMatchedText": { textDecoration: "none", color: p.func, fontWeight: "600" },
			".cm-tooltip.cm-completionInfo": {
				backgroundColor: p.widgetBg,
				borderLeft: `1px solid ${p.widgetBorder}`,
				padding: "6px 8px",
				maxWidth: "24em"
			},
			// Sticky headings (latex-sticky.ts) overlay the first rendered line, so
			// they need an opaque fill or the text shows through.
			".cm-tex-sticky": {
				position: "absolute",
				top: "0",
				left: "0",
				right: "0",
				zIndex: "2",
				backgroundColor: p.bg,
				// Monaco separated sticky scroll with a shadow, not a rule: a hairline
				// here reads as a second gutter edge against the real one below.
				boxShadow: `0 3px 6px -3px ${p.scrollbarHover}`,
				// The strip itself must not eat clicks meant for the text beneath it;
				// only the rows are interactive.
				pointerEvents: "none"
			},
			".cm-tex-sticky-row": {
				display: "flex",
				alignItems: "center",
				pointerEvents: "auto",
				width: "100%",
				textAlign: "left",
				padding: "0",
				border: "none",
				background: "none",
				color: p.fg,
				font: "inherit",
				lineHeight: "1.6",
				cursor: "pointer",
				whiteSpace: "pre",
				overflow: "hidden"
			},
			".cm-tex-sticky-num": {
				flex: "none",
				textAlign: "right",
				paddingRight: "10px",
				color: p.gutterFg,
				boxSizing: "border-box"
			},
			".cm-tex-sticky-code": { overflow: "hidden", textOverflow: "ellipsis" },
			".cm-tex-sticky-kw": { color: p.keyword },
			".cm-tex-sticky-row:hover": { backgroundColor: p.lineHighlight },
			".cm-tex-sticky-row:hover .cm-tex-sticky-num": { color: p.gutterActiveFg },
			// Semantic layer (latex-semantic.ts). These only tint: a false positive
			// must never read as an error, so nothing here draws a squiggle.
			".cm-tex-macro": { color: p.constant },
			".cm-tex-unknown": { color: p.invalid },
			".cm-tex-dangling": { color: p.warning, textDecoration: "underline dotted" },
			".cm-tex-resolved": { color: p.func },
			".cm-latex-hover": { padding: "6px 8px", maxWidth: "24em", fontSize: "12px" },
			".cm-latex-hover code": { color: p.keyword, fontWeight: "600" },
			".cm-latex-hover-body": { marginTop: "4px", color: p.fg, opacity: "0.85" },
			".cm-latex-hover-source": { marginTop: "4px", color: p.comment },
			".cm-panels": { backgroundColor: p.widgetBg, color: p.fg },
			".cm-scroller": { overflow: "auto" },
			".cm-searchMatch": { backgroundColor: p.selectionMatch, outline: `1px solid ${p.warning}` },
			".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: p.selection },
			// The scrollbar is the editor's own, not the app shell's: colour it from
			// the palette so it reads as part of the text surface.
			".cm-scroller::-webkit-scrollbar": { width: "10px", height: "10px" },
			".cm-scroller::-webkit-scrollbar-thumb": {
				backgroundColor: p.scrollbar,
				borderRadius: "5px"
			},
			".cm-scroller::-webkit-scrollbar-thumb:hover": { backgroundColor: p.scrollbarHover },
			".cm-scroller::-webkit-scrollbar-track": { background: "transparent" }
		},
		{ dark }
	);
}

const DARK = [theme(islandDarkPalette, true), syntaxHighlighting(highlight(islandDarkPalette))];
const LIGHT = [theme(islandLightPalette, false), syntaxHighlighting(highlight(islandLightPalette))];

/** The JetBrains Islands editor theme, for a `themeCompartment.reconfigure`. */
export function editorTheme(mode: "light" | "dark"): Extension {
	return mode === "dark" ? DARK : LIGHT;
}
