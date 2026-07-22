// Shared by the editor find bar, the sidebar Search view, and the PDF find bar, so
// the three always read as one component family.

/** Text field. Add a width (`w-full` / `w-44`) and trailing `pr-*` for any
 * in-field toggles at the call site. */
export const SEARCH_INPUT =
	'bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 h-7 rounded border py-1 pl-2 text-sm outline-none transition-[box-shadow,border-color] focus-visible:ring-1';

/** In-field option pill (Aa / W / .*). Use `searchPill(on)` for the full class. */
const SEARCH_PILL_BASE =
	'grid size-[18px] place-items-center rounded font-mono text-xs leading-none transition-colors';
const SEARCH_PILL_ON = 'bg-brand-subtle text-brand';
const SEARCH_PILL_OFF = 'text-muted-foreground hover:bg-muted hover:text-foreground';
export function searchPill(on: boolean): string {
	return `${SEARCH_PILL_BASE} ${on ? SEARCH_PILL_ON : SEARCH_PILL_OFF}`;
}

/** Icon button for prev / next / close / replace-current. */
export const SEARCH_BTN =
	'text-muted-foreground hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded transition-colors disabled:opacity-40';

/** Compact in-field icon button (replace / replace-all sitting inside a field). */
export const SEARCH_BTN_SM =
	'text-muted-foreground hover:bg-muted hover:text-foreground grid size-[18px] place-items-center rounded transition-colors disabled:opacity-40';

/** Muted match-count label ("3 of 12" / "No results"). */
export const SEARCH_COUNT = 'text-muted-foreground/70 text-xs tabular-nums';
