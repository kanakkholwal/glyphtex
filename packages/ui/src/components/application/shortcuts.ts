/**
 * shortcuts.ts — the single registry for every keyboard shortcut in the editor.
 *
 * One place defines the combo, its human label, and the category it belongs to.
 * Everything else reads from here:
 *  - the application menu (File / Edit / …) pulls its `shortcut` hints via
 *    `shortcutLabel(id)`,
 *  - the global keydown handler matches events via `matchShortcut(e, id)`,
 *  - the "Keyboard Shortcuts" dialog renders the whole list grouped by category.
 *
 * Combos are written platform-neutral with the token `Mod` (⌘ on macOS, Ctrl
 * everywhere else); `Shift` / `Alt` and a final key follow. A shortcut may list
 * more than one combo (e.g. Redo is Mod+Shift+Z *or* Mod+Y). Save is Mod+S and
 * Compile is Mod+Enter — kept distinct so ⌘S never triggers a build.
 */

export type ShortcutCategory =
	| "Files & project"
	| "Editing"
	| "Search"
	| "Compile & preview"
	| "View";

export type Shortcut = {
	/** Stable id used by the menu + keydown handler. */
	id: string;
	/** Human-readable action name (shown in the shortcuts dialog). */
	label: string;
	category: ShortcutCategory;
	/** One or more key combos; the first is the canonical one shown in menus. */
	combos: string[];
};

// Declared in display order; the dialog groups by `category` preserving this order.
export const SHORTCUTS: Shortcut[] = [
	{ id: "quick-open", label: "Go to file", category: "Files & project", combos: ["Mod+P"] },
	{ id: "open-folder", label: "Open folder", category: "Files & project", combos: ["Mod+O"] },
	{ id: "new-file", label: "New file", category: "Files & project", combos: ["Mod+N"] },
	{ id: "save", label: "Save", category: "Files & project", combos: ["Mod+S"] },
	{ id: "save-all", label: "Save all", category: "Files & project", combos: ["Mod+Shift+S"] },

	{ id: "undo", label: "Undo", category: "Editing", combos: ["Mod+Z"] },
	{ id: "redo", label: "Redo", category: "Editing", combos: ["Mod+Shift+Z", "Mod+Y"] },

	{ id: "find", label: "Find & replace in file", category: "Search", combos: ["Mod+F"] },

	{ id: "compile", label: "Compile", category: "Compile & preview", combos: ["Mod+Enter"] },
	{ id: "sync-pdf", label: "Sync editor to PDF", category: "Compile & preview", combos: ["Mod+J"] },

	{ id: "toggle-sidebar", label: "Toggle sidebar", category: "View", combos: ["Mod+B"] },
];

const byId = new Map(SHORTCUTS.map((s) => [s.id, s] as const));

export function getShortcut(id: string): Shortcut | undefined {
	return byId.get(id);
}

/** Ordered list of categories that actually have shortcuts. */
export function shortcutCategories(): ShortcutCategory[] {
	const seen: ShortcutCategory[] = [];
	for (const s of SHORTCUTS) if (!seen.includes(s.category)) seen.push(s.category);
	return seen;
}

export function shortcutsByCategory(category: ShortcutCategory): Shortcut[] {
	return SHORTCUTS.filter((s) => s.category === category);
}

export function isMacPlatform(): boolean {
	if (typeof navigator === "undefined") return false;
	const p = navigator.platform || navigator.userAgent || "";
	return /mac|iphone|ipad|ipod/i.test(p);
}

const TOKEN_LABEL: Record<string, { mac: string; other: string }> = {
	Mod: { mac: "⌘", other: "Ctrl" },
	Shift: { mac: "⇧", other: "Shift" },
	Alt: { mac: "⌥", other: "Alt" },
	Enter: { mac: "↵", other: "Enter" },
};

function tokenLabel(token: string, mac: boolean): string {
	const known = TOKEN_LABEL[token];
	if (known) return mac ? known.mac : known.other;
	return token.length === 1 ? token.toUpperCase() : token;
}

/** Render a single combo (e.g. "Mod+Shift+Z") for display. */
export function formatCombo(combo: string, mac = isMacPlatform()): string {
	const parts = combo.split("+").map((t) => tokenLabel(t, mac));
	// macOS convention packs modifiers tight (⌘⇧Z); elsewhere we join with "+".
	return mac ? parts.join("") : parts.join("+");
}

/** The canonical (first) combo of a shortcut, formatted — for menu hints. */
export function shortcutLabel(id: string, mac = isMacPlatform()): string {
	const s = byId.get(id);
	return s ? formatCombo(s.combos[0], mac) : "";
}

/** All combos of a shortcut, each formatted — for the shortcuts dialog. */
export function shortcutCombos(id: string, mac = isMacPlatform()): string[] {
	const s = byId.get(id);
	return s ? s.combos.map((c) => formatCombo(c, mac)) : [];
}

function comboMatches(e: KeyboardEvent, combo: string, mac: boolean): boolean {
	const tokens = combo.split("+");
	const wantMod = tokens.includes("Mod");
	const wantShift = tokens.includes("Shift");
	const wantAlt = tokens.includes("Alt");
	const key = tokens[tokens.length - 1];

	const modDown = mac ? e.metaKey : e.ctrlKey;
	if (wantMod !== modDown) return false;
	if (wantShift !== e.shiftKey) return false;
	if (wantAlt !== e.altKey) return false;

	if (key === "Enter") return e.key === "Enter";
	return e.key.toLowerCase() === key.toLowerCase();
}

/** True when a keyboard event matches any combo of the given shortcut id. */
export function matchShortcut(e: KeyboardEvent, id: string, mac = isMacPlatform()): boolean {
	const s = byId.get(id);
	if (!s) return false;
	return s.combos.some((c) => comboMatches(e, c, mac));
}
