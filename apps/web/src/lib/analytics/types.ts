/** A pluggable analytics backend. Add one to the registry in `./index.ts`. */
export type AnalyticsProvider = {
	readonly name: string;
	/** False when the backend has no configuration; it is then skipped entirely. */
	readonly enabled: boolean;
	/** Load whatever the backend needs (a script tag, a session). Called at most once. */
	load: () => void | Promise<void>;
	pageview: (path: string, title?: string) => void;
	event: (name: AnalyticsEvent, params: EventParams) => void;
	/** Silence a backend already loaded in this page, for a mid-session opt-out. */
	setEnabled?: (enabled: boolean) => void;
};

/**
 * Every event the app may send. A closed union so a rename can't silently split a
 * metric in two, and so the privacy page can be checked against this list.
 */
export type AnalyticsEvent =
	// Marketing site
	| 'cta_workspace_click'
	| 'download_click'
	| 'engine_cta_workspace'
	| 'engine_cta_workspace_footer'
	// Workspace lifecycle
	| 'document_created'
	| 'document_opened'
	| 'document_deleted'
	| 'document_duplicated'
	| 'document_renamed'
	| 'document_starred'
	| 'document_exported'
	// Engine
	| 'engine_installed'
	| 'compile_finished'
	// Source control
	| 'git_action';

/**
 * Event parameters. Values are counts, durations, and fixed enums only — never a
 * document name, file path, URL, or anything typed into the editor.
 */
export type EventParams = Record<string, string | number | boolean | undefined>;

/** Where a new document came from. */
export type DocumentSource = 'blank' | 'template' | 'import_zip' | 'import_folder' | 'git_clone';
