/**
 * True when running inside the Tauri webview (the desktop app) rather than a
 * plain browser (the SvelteKit dev server opened in a tab). `__TAURI_INTERNALS__`
 * / `isTauri` are injected by Tauri and never present in a normal browser.
 *
 * This is the single source for the check — `compile.ts`, `save.ts`,
 * `tauri-theme.ts`, and the updater all import it instead of re-deriving the
 * same predicate (AGENTS.md §3 — one owner per fact, even for a derived check).
 */
export function isTauriRuntime(): boolean {
	return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || 'isTauri' in window);
}
