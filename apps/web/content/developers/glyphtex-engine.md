---
title: "glyphtex-engine: compile LaTeX in JavaScript"
description: "Compile LaTeX to PDF in the browser or Node with glyphtex-engine, Tectonic's XeTeX compiled to WebAssembly. Install, quick start, Web Worker setup and package sets."
category: "glyphtex-engine (npm)"
order: 1
updated: "2026-11-03"
faq:
  - q: "How do I compile LaTeX to PDF in JavaScript?"
    a: "Install glyphtex-engine, load the WebAssembly engine with TexEngine.load, add the TeX bundle and your .tex files with addFiles, then call compile() and read engine.pdf(). It runs in the browser and in Node with no TeX installation."
  - q: "Does glyphtex-engine need a server?"
    a: "No. The engine is Tectonic's XeTeX compiled to WebAssembly and runs entirely in the browser tab or in Node. Your documents never leave the machine."
  - q: "Which LaTeX packages does glyphtex-engine support?"
    a: "The bundle covers common packages such as amsmath, graphicx, hyperref, tikz, pgfplots, geometry, booktabs, listings, siunitx and beamer, and package sets add more. The full list is on the GlyphTeX packages page."
---

:::takeaways
- `glyphtex-engine` is a real TeX engine (XeTeX, xdvipdfmx and BibTeX) compiled to WebAssembly.
- It compiles LaTeX to PDF in the browser or in Node, with no server and no TeX install.
- The engine, the LaTeX format and the packages ship inside the npm package.
- Results are typed: a status, structured diagnostics with file and line, and the files TeX could not find.
:::

## Install

```console
npm install glyphtex-engine
```

It needs Node 20.6 or later, or any current browser. The package carries everything:

| Import | What it is |
| --- | --- |
| `glyphtex-engine` | The bindings: `TexEngine`, pack and archive helpers, types |
| `glyphtex-engine/wasm` | The engine (~3.5 MB) |
| `glyphtex-engine/bundle` | The TeX bundle, a `.tar.gz` (~15 MB): format, classes, core packages, fonts |
| `glyphtex-engine/packs/index.json` | Index of the package sets |
| `glyphtex-engine/packs/pack-<id>.tar.gz` | One package set |

## Quick start in Node

```js
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defaultPacks, parsePackIndex, TexEngine, unpackTarGz } from "glyphtex-engine";

const asset = (specifier) => readFile(fileURLToPath(import.meta.resolve(specifier)));

const engine = await TexEngine.load(await asset("glyphtex-engine/wasm"));
engine.addFiles(await unpackTarGz(await asset("glyphtex-engine/bundle")));

const index = parsePackIndex(JSON.parse(await asset("glyphtex-engine/packs/index.json")));
for (const pack of defaultPacks(index)) {
  engine.addFiles(await unpackTarGz(await asset(`glyphtex-engine/packs/pack-${pack.id}.tar.gz`)));
}

engine.addFile("main.tex", String.raw`\documentclass{article}
\begin{document}
Hello, $e^{i\pi} + 1 = 0$.
\end{document}`);

const result = engine.compile({ entry: "main.tex" });
if (result.status !== "failed") await writeFile("hello.pdf", engine.pdf());
```

Load the bundle and the default package sets once, then compile as many documents as you like on the same engine.

## In the browser

Run the engine in a Web Worker. A compile is synchronous and takes from tens of milliseconds to a few seconds, which would freeze the page on the main thread.

```js
// tex.worker.js
import { TexEngine, unpackTarGz } from "glyphtex-engine";
import wasmUrl from "glyphtex-engine/wasm?url";
import bundleUrl from "glyphtex-engine/bundle?url";

const ready = (async () => {
  const engine = await TexEngine.load(fetch(wasmUrl)); // compiles while downloading
  const bundle = new Uint8Array(await (await fetch(bundleUrl)).arrayBuffer());
  engine.addFiles(await unpackTarGz(bundle));
  return engine;
})();

self.onmessage = async ({ data: { files, entry } }) => {
  const engine = await ready;
  engine.addFiles(files);
  const result = engine.compile({ entry });
  const pdf = result.status === "failed" ? null : engine.pdf();
  self.postMessage({ result, pdf }, pdf ? [pdf.buffer] : []);
};
```

The `?url` imports are Vite's; other bundlers have an equivalent. Serve the wasm and the bundle from your own origin and cache them: together they are about 20 MB. No `SharedArrayBuffer` is used, so no COOP or COEP headers are needed.

[A complete Vite example with a PDF preview](./glyphtex-engine/examples#a-vite-app-with-a-live-preview) is on the examples page.

## Status is not a boolean

`compile()` returns for every run that finished. Only one status means there is no PDF:

| `status` | Meaning |
| --- | --- |
| `spotless` | No warnings or errors. |
| `warnings` | Warnings only, the common case. |
| `errors` | TeX reported errors but recovered. A PDF usually still exists. |
| `failed` | Nothing was produced. `message` says why. |

So test `status !== "failed"` before reading the PDF. Treating `errors` as fatal would reject documents TeX itself typeset.

## Package sets

The bundle covers the common packages. Package sets add more, each a small archive: page layout, figures, `tcolorbox`, `biblatex` and the BibTeX styles, beamer themes, the `exam` class and others. `defaultPacks(index)` lists the ones to load up front; optional sets, like Font Awesome, are better loaded when a document asks for them with `resolveMissing`. See [every supported package](../packages).

:::callout{type=warn title="BibTeX styles are in a package set"}
`plain.bst` and the other `.bst` files ship in the `references` set. Without it BibTeX cannot open the style, citations stay `[?]`, and the only trace is in the `.blg` file, not in `missingFiles`.
:::

## Limits

- `minted` needs Python; use `listings`.
- `biber` is a Perl program; use `biblatex` with `backend=bibtex`.
- Shell escape and TikZ externalisation need to start processes.
- System fonts are not visible. Add font files to the project and load them with `fontspec` by file name.
- `xeCJK` and colour emoji are not supported yet.

## Next

- [Examples](./glyphtex-engine/examples): a Vite app, multi-file projects, on-demand package sets, deterministic builds and error display.
- [API reference](./glyphtex-engine/api): every method, option and type.
- [glyphtex-tex-api](./glyphtex-tex-api), the Rust crate with the same types and a TeX log parser.
