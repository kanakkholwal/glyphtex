import { applyCase } from "../case-preserve";
import { toast } from "@glyphtex/ui/sonner";
import { emit } from "@glyphtex/ui/telemetry";

import type { FileStore } from "./files.svelte";
import type { LayoutStore } from "./layout.svelte";
import {
	applyMatches,
	EMPTY_SCAN,
	flattenHits,
	NO_SKIPS,
	replacementFor,
	scanFiles,
	type Hit,
	type ScanResult,
	type SearchSkips
} from "./project-search";
import type { SearchMatch, SearchOptions } from "./types";

export type SearchDeps = {
	layout: LayoutStore;
	files: FileStore;
	getSource: () => string;
};

/** Typing runs a whole-project scan, so coalesce keystrokes into one pass. */
const DEBOUNCE_MS = 140;

/**
 * Two searches, deliberately kept apart.
 *
 * The find bar (⌘F) is the editor's own: it delegates to the CodeMirror handle so
 * its highlights live in the document. The side panel (⇧⌘F) scans every file's
 * text through {@link FileStore}, which is what makes it work across the project,
 * in the Visual editor, and with no editor mounted at all.
 */
export class SearchStore {
	readonly #layout: LayoutStore;
	readonly #files: FileStore;
	readonly #getSource: () => string;

	searchOpts = $state<SearchOptions>({
		query: "",
		replace: "",
		caseSensitive: false,
		wholeWord: false,
		regexp: false
	});
	searchResults = $state<SearchMatch[]>([]);
	searchActive = $state(0);

	// The docked bottom find/replace bar (Ctrl/Cmd+F over the editor pane).
	showFind = $state(false);
	findBar = $state<{ focusInput: () => void }>();

	// --- Project search (the side panel) --------------------------------------
	// Deliberately separate from the find bar above: ⌘F is this file, ⇧⌘F is the
	// project, and they must be able to hold different queries at once.
	projectOpts = $state<SearchOptions>({
		query: "",
		replace: "",
		caseSensitive: false,
		wholeWord: false,
		regexp: false
	});
	projectResult = $state<ScanResult>(EMPTY_SCAN);
	/** What the last scan could not open, so the panel can own the omission. */
	projectSkips = $state<SearchSkips>(NO_SKIPS);
	projectActive = $state(0);
	projectScanning = $state(false);
	/** Files the scan collapsed, by id. */
	collapsedGroups = $state<Record<string, boolean>>({});
	/** Widen past document files to the generated and sidecar ones. Off by default:
	 *  a .toc repeats every heading and a build log repeats every warning. */
	includeOther = $state(false);

	#debounce: ReturnType<typeof setTimeout> | undefined;
	/** Only the newest scan may publish: reads can resolve out of order. */
	#scanToken = 0;

	readonly projectHits = $derived(flattenHits(this.projectResult, this.includeOther));
	readonly activeHit = $derived<Hit | undefined>(this.projectHits[this.projectActive]);
	/** Groups as rendered, which is what the list and its keyboard order follow. */
	readonly visibleGroups = $derived(
		this.includeOther
			? [...this.projectResult.groups, ...this.projectResult.otherGroups]
			: this.projectResult.groups
	);
	readonly visibleTotal = $derived(
		this.projectResult.total + (this.includeOther ? this.projectResult.otherTotal : 0)
	);

	/** Pull the excluded files in (or push them back out) without rescanning. */
	setIncludeOther(on: boolean): void {
		this.includeOther = on;
		this.projectActive = 0;
	}

	constructor(deps: SearchDeps) {
		this.#layout = deps.layout;
		this.#files = deps.files;
		this.#getSource = deps.getSource;
	}

	/** Debounced entry point for typing. */
	queueProjectSearch(o: SearchOptions): void {
		this.projectOpts = o;
		clearTimeout(this.#debounce);
		if (!o.query) {
			this.#resetProject();
			return;
		}
		this.projectScanning = true;
		this.#debounce = setTimeout(() => void this.runProjectSearch(o), DEBOUNCE_MS);
	}

	#resetProject(): void {
		this.projectResult = EMPTY_SCAN;
		this.projectSkips = NO_SKIPS;
		this.projectActive = 0;
		this.projectScanning = false;
	}

