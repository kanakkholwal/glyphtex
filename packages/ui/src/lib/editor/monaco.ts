import { registerLatex } from "./latex-monarch";
import { registerLatexCompletions } from "./latex-complete";
import { registerLatexStructure } from "./latex-structure";
import { registerLatexSemanticTokens } from "./latex-semantic";
import { registerJetBrainsThemes } from "./jetbrains-monaco";

/** The bare editor API, not the package root — `css`/`html`/`json`/`ts` are absent. */
export type MonacoNamespace = typeof import("monaco-editor/editor/editor.api");

interface MonacoEnvironmentHost {
  MonacoEnvironment?: {
    getWorker(moduleId: string, label: string): Worker;
  };
}

// Shared by every editor on the page: two mounts must not load Monaco twice.
let loading: Promise<MonacoNamespace> | null = null;

export function loadMonaco(): Promise<MonacoNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Monaco can only load in the browser."));
  }

  loading ??= (async () => {
    // Not `import("monaco-editor")` — the root pulls in all 81 languages.
    // `./monaco-contributions` is required: the API entry ships no features.
    const [monaco, { default: EditorWorker }] = await Promise.all([
      import("monaco-editor/editor/editor.api"),
      import("monaco-editor/editor/editor.worker?worker"),
      import("./monaco-contributions"),
      import("monaco-editor/languages/definitions/markdown/register"),
    ]);

    (self as unknown as MonacoEnvironmentHost).MonacoEnvironment = {
      getWorker: () => new EditorWorker(),
    };

    registerLatex(monaco);
    // Runs once per page, so the returned disposables are dropped on purpose.
    registerLatexCompletions(monaco);
    registerLatexStructure(monaco);
    registerLatexSemanticTokens(monaco);
    registerJetBrainsThemes(monaco);

    return monaco;
  })().catch((error) => {
    // Let the next mount retry rather than caching a rejected promise forever.
    loading = null;
    throw error;
  });

  return loading;
}
