import type * as Monaco from "monaco-editor";

import { loadMonaco, type MonacoNamespace } from "@glyphtex/ui/editor";

import { applyCase } from "../case-preserve";
import { buildRegex, expandReplacement } from "./search";
import type { SearchMatch, SearchOptions } from "./types";

export type EditorLanguage = "latex" | "markdown" | "plain";

export type EditorInit = {
  value: string;
  theme: "light" | "dark";
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

function languageId(lang: EditorLanguage): string {
  if (lang === "latex") return "latex";
  if (lang === "markdown") return "markdown";
  return "plaintext";
}

/** Theme name registered by `registerJetBrainsThemes`. */
function themeName(theme: "light" | "dark"): string {
  return theme === "dark" ? "glyphtex-island-dark" : "glyphtex-island-light";
}

export class CodeEditorController {
  editor = $state<Monaco.editor.IStandaloneCodeEditor>();

  #monaco: MonacoNamespace | null = null;
  #disposables: Monaco.IDisposable[] = [];
  #decorations: Monaco.editor.IEditorDecorationsCollection | null = null;

  // Last document the undo history belongs to (non-reactive, view-local).
  #lastDocKey: string | null = null;
  readonly #cb: CodeEditorCallbacks;

  constructor(cb: CodeEditorCallbacks) {
    this.#cb = cb;
  }

  /** Mount into `parent`; returns the teardown for the component's mount effect.
   *  Monaco loads async but the teardown must be sync, hence the `disposed` flag. */
  mount(parent: HTMLElement, init: EditorInit): () => void {
    let disposed = false;

    void loadMonaco()
      .then((monaco) => {
        if (disposed) return;
        this.#attach(monaco, parent, init);
      })
      .catch((error) => {
        // Nothing to fall back to, so surface it rather than leaving a blank
        // pane with no explanation.
        console.error("[GlyphTeX] the code editor failed to load:", error);
      });

    return () => {
      disposed = true;
      this.#teardown();
    };
  }

  #attach(monaco: MonacoNamespace, parent: HTMLElement, init: EditorInit): void {
    this.#monaco = monaco;

    const editor = monaco.editor.create(parent, {
      value: init.value,
      language: languageId(init.language),
      theme: themeName(init.theme),
      fontSize: init.fontSize,
      fontFamily: init.fontFamily,
      wordWrap: init.lineWrapping ? "on" : "off",
      readOnly: init.readonly,
      // Track the container instead of requiring the host to call layout() on
      // every splitter drag; the panes here are resizable.
      automaticLayout: true,
      lineHeight: 1.6,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: "all",
      smoothScrolling: true,
      // Folding follows our section/environment provider rather than
      // indentation, which is meaningless in LaTeX.
      folding: true,
      foldingStrategy: "auto",
      showFoldingControls: "mouseover",
      // Keeps the enclosing \section heading pinned while you scroll inside it.
      stickyScroll: { enabled: true, maxLineCount: 3 },
      cursorBlinking: "smooth",
      padding: { top: 12, bottom: 12 },
      tabSize: 2,
      insertSpaces: true,
      bracketPairColorization: { enabled: false },
      // Drives latex-semantic.ts: unknown commands, user macros, dangling refs.
      "semanticHighlighting.enabled": true,

      // --- Suggestions ---
      // Prose types mostly words, so quick suggestions stay off; the provider's
      // trigger characters (`\`, `{`, `,`) open the widget instead.
      quickSuggestions: { other: false, comments: false, strings: false },
      suggestOnTriggerCharacters: true,
      // Ctrl/Cmd+Space still works everywhere for an explicit request.
      wordBasedSuggestions: "currentDocument",
      tabCompletion: "on",
      snippetSuggestions: "inline",
      // Enter inserts a newline; Tab accepts. Prose has far more Enter presses
      // than accepted completions, and the reverse mapping eats paragraphs.
      acceptSuggestionOnEnter: "off",
      suggest: {
        showWords: true,
        showSnippets: true,
        insertMode: "replace",
        localityBonus: true,
      },

      // Monaco's own find widget is redundant: the app has its own find/replace
      // panel driving findAll()/replaceAllMatches().
      find: { addExtraSpaceOnTop: false, seedSearchStringFromSelection: "never" },
      scrollbar: { useShadows: false, verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      overviewRulerBorder: false,
      fixedOverflowWidgets: true,
    });

    this.#decorations = editor.createDecorationsCollection();

    this.#disposables.push(
      editor.onDidChangeModelContent(() => {
        const model = editor.getModel();
        if (!model) return;
        this.#cb.setValue(model.getValue());
        // Monaco tracks undo/redo availability on the model itself, so this
        // stays correct through grouped edits that a manual counter would miss.
        this.#cb.setCanUndo(model.canUndo());
        this.#cb.setCanRedo(model.canRedo());
      }),
    );

    if (this.#cb.oncursor) {
      const oncursor = this.#cb.oncursor;
      this.#disposables.push(
        editor.onDidChangeCursorPosition((e) => {
          oncursor({ line: e.position.lineNumber, column: e.position.column });
        }),
      );
    }

    this.editor = editor;
  }

  #teardown(): void {
    for (const d of this.#disposables) d.dispose();
    this.#disposables = [];
    this.#decorations = null;

    const editor = this.editor;
    if (editor) {
      // Dispose the model explicitly: Monaco models are owned by a global
      // registry, not by the editor, so they outlive it and leak otherwise.
      editor.getModel()?.dispose();
      editor.dispose();
    }
    this.editor = undefined;
    this.#monaco = null;
  }

  get #model(): Monaco.editor.ITextModel | null {
    return this.editor?.getModel() ?? null;
  }

  // --- Live reconfiguration ---

  /** Note Monaco themes are global, not per-editor: this restyles every editor
   *  on the page, which is what we want — they share one app theme. */
  reconfigureTheme(theme: "light" | "dark"): void {
    this.#monaco?.editor.setTheme(themeName(theme));
  }

  reconfigureLang(language: EditorLanguage): void {
    const model = this.#model;
    if (model && this.#monaco) {
      this.#monaco.editor.setModelLanguage(model, languageId(language));
    }
  }

  reconfigureFont(size: number, family: string): void {
    this.editor?.updateOptions({ fontSize: size, fontFamily: family });
  }

  reconfigureWrap(wrap: boolean): void {
    this.editor?.updateOptions({ wordWrap: wrap ? "on" : "off" });
  }

  reconfigureReadonly(ro: boolean): void {
    this.editor?.updateOptions({ readOnly: ro });
  }

  /** Reset undo history on document switch, so undo can't reach another file's edits.
   *  Swaps the model because Monaco's undo stack lives there and has no public reset. */
  resetHistoryIfDocChanged(key: string): void {
    const editor = this.editor;
    const monaco = this.#monaco;
    if (!editor || !monaco || key === this.#lastDocKey) return;

    const previous = editor.getModel();
    // First mount adopts the model Monaco already created rather than
    // replacing it, so the initial value and language survive untouched.
    if (this.#lastDocKey === null) {
      this.#lastDocKey = key;
      return;
    }
    this.#lastDocKey = key;

    const replacement = monaco.editor.createModel(
      previous?.getValue() ?? "",
      previous?.getLanguageId() ?? "latex",
    );
    editor.setModel(replacement);
    previous?.dispose();
  }

  /** External value → editor, guarded so typing doesn't loop. `applyEdits` bypasses
   *  the undo stack; `setValue`/`pushEditOperations` would clear or pollute it. */
  syncExternalValue(next: string): void {
    const model = this.#model;
    if (!model || next === model.getValue()) return;
    model.applyEdits([{ range: model.getFullModelRange(), text: next }]);
  }

  // --- Imperative API ---

  wrapSelection(before: string, after: string = before): void {
    const editor = this.editor;
    const model = this.#model;
    if (!editor || !model) return;

    const selection = editor.getSelection();
    if (!selection) return;
    const selected = model.getValueInRange(selection);
    const start = model.getOffsetAt(selection.getStartPosition());

    editor.executeEdits("glyphtex", [
      { range: selection, text: `${before}${selected}${after}`, forceMoveMarkers: true },
    ]);
    // Reselect just the original text, now sitting after the opening delimiter.
    this.selectRange(start + before.length, start + before.length + selected.length);
    editor.focus();
  }

  insertText(text: string): void {
    const editor = this.editor;
    const model = this.#model;
    if (!editor || !model) return;

    const selection = editor.getSelection();
    if (!selection) return;
    const start = model.getOffsetAt(selection.getStartPosition());

    editor.executeEdits("glyphtex", [{ range: selection, text, forceMoveMarkers: true }]);
    this.selectRange(start + text.length, start + text.length);
    editor.focus();
  }

  focusEditor(): void {
    this.editor?.focus();
  }

  selectedText(): string {
    const editor = this.editor;
    const model = this.#model;
    const selection = editor?.getSelection();
    if (!model || !selection) return "";
    return model.getValueInRange(selection);
  }

  undo(): void {
    const editor = this.editor;
    if (!editor) return;
    editor.trigger("glyphtex", "undo", null);
    editor.focus();
  }

  redo(): void {
    const editor = this.editor;
    if (!editor) return;
    editor.trigger("glyphtex", "redo", null);
    editor.focus();
  }

  goToLine(line: number): void {
    const editor = this.editor;
    const model = this.#model;
    if (!editor || !model) return;

    const n = Math.max(1, Math.min(line, model.getLineCount()));
    editor.setPosition({ lineNumber: n, column: 1 });
    editor.revealLineInCenter(n);
    editor.focus();
  }

  /** Highlight matches in the editor and return them all for the results list. */
  findAll(o: SearchOptions): SearchMatch[] {
    const model = this.#model;
    if (!model) return [];

    const re = buildRegex(o);
    if (!re) {
      this.clearSearch();
      return [];
    }

    const text = model.getValue();
    const out: SearchMatch[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) && out.length < 5000) {
      if (m[0] === "") {
        re.lastIndex++; // guard against zero-width matches
        continue;
      }
      const from = m.index;
      const position = model.getPositionAt(from);
      out.push({
        from,
        to: from + m[0].length,
        line: position.lineNumber,
        column: position.column,
        text: model.getLineContent(position.lineNumber),
      });
    }

    // Monaco has no search-query concept of its own to drive, so matches are
    // highlighted with a decorations collection instead.
    this.#decorations?.set(
      out.map((match) => ({
        range: this.#rangeOf(model, match.from, match.to),
        options: { className: "glyphtex-search-match" },
      })),
    );

    return out;
  }

  selectRange(from: number, to: number): void {
    const editor = this.editor;
    const model = this.#model;
    if (!editor || !model) return;

    const range = this.#rangeOf(model, from, to);
    editor.setSelection(range);
    editor.revealRangeInCenterIfOutsideViewport(range);
    editor.focus();
  }

  replaceRange(from: number, to: number, insert: string): void {
    const editor = this.editor;
    const model = this.#model;
    if (!editor || !model) return;

    editor.executeEdits("glyphtex", [
      { range: this.#rangeOf(model, from, to), text: insert, forceMoveMarkers: true },
    ]);
    this.selectRange(from + insert.length, from + insert.length);
  }

  /** Replace every match in one undoable change. Returns the count replaced. */
  replaceAllMatches(o: SearchOptions, replacement: string): number {
    const editor = this.editor;
    const model = this.#model;
    if (!editor || !model) return 0;

    const re = buildRegex(o);
    if (!re) return 0;

    const text = model.getValue();
    const matches = text.match(re);
    const count = matches ? matches.length : 0;
    if (!count) return 0;

    let next: string;
    if (o.preserveCase) {
      // A function replacer so each hit can be recased to match its own text.
      next = text.replace(re, (m: string, ...args: unknown[]) => {
        const groups = args.slice(0, -2) as (string | undefined)[];
        const expanded = o.regexp ? expandReplacement(replacement, m, groups) : replacement;
        return applyCase(m, expanded);
      });
    } else {
      // In regex mode keep $1/$& expansion; otherwise insert the literal text.
      const repl = o.regexp ? replacement : replacement.replace(/\$/g, "$$$$");
      next = text.replace(re, repl);
    }

    // One edit over the whole document, so the whole replace-all undoes as a
    // single step rather than match by match.
    editor.executeEdits("glyphtex", [{ range: model.getFullModelRange(), text: next }]);
    return count;
  }

  /** Clear the highlight (closing the search panel). */
  clearSearch(): void {
    this.#decorations?.clear();
  }

  // Offset pair → Monaco range via the model's own conversion; hand-computing
  // line/column from offsets goes wrong on CRLF documents.
  #rangeOf(model: Monaco.editor.ITextModel, from: number, to: number): Monaco.IRange {
    const max = model.getValueLength();
    const start = model.getPositionAt(Math.max(0, Math.min(from, max)));
    const end = model.getPositionAt(Math.max(0, Math.min(to, max)));
    return {
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: end.lineNumber,
      endColumn: end.column,
    };
  }
}
