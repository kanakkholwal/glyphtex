/**
 * CodeEditorController — owns the CodeMirror 6 view + compartments and the
 * editor's imperative API (wrap/insert, undo/redo, go-to-line, find/replace).
 *
 * The `.svelte` component is a thin shell: it binds props/effects to these
 * methods and re-exports the API via `bind:this`. Reconfiguration runs through
 * Compartments so toggling theme / grammar / font never re-mounts the view or
 * loses cursor / scroll / history. Only `view` is reactive (`$state`) so the
 * component's reconfigure effects re-run once it mounts.
 */
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo as cmRedo,
  redoDepth,
  undo as cmUndo,
  undoDepth,
} from "@codemirror/commands";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
} from "@codemirror/language";
import { SearchQuery, search, setSearchQuery } from "@codemirror/search";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { jetbrainsTheme, latexLanguage, type LatexGrammar } from "@glyphx/ui/editor";

import { applyCase } from "../case-preserve";
import { buildRegex, expandReplacement } from "./search";
import type { SearchMatch, SearchOptions } from "./types";

export type EditorLanguage = "latex" | "markdown" | "plain";

export type EditorInit = {
  value: string;
  theme: "light" | "dark";
  grammar: LatexGrammar;
  language: EditorLanguage;
  fontSize: number;
  fontFamily: string;
  lineWrapping: boolean;
  readonly: boolean;
};

export type CodeEditorCallbacks = {
  setValue: (v: string) => void;
  setCanUndo: (b: boolean) => void;
  setCanRedo: (b: boolean) => void;
  oncursor?: (pos: { line: number; column: number }) => void;
};

// The active highlighting extension for the current language/grammar. Only
// LaTeX gets a real parser; markdown / plain (READMEs, code) stay unhighlighted
// so we don't pull in a grammar package per language.
function langExtension(lang: EditorLanguage, g: LatexGrammar) {
  return lang === "latex" ? latexLanguage(g) : [];
}

// Font size + family live in a compartment so Settings can change them live.
const fontExtension = (size: number, family: string) =>
  EditorView.theme({
    "&": { fontSize: `${size}px` },
    ".cm-scroller": { fontFamily: family },
    ".cm-gutters": { fontFamily: family },
  });

const baseTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { lineHeight: "1.6", overflow: "auto" },
  ".cm-content": { padding: "12px 0" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 8px" },
});

export class CodeEditorController {
  view = $state<EditorView>();

  readonly #themeC = new Compartment();
  readonly #langC = new Compartment();
  readonly #fontC = new Compartment();
  readonly #wrapC = new Compartment();
  readonly #roC = new Compartment();
  readonly #historyC = new Compartment();

  // Last document the undo history belongs to (non-reactive, view-local).
  #lastDocKey: string | null = null;
  readonly #cb: CodeEditorCallbacks;

  constructor(cb: CodeEditorCallbacks) {
    this.#cb = cb;
  }

