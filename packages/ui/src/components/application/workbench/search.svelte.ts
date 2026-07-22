import { applyCase } from "../case-preserve";
import { toast } from "@glyphtex/ui/sonner";

import type { LayoutStore } from "./layout.svelte";
import type { SearchMatch, SearchOptions } from "./types";

export type SearchDeps = {
  layout: LayoutStore;
  getSource: () => string;
};

/** Find/replace for the active document, shared by the Search view and the find bar.
 *  Scanning itself is delegated to the editor handle on {@link LayoutStore}. */
export class SearchStore {
  readonly #layout: LayoutStore;
  readonly #getSource: () => string;

  searchOpts = $state<SearchOptions>({
    query: "",
    replace: "",
    caseSensitive: false,
    wholeWord: false,
    regexp: false,
  });
  searchResults = $state<SearchMatch[]>([]);
  searchActive = $state(0);

  // The docked bottom find/replace bar (Ctrl/Cmd+F over the editor pane).
  showFind = $state(false);
  findBar = $state<{ focusInput: () => void }>();

  constructor(deps: SearchDeps) {
    this.#layout = deps.layout;
    this.#getSource = deps.getSource;
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
    this.searchResults = o.query
      ? (this.#layout.editor?.findAll(o) ?? [])
      : [];
    this.searchActive = 0;
    if (!o.query) this.#layout.editor?.clearSearch();
  }
  gotoResult(i: number): void {
    if (!this.searchResults.length) return;
    const n = this.searchResults.length;
    this.searchActive = ((i % n) + n) % n;
    const m = this.searchResults[this.searchActive];
    this.#layout.editor?.selectRange(m.from, m.to);
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
        const single = new RegExp(
          pat,
          this.searchOpts.caseSensitive ? "" : "i",
        );
        insert = matched.replace(single, replace);
      } catch {
        /* fall back to literal */
      }
    }
    if (this.searchOpts.preserveCase) insert = applyCase(matched, insert);
    this.#layout.editor?.replaceRange(m.from, m.to, insert);
    this.runSearch({ ...this.searchOpts, replace });
  }
  replaceAll(replace: string): void {
    const n = this.#layout.editor?.replaceAllMatches(this.searchOpts, replace) ?? 0;
    this.runSearch({ ...this.searchOpts, replace });
    toast.success(`Replaced ${n} ${n === 1 ? "match" : "matches"}`);
  }
}
