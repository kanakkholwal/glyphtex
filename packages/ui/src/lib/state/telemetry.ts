export type TelemetryParams = Record<string, string | number | boolean | undefined>;

/**
 * Every event the workbench reports. Closed so a host can type its own analytics
 * union against it, and so a rename cannot silently split a metric in two.
 */
export type WorkbenchEvent =
	// Chrome
	| "editor_mode_changed"
	| "view_changed"
	| "panel_view_changed"
	| "panel_toggled"
	| "dock_tab_changed"
	| "split_direction_changed"
	| "command_palette_opened"
	| "diff_opened"
	// Files
	| "file_created"
	| "file_renamed"
	| "file_deleted"
	| "file_moved"
	| "file_duplicated"
	| "main_file_set"
	// Editing
	| "format_applied"
	| "project_search_run"
	| "project_replace_all"
	| "note_added"
	// Build
	| "compile_started"
	| "pdf_downloaded";

/** Receives workbench events. The host decides which backend they reach, if any. */
export type TelemetrySink = (name: WorkbenchEvent, params: TelemetryParams) => void;

let sink: TelemetrySink | null = null;

/** Install the host's sink. Unset (the default) makes every `emit` a no-op, which
 *  is what the desktop build ships. */
export function setTelemetry(fn: TelemetrySink | null): void {
	sink = fn;
}

export function emit(name: WorkbenchEvent, params: TelemetryParams = {}): void {
	try {
		sink?.(name, params);
	} catch {
		/* a dead sink must never take the editor down */
	}
}