  /** Mount the view into `parent` with the initial prop values; returns the
   *  teardown for the component's mount effect. */
  mount(parent: HTMLElement, init: EditorInit): () => void {
    const state = EditorState.create({
      doc: init.value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        this.#historyC.of(history()),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        indentUnit.of("  "),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        search(), // enables match highlighting via setSearchQuery (our own panel)
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        baseTheme,
        this.#langC.of(langExtension(init.language, init.grammar)),
        this.#themeC.of(jetbrainsTheme(init.theme)),
        this.#fontC.of(fontExtension(init.fontSize, init.fontFamily)),
        this.#wrapC.of(init.lineWrapping ? EditorView.lineWrapping : []),
        this.#roC.of(EditorState.readOnly.of(init.readonly)),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) this.#cb.setValue(u.state.doc.toString());
          if ((u.docChanged || u.selectionSet) && this.#cb.oncursor) {
            const head = u.state.selection.main.head;
            const line = u.state.doc.lineAt(head);
            this.#cb.oncursor({ line: line.number, column: head - line.from + 1 });
          }
          // Keep the host's undo/redo affordances in sync with the history stack.
          this.#cb.setCanUndo(undoDepth(u.state) > 0);
          this.#cb.setCanRedo(redoDepth(u.state) > 0);
        }),
      ],
    });

    const v = new EditorView({ state, parent });
    this.view = v;
    return () => {
      v.destroy();
      if (this.view === v) this.view = undefined;
    };
  }

  // --- Live reconfiguration (each driven by one component effect) -----------
  reconfigureTheme(theme: "light" | "dark"): void {
    this.view?.dispatch({
      effects: this.#themeC.reconfigure(jetbrainsTheme(theme)),
    });
  }
  reconfigureLang(language: EditorLanguage, grammar: LatexGrammar): void {
    this.view?.dispatch({
      effects: this.#langC.reconfigure(langExtension(language, grammar)),
    });
  }
  reconfigureFont(size: number, family: string): void {
    this.view?.dispatch({
      effects: this.#fontC.reconfigure(fontExtension(size, family)),
    });
  }
  reconfigureWrap(wrap: boolean): void {
    this.view?.dispatch({
      effects: this.#wrapC.reconfigure(wrap ? EditorView.lineWrapping : []),
    });
  }
  reconfigureReadonly(ro: boolean): void {
    this.view?.dispatch({
      effects: this.#roC.reconfigure(EditorState.readOnly.of(ro)),
    });
  }

  /** Switching documents resets the undo history so undo/redo can never reach
   *  into another file's edits (a single view is reused across files). */
  resetHistoryIfDocChanged(key: string): void {
    const v = this.view;
    if (!v || key === this.#lastDocKey) return;
    this.#lastDocKey = key;
    v.dispatch({ effects: this.#historyC.reconfigure([]) });
    v.dispatch({ effects: this.#historyC.reconfigure(history()) });
  }

  /** External value → editor (e.g. open a different file). Guarded so typing
   *  doesn't loop. External replacements are never undoable. */
  syncExternalValue(next: string): void {
    const v = this.view;
    if (!v) return;
    if (next !== v.state.doc.toString()) {
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: next },
        annotations: Transaction.addToHistory.of(false),
      });
    }
  }

  // --- Imperative API -------------------------------------------------------
  wrapSelection(before: string, after: string = before): void {
    const v = this.view;
    if (!v) return;
    const range = v.state.selection.main;
    const selected = v.state.sliceDoc(range.from, range.to);
    v.dispatch({
      changes: {
        from: range.from,
        to: range.to,
        insert: `${before}${selected}${after}`,
      },
      selection: {
        anchor: range.from + before.length,
        head: range.from + before.length + selected.length,
      },
      scrollIntoView: true,
    });
    v.focus();
  }

  insertText(text: string): void {
    const v = this.view;
    if (!v) return;
    const range = v.state.selection.main;
    v.dispatch({
      changes: { from: range.from, to: range.to, insert: text },
      selection: { anchor: range.from + text.length },
      scrollIntoView: true,
    });
    v.focus();
  }

  focusEditor(): void {
    this.view?.focus();
  }

  selectedText(): string {
    const v = this.view;
    if (!v) return "";
    const r = v.state.selection.main;
    return v.state.sliceDoc(r.from, r.to);
  }

  undo(): void {
    const v = this.view;
    if (v) {
      cmUndo(v);
      v.focus();
    }
  }
  redo(): void {
    const v = this.view;
    if (v) {
      cmRedo(v);
      v.focus();
    }
  }

  goToLine(line: number): void {
    const v = this.view;
    if (!v) return;
    const n = Math.max(1, Math.min(line, v.state.doc.lines));
    const l = v.state.doc.line(n);
    v.dispatch({
      selection: { anchor: l.from },
      effects: EditorView.scrollIntoView(l.from, { y: "center" }),
    });
    v.focus();
  }

  /** Highlight matches in the editor and return them all for the results list. */
  findAll(o: SearchOptions): SearchMatch[] {
    const v = this.view;
    if (!v) return [];
    // Drive CodeMirror's own match highlighting.
    v.dispatch({
      effects: setSearchQuery.of(
        new SearchQuery({
          search: o.query ?? "",
          replace: o.replace ?? "",
          caseSensitive: !!o.caseSensitive,
          regexp: !!o.regexp,
          wholeWord: !!o.wholeWord,
        }),
      ),
    });
    const re = buildRegex(o);
    if (!re) return [];
    const text = v.state.doc.toString();
    const out: SearchMatch[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) && out.length < 5000) {
      if (m[0] === "") {
        re.lastIndex++; // guard against zero-width matches
        continue;
      }
      const from = m.index;
      const line = v.state.doc.lineAt(from);
      out.push({
        from,
        to: from + m[0].length,
        line: line.number,
        column: from - line.from + 1,
        text: line.text,
      });
    }
    return out;
  }

  selectRange(from: number, to: number): void {
    const v = this.view;
    if (!v) return;
    const len = v.state.doc.length;
    const a = Math.min(from, len);
    const b = Math.min(to, len);
    v.dispatch({
      selection: { anchor: a, head: b },
      effects: EditorView.scrollIntoView(a, { y: "center" }),
    });
    v.focus();
  }

  replaceRange(from: number, to: number, insert: string): void {
    const v = this.view;
    if (!v) return;
    v.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
    });
  }

  /** Replace every match in one undoable change. Returns the count replaced. */
  replaceAllMatches(o: SearchOptions, replacement: string): number {
    const v = this.view;
    if (!v) return 0;
    const re = buildRegex(o);
    if (!re) return 0;
    const text = v.state.doc.toString();
    const matches = text.match(re);
    const count = matches ? matches.length : 0;
    if (!count) return 0;

    let next: string;
    if (o.preserveCase) {
      // A function replacer so each hit can be recased to match its own text.
      next = text.replace(re, (m: string, ...args: unknown[]) => {
        const groups = args.slice(0, -2) as (string | undefined)[];
        const expanded = o.regexp
          ? expandReplacement(replacement, m, groups)
          : replacement;
        return applyCase(m, expanded);
      });
    } else {
      // In regex mode keep $1/$& expansion; otherwise insert the literal text.
      const repl = o.regexp ? replacement : replacement.replace(/\$/g, "$$$$");
      next = text.replace(re, repl);
    }

    v.dispatch({
      changes: { from: 0, to: v.state.doc.length, insert: next },
      selection: { anchor: 0 },
    });
    return count;
  }

  /** Clear the highlight (closing the search panel). */
  clearSearch(): void {
    this.view?.dispatch({
      effects: setSearchQuery.of(new SearchQuery({ search: "" })),
    });
  }
}
