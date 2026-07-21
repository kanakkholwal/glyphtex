/**
 * Monaco loader.
 *
 * Monaco touches `window` and `document` the moment it is imported, so it can
 * never be a top-level import in a package that SvelteKit renders on the
 * server. Everything here is behind a dynamic `import()` that only ever runs in
 * the browser, and callers receive the namespace as a value rather than
 * importing it themselves.
 *
 * One editor worker is registered — Monaco's own, which provides word-based
 * completion, link detection and diff computation. The language workers
 * (TypeScript, JSON, CSS, HTML) are deliberately NOT wired up: LaTeX is a
 * Monarch grammar, which tokenizes on the main thread, so pulling those in
 * would add megabytes to the bundle for services nothing here uses.
 */
import type * as Monaco from "monaco-editor";

import { registerLatex } from "./latex-monarch";
import { registerJetBrainsThemes } from "./jetbrains-monaco";

export type MonacoNamespace = typeof Monaco;

/** Shape Monaco looks for on `self` to find its workers. */
interface MonacoEnvironmentHost {
  MonacoEnvironment?: {
    getWorker(moduleId: string, label: string): Worker;
  };
}

// One in-flight load shared by every editor instance on the page: mounting two
// editors must not download or initialise Monaco twice.
let loading: Promise<MonacoNamespace> | null = null;

export function loadMonaco(): Promise<MonacoNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Monaco can only load in the browser."));
  }

  loading ??= (async () => {
    // `?worker` is Vite's worker-bundling suffix. Both apps that consume this
    // package build with Vite, and the import sits inside this browser-only
    // path so it never reaches the SSR module graph.
    const [monaco, { default: EditorWorker }] = await Promise.all([
      import("monaco-editor"),
      import("monaco-editor/esm/vs/editor/editor.worker?worker"),
    ]);

    (self as unknown as MonacoEnvironmentHost).MonacoEnvironment = {
      getWorker: () => new EditorWorker(),
    };

    registerLatex(monaco);
    registerJetBrainsThemes(monaco);

    return monaco;
  })().catch((error) => {
    // Let the next mount retry rather than caching a rejected promise forever.
    loading = null;
    throw error;
  });

  return loading;
}
