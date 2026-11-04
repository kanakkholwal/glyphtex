import type { NewFile } from "$lib/storage/projects";

/** What the editor needs to know about an open document, wherever it is stored. */
export type DocumentMeta = {
	id: string;
	name: string;
	entry: string;
	entryConfirmed?: boolean;
	entryCandidates?: string[];
	/** Cloud only: what this user may do, straight from the server's RBAC. */
	capabilities?: string[];
	role?: string;
};

export type LoadedDocument = { meta: DocumentMeta; files: NewFile[] };

/** The editor's only route to storage: browser (IndexedDB) or a GlyphTeX server. */
export interface DocumentStore {
	readonly kind: "local" | "cloud";
	/** Undefined when the document doesn't exist (or isn't visible to this user). */
	load(id: string): Promise<LoadedDocument | undefined>;
	/** Persist the whole file set; files absent from `files` are deleted. */
	save(id: string, files: NewFile[]): Promise<void>;
	rename(id: string, name: string): Promise<DocumentMeta>;
	setEntry(id: string, path: string): Promise<DocumentMeta>;
}
