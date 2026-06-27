<script lang="ts" module>
  // Public find/replace types kept importable from this component.
  export type { SearchOptions, SearchMatch } from "./code-editor/types";
</script>

<script lang="ts">
  import { untrack } from "svelte";

  import type { LatexGrammar } from "@glyphx/ui/editor";

  import {
    CodeEditorController,
    type EditorLanguage,
  } from "./code-editor/controller.svelte";

  /**
   * CodeEditor — the shared CodeMirror 6 surface (web + desktop).
   *
   * Dumb on purpose: theme / grammar / font come in as props. This component is
   * a thin shell — all editor state + behaviour live in
   * {@link CodeEditorController}; here we only bind props/effects to it and
   * re-export its imperative API via `bind:this`.
   */
  let {
    value = $bindable(""),
    docKey = "",
    canUndo = $bindable(false),
    canRedo = $bindable(false),
    theme = "light" as "light" | "dark",
    grammar = "legacy" as LatexGrammar,
    language = "latex" as EditorLanguage,
    fontSize = 13,
    fontFamily = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace",
    lineWrapping = false,
    readonly = false,
    class: className = "",
    oncursor,
  }: {
    value?: string;
    /** Identity of the open document. Changing it resets the undo history so
     *  undo/redo can never reach into another file's edits. */
    docKey?: string;
    /** Bindable: whether there is anything to undo / redo (drives toolbar state). */
    canUndo?: boolean;
    canRedo?: boolean;
    theme?: "light" | "dark";
    grammar?: LatexGrammar;
    /** Highlighting mode. `latex` uses the LaTeX parser; `markdown`/`plain`
     *  drive non-TeX files (READMEs, code) so they aren't mis-highlighted. */
    language?: EditorLanguage;
    fontSize?: number;
    fontFamily?: string;
    lineWrapping?: boolean;
    readonly?: boolean;
    class?: string;
    /** Fires with the 1-based caret position whenever the selection moves. */
    oncursor?: (pos: { line: number; column: number }) => void;
  } = $props();

  let host = $state<HTMLDivElement>();

  // `oncursor` is captured once (it's stable); the rest are setter closures.
  // svelte-ignore state_referenced_locally
  const ctrl = new CodeEditorController({
    setValue: (v) => (value = v),
    setCanUndo: (b) => (canUndo = b),
    setCanRedo: (b) => (canRedo = b),
    oncursor,
  });

  // Mount once. Initial prop values are read untracked so this effect does not
  // re-run (and re-create the view) when they change — the effects below handle
  // live reconfiguration.
  $effect(() => {
    const parent = host;
    if (!parent) return;
    const init = untrack(() => ({
      value,
      theme,
      grammar,
      language,
      fontSize,
      fontFamily,
      lineWrapping,
      readonly,
    }));
    return ctrl.mount(parent, init);
  });

  // Live reconfiguration — each tracks `view` + exactly one prop set.
  $effect(() => {
    void ctrl.view;
    ctrl.reconfigureTheme(theme);
  });
  $effect(() => {
    void ctrl.view;
    ctrl.reconfigureLang(language, grammar);
  });
  $effect(() => {
    void ctrl.view;
    ctrl.reconfigureFont(fontSize, fontFamily);
  });
  $effect(() => {
    void ctrl.view;
    ctrl.reconfigureWrap(lineWrapping);
  });
  $effect(() => {
    void ctrl.view;
    ctrl.reconfigureReadonly(readonly);
  });
  $effect(() => {
    void ctrl.view;
    ctrl.resetHistoryIfDocChanged(docKey);
  });
  $effect(() => {
    void ctrl.view;
    ctrl.syncExternalValue(value);
  });

  // --- Imperative API (accessed via bind:this from a toolbar, etc.) ---------
  export function wrapSelection(before: string, after?: string) {
    ctrl.wrapSelection(before, after);
  }
  export function insertText(text: string) {
    ctrl.insertText(text);
  }
  export function focusEditor() {
    ctrl.focusEditor();
  }
  export function selectedText(): string {
    return ctrl.selectedText();
  }
  export function undo() {
    ctrl.undo();
  }
  export function redo() {
    ctrl.redo();
  }
  export function goToLine(line: number) {
    ctrl.goToLine(line);
  }
  export function findAll(o: import("./code-editor/types").SearchOptions) {
    return ctrl.findAll(o);
  }
  export function selectRange(from: number, to: number) {
    ctrl.selectRange(from, to);
  }
  export function replaceRange(from: number, to: number, insert: string) {
    ctrl.replaceRange(from, to, insert);
  }
  export function replaceAllMatches(
    o: import("./code-editor/types").SearchOptions,
    replacement: string,
  ): number {
    return ctrl.replaceAllMatches(o, replacement);
  }
  export function clearSearch() {
    ctrl.clearSearch();
  }
</script>

<div bind:this={host} class="h-full min-h-0 {className}"></div>
