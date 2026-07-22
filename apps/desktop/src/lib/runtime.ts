/** True inside the Tauri webview, false in a plain browser. The single owner of this
 *  check — import it rather than re-deriving the predicate (AGENTS.md §3). */
export function isTauriRuntime(): boolean {
	return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || 'isTauri' in window);
}
