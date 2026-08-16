export type ShortcutCategory =
	| 'Files & project'
	| 'Open files'
	| 'Editing'
	| 'Search'
	| 'Compile & preview'
	| 'View';

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
/** The one registry the menu, keydown handler, and shortcuts dialog all read from.
 *  `Mod` is ⌘ on macOS and Ctrl everywhere else. */
export const SHORTCUTS: Shortcut[] = [
	{
		id: 'quick-open',
		label: 'Go to file',
		category: 'Files & project',
		combos: ['Mod+K', 'Mod+P']
	},
	{ id: 'open-folder', label: 'Open folder', category: 'Files & project', combos: ['Mod+O'] },
	{ id: 'new-file', label: 'New file', category: 'Files & project', combos: ['Mod+N'] },
	{ id: 'save', label: 'Save', category: 'Files & project', combos: ['Mod+S'] },
	{ id: 'save-all', label: 'Save all', category: 'Files & project', combos: ['Mod+Shift+S'] },

	// All Alt-based: browsers own Mod+W, Mod+Shift+W and Mod+Shift+T, and a
	// shortcut that closes the whole window is not a tab shortcut.
	{
		id: 'next-tab',
		label: 'Next open file',
		category: 'Open files',
		combos: ['Mod+Alt+ArrowRight']
	},
	{
		id: 'prev-tab',
		label: 'Previous open file',
		category: 'Open files',
		combos: ['Mod+Alt+ArrowLeft']
	},
	{ id: 'close-tab', label: 'Close open file', category: 'Open files', combos: ['Mod+Alt+W'] },
	{ id: 'reopen-tab', label: 'Reopen closed file', category: 'Open files', combos: ['Mod+Alt+T'] },
	{ id: 'go-to-tab', label: 'Go to open file 1…9', category: 'Open files', combos: ['Mod+1'] },

	{ id: 'undo', label: 'Undo', category: 'Editing', combos: ['Mod+Z'] },
	{ id: 'redo', label: 'Redo', category: 'Editing', combos: ['Mod+Shift+Z', 'Mod+Y'] },

	{ id: 'find', label: 'Find & replace in file', category: 'Search', combos: ['Mod+F'] },
	{
		id: 'search-project',
		label: 'Search the project',
		category: 'Search',
		combos: ['Mod+Shift+F']
	},

	{ id: 'compile', label: 'Compile', category: 'Compile & preview', combos: ['Mod+Enter'] },
	{ id: 'sync-pdf', label: 'Sync editor to PDF', category: 'Compile & preview', combos: ['Mod+J'] },

	{ id: 'toggle-sidebar', label: 'Toggle sidebar', category: 'View', combos: ['Mod+B'] },
	{ id: 'toggle-panel', label: 'Toggle bottom panel', category: 'View', combos: ['Mod+Shift+M'] },
	{ id: 'toggle-notes', label: 'Toggle notes', category: 'View', combos: ['Mod+Shift+N'] }
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
	if (typeof navigator === 'undefined') return false;
	const p = navigator.platform || navigator.userAgent || '';
	return /mac|iphone|ipad|ipod/i.test(p);
}

const TOKEN_LABEL: Record<string, { mac: string; other: string }> = {
	Mod: { mac: '⌘', other: 'Ctrl' },
	Shift: { mac: '⇧', other: 'Shift' },
	Alt: { mac: '⌥', other: 'Alt' },
	Enter: { mac: '↵', other: 'Enter' },
	ArrowLeft: { mac: '←', other: '←' },
	ArrowRight: { mac: '→', other: '→' }
};

function tokenLabel(token: string, mac: boolean): string {
	const known = TOKEN_LABEL[token];
	if (known) return mac ? known.mac : known.other;
	return token.length === 1 ? token.toUpperCase() : token;
}

/** Render a single combo (e.g. "Mod+Shift+Z") for display. */
export function formatCombo(combo: string, mac = isMacPlatform()): string {
	const parts = combo.split('+').map((t) => tokenLabel(t, mac));
	// macOS convention packs modifiers tight (⌘⇧Z); elsewhere we join with "+".
	return mac ? parts.join('') : parts.join('+');
}

/** The canonical (first) combo of a shortcut, formatted: for menu hints. */
export function shortcutLabel(id: string, mac = isMacPlatform()): string {
	const s = byId.get(id);
	return s ? formatCombo(s.combos[0], mac) : '';
}

/** All combos of a shortcut, each formatted: for the shortcuts dialog. */
export function shortcutCombos(id: string, mac = isMacPlatform()): string[] {
	const s = byId.get(id);
	return s ? s.combos.map((c) => formatCombo(c, mac)) : [];
}

function comboMatches(e: KeyboardEvent, combo: string, mac: boolean): boolean {
	const tokens = combo.split('+');
	const wantMod = tokens.includes('Mod');
	const wantShift = tokens.includes('Shift');
	const wantAlt = tokens.includes('Alt');
	const key = tokens[tokens.length - 1];

	const modDown = mac ? e.metaKey : e.ctrlKey;
	if (wantMod !== modDown) return false;
	if (wantShift !== e.shiftKey) return false;
	if (wantAlt !== e.altKey) return false;

	if (key === 'Enter') return e.key === 'Enter';
	if (e.key.toLowerCase() === key.toLowerCase()) return true;
	// Alt rewrites `key` on macOS (⌥W arrives as "∑"), so fall back to the
	// physical key. `code` is layout-dependent, which is why it isn't the default.
	return wantAlt && e.code === (key.length === 1 ? `Key${key.toUpperCase()}` : key);
}

/** True when a keyboard event matches any combo of the given shortcut id. */
export function matchShortcut(e: KeyboardEvent, id: string, mac = isMacPlatform()): boolean {
	const s = byId.get(id);
	if (!s) return false;
	return s.combos.some((c) => comboMatches(e, c, mac));
}