	async runProjectSearch(o: SearchOptions = this.projectOpts, report = true): Promise<void> {
		const token = ++this.#scanToken;
		this.projectOpts = o;
		if (!o.query) {
			this.#resetProject();
			return;
		}
		const { inputs, skips } = await this.#files.searchableFiles();
		if (token !== this.#scanToken) return;
		this.projectResult = scanFiles(inputs, o);
		this.projectSkips = skips;
		this.projectActive = 0;
		this.projectScanning = false;
		// Only settled searches, never the refresh a replace triggers.
		if (report) {
			emit("project_search_run", {
				files: inputs.length,
				hits: this.projectHits.length,
				regex: Boolean(o.regexp)
			});
		}
	}

	/** Re-run after an edit without resetting which match you were on. */
	async refreshProject(): Promise<void> {
		const at = this.projectActive;
		await this.runProjectSearch(this.projectOpts, false);
		this.projectActive = Math.min(at, Math.max(0, this.projectHits.length - 1));
	}

	toggleGroup(id: string): void {
		this.collapsedGroups = { ...this.collapsedGroups, [id]: !this.collapsedGroups[id] };
	}

	/** Open the file a hit lives in and reveal it, in whichever mode is on screen. */
	async gotoHit(index: number): Promise<void> {
		const hits = this.projectHits;
		if (!hits.length) return;
		const n = hits.length;
		this.projectActive = ((index % n) + n) % n;
		const hit = hits[this.projectActive];
		if (hit.fileId !== this.#files.activeId) await this.#files.openFile(hit.fileId);
		// The block editor has no CodeMirror to select in, so it takes a line and
		// scrolls the matching block instead.
		if (this.#layout.visualApi) {
			this.#layout.revealLine = hit.match.line;
			return;
		}
		this.#layout.revealSpan = { from: hit.match.from, to: hit.match.to };
		this.#layout.flushReveal();
	}
	projectNext(): void {
		void this.gotoHit(this.projectActive + 1);
	}
	projectPrev(): void {
		void this.gotoHit(this.projectActive - 1);
	}

	/** Replace the match you are on, wherever it lives. */
	async replaceHit(replace: string): Promise<void> {
		const hit = this.activeHit;
		if (!hit) return;
		const file = this.#files.files.find((f) => f.id === hit.fileId);
		if (!file) return;
		const text = this.#files.liveContent(file);
		const matched = text.slice(hit.match.from, hit.match.to);
		let insert = replacementFor(matched, replace, this.projectOpts);
		if (this.projectOpts.preserveCase) insert = applyCase(matched, insert);
		this.#files.setContent(
			hit.fileId,
			text.slice(0, hit.match.from) + insert + text.slice(hit.match.to)
		);
		await this.refreshProject();
	}

	/** Replace every match the panel is showing. Scoped to the visible groups on
	 *  purpose: rewriting a generated file you were never shown is not a fix. */
	async replaceAllProject(replace: string): Promise<number> {
		const groups = this.visibleGroups;
		if (!groups.length) return 0;
		let count = 0;
		for (const group of groups) {
			const file = this.#files.files.find((f) => f.id === group.id);
			if (!file) continue;
			const text = this.#files.liveContent(file);
			const next = this.projectOpts.preserveCase
				? group.matches.reduceRight((acc, m) => {
						const matched = text.slice(m.from, m.to);
						const insert = applyCase(matched, replacementFor(matched, replace, this.projectOpts));
						return acc.slice(0, m.from) + insert + acc.slice(m.to);
					}, text)
				: applyMatches(text, group.matches, replace, this.projectOpts);
			if (next === text) continue;
			this.#files.setContent(group.id, next);
			count += group.matches.length;
		}
		await this.refreshProject();
		emit("project_replace_all", { scope: "project", matches: count });
		return count;
	}

	openFind(): void {
		if (this.#layout.viewMode === "preview") this.#layout.viewMode = "split";
		this.showFind = true;
		// Seed from the current selection so "find this word" is one keystroke.
		const sel = this.#layout.editor?.selectedText?.() ?? "";
		if (sel && !sel.includes("\n")) {
			this.runSearch({ ...this.searchOpts, query: sel });
		} else if (this.searchOpts.query) {
			this.runSearch(this.searchOpts);
		}
		queueMicrotask(() => this.findBar?.focusInput());
	}
	closeFind(): void {
		this.showFind = false;
		this.#layout.editor?.clearSearch();
		this.#layout.editor?.focusEditor();
	}

	runSearch(o: SearchOptions): void {
		this.searchOpts = o;
		this.searchResults = o.query ? (this.#layout.editor?.findAll(o) ?? []) : [];
		this.searchActive = 0;
		if (!o.query) this.#layout.editor?.clearSearch();
	}
	gotoResult(i: number): void {
		if (!this.searchResults.length) return;
		const n = this.searchResults.length;
		this.searchActive = ((i % n) + n) % n;
		const m = this.searchResults[this.searchActive];
		// Reveal without taking the caret: otherwise the first Enter in the find
		// input jumps to the editor and the second one types a newline into the doc.
		this.#layout.editor?.selectRange(m.from, m.to, { focus: false });
	}
	searchNext(): void {
		this.gotoResult(this.searchActive + 1);
	}
	searchPrev(): void {
		this.gotoResult(this.searchActive - 1);
	}
	replaceCurrent(replace: string): void {
		const m = this.searchResults[this.searchActive];
		if (!m) return;
		const matched = this.#getSource().slice(m.from, m.to);
		let insert = replace;
		if (this.searchOpts.regexp) {
			try {
				let pat = this.searchOpts.query;
				if (this.searchOpts.wholeWord) pat = `\\b(?:${pat})\\b`;
				const single = new RegExp(pat, this.searchOpts.caseSensitive ? "" : "i");
				insert = matched.replace(single, replace);
			} catch {
				/* fall back to literal */
			}
		}
		if (this.searchOpts.preserveCase) insert = applyCase(matched, insert);
		this.#layout.editor?.replaceRange(m.from, m.to, insert, { focus: false });
		this.runSearch({ ...this.searchOpts, replace });
	}
	replaceAll(replace: string): void {
		const n = this.#layout.editor?.replaceAllMatches(this.searchOpts, replace) ?? 0;
		this.runSearch({ ...this.searchOpts, replace });
		emit("project_replace_all", { scope: "file", matches: n });
		toast.success(`Replaced ${n} ${n === 1 ? "match" : "matches"}`);
	}
}
