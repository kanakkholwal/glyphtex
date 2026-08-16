/** Shared structural types for the side panel (pure). */

/** Which view the panel is showing. Was the vertical activity rail's job; the
 *  panel now carries its own horizontal tabs. */
export type ActivityView = "files" | "search" | "git";

export type FileMeta = { id: string; name: string };

export type SearchOptions = {
	query: string;
	replace?: string;
	caseSensitive?: boolean;
	wholeWord?: boolean;
	regexp?: boolean;
	preserveCase?: boolean;
};

export type SearchMatch = {
	from: number;
	to: number;
	line: number;
	column: number;
	text: string;
};

/** Explorer selection (VS Code style): one file or folder at a time. */
export type Sel = { type: "file"; id: string } | { type: "folder"; path: string };
