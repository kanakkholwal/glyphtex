---
title: "glyphtex-engine examples: LaTeX to PDF in Node and the browser"
description: "Working glyphtex-engine examples: a LaTeX compiler CLI in Node, a Vite app with a live PDF preview, multi-file projects, on-demand package sets, deterministic PDFs and error display."
category: "glyphtex-engine (npm)"
order: 2
updated: "2026-11-03"
faq:
  - q: "How do I show a live LaTeX preview in a web app?"
    a: "Compile in a Web Worker with glyphtex-engine, debounce compiles as the user types, and show the returned PDF bytes in an iframe through a blob URL. The Vite example on this page does exactly that."
  - q: "Can glyphtex-engine produce identical PDFs for tests?"
    a: "Yes. Pass deterministic: true (and optionally buildDate) to compile(); the same input then produces byte-identical PDFs, which makes snapshot tests possible."
---

:::takeaways
- Each example runs as shown against `glyphtex-engine` from npm.
- Load the engine, bundle and package sets once; compile many times.
- Run compiles in a Web Worker in the browser.
- `status: "failed"` with `missingFiles` is how a missing package shows up.
:::

The first two are also in the package, under `node_modules/glyphtex-engine/examples/`.

## A LaTeX compiler CLI in Node

Compile a project folder, with subfolders, images and a bibliography, to PDF:

```console
node compile-dir.mjs ./thesis main.tex
```

```js
// compile-dir.mjs
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultPacks, parsePackIndex, TexEngine, unpackTarGz } from "glyphtex-engine";

const [dir, entry = "main.tex"] = process.argv.slice(2);
const asset = (specifier) => readFile(fileURLToPath(import.meta.resolve(specifier)));

async function* walk(root) {
  for (const item of await readdir(root, { withFileTypes: true })) {
    const path = join(root, item.name);
    if (item.isDirectory()) yield* walk(path);
    else if (item.isFile()) yield path;
  }
}

const engine = await TexEngine.load(await asset("glyphtex-engine/wasm"));
engine.addFiles(await unpackTarGz(await asset("glyphtex-engine/bundle")));
const index = parsePackIndex(JSON.parse(await asset("glyphtex-engine/packs/index.json")));
for (const pack of defaultPacks(index)) {
  engine.addFiles(await unpackTarGz(await asset(`glyphtex-engine/packs/pack-${pack.id}.tar.gz`)));
}

// Paths inside the engine are always forward-slashed.
for await (const path of walk(dir)) {
  engine.addFile(relative(dir, path).split(sep).join("/"), await readFile(path));
}

const result = engine.compile({ entry });
for (const d of result.diagnostics.filter((d) => d.severity !== "info")) {
  console.log(`${d.file ?? entry}:${d.line ?? "?"}: ${d.severity}: ${d.message}`);
}
if (result.status === "failed") {
  console.error(result.message, result.missingFiles);
  process.exit(1);
}
await writeFile(join(dir, entry.replace(/\.tex$/, ".pdf")), engine.pdf());
```

## A Vite app with a live preview

A textarea on the left, the PDF on the right, recompiled 400 ms after typing stops.

```js
// src/tex.worker.js
import { TexEngine, unpackTarGz } from "glyphtex-engine";
import wasmUrl from "glyphtex-engine/wasm?url";
import bundleUrl from "glyphtex-engine/bundle?url";

const ready = (async () => {
  const engine = await TexEngine.load(fetch(wasmUrl));
  const bundle = new Uint8Array(await (await fetch(bundleUrl)).arrayBuffer());
  engine.addFiles(await unpackTarGz(bundle));
  return engine;
})();

self.onmessage = async ({ data: { id, source } }) => {
  const engine = await ready;
  engine.addFile("main.tex", source);
  const result = engine.compile({ entry: "main.tex" });
  const pdf = result.status === "failed" ? null : engine.pdf();
  self.postMessage({ id, result, pdf }, pdf ? [pdf.buffer] : []);
};
```

```js
// src/main.js
const worker = new Worker(new URL("./tex.worker.js", import.meta.url), { type: "module" });
const editor = document.querySelector("textarea");
const preview = document.querySelector("iframe");
let latest = 0;
let timer;

worker.onmessage = ({ data: { id, result, pdf } }) => {
  if (id !== latest) return; // a newer compile is already on its way
  if (pdf) {
    URL.revokeObjectURL(preview.src);
    preview.src = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  }
  document.querySelector("#status").textContent = result.status;
};

editor.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(() => worker.postMessage({ id: ++latest, source: editor.value }), 400);
});
```

The first compile waits for the engine and bundle (about 20 MB) to download. Cache both with the Cache API so later visits start immediately.

## A multi-file project with a bibliography

Add every file with its path, then compile the root. BibTeX runs between passes automatically.

```js
engine.addFiles({
  "main.tex": String.raw`\documentclass{report}
\usepackage{graphicx}
\begin{document}
\include{chapters/intro}
\includegraphics[width=\linewidth]{figures/plot.pdf}
As shown by \cite{knuth}.
\bibliographystyle{plain}
\bibliography{refs}
\end{document}`,
  "chapters/intro.tex": String.raw`\chapter{Introduction} ...`,
  "figures/plot.pdf": plotBytes, // a Uint8Array
  "refs.bib": "@book{knuth, author={Donald Knuth}, title={The TeXbook}, year={1984}}"
});

const result = engine.compile({ entry: "main.tex" });
console.log(result.status, result.passesRun); // e.g. "spotless" 3
```

When you switch to a different document that reuses names like `main.tex`, call `engine.clearOutputs()` first, or its old `.aux` files will feed the new document.

## Load package sets only when needed

Skip the up-front download and install a set the first time a document asks for it. A missing package makes the compile `failed`, with the file in `missingFiles`:

```js
import { resolveMissing, unpackTarGz } from "glyphtex-engine";

const installed = []; // persist this, with each pack's hash as the cache key

async function compileWithPacks(engine, index, entry) {
  let result = engine.compile({ entry });
  const { packs, unsupported } = resolveMissing(index, result.missingFiles, installed);
  if (unsupported.length) {
    console.warn("No package set provides:", unsupported);
  }
  if (packs.length) {
    for (const pack of packs) {
      const bytes = new Uint8Array(await (await fetch(`/packs/pack-${pack.id}.tar.gz`)).arrayBuffer());
      engine.addFiles(await unpackTarGz(bytes));
      installed.push({ id: pack.id, hash: pack.hash });
    }
    result = engine.compile({ entry }); // compiles now
  }
  return result;
}
```

`resolveMissing` includes each set's dependencies, in install order.

## Show errors next to the source

Diagnostics carry the file and 1-based line, so they map straight onto editor markers. Box warnings are `info` and are usually not worth a marker.

```js
const markers = result.diagnostics
  .filter((d) => d.severity !== "info" && d.line !== null)
  .map((d) => ({
    file: d.file?.replace(/^\.\//, "") ?? "main.tex",
    line: d.line,
    severity: d.severity, // "error" | "warning"
    message: d.package ? `${d.package}: ${d.message}` : d.message
  }));
```

For the full log, `engine.log()` returns it as text.

## Identical PDFs for snapshot tests

`deterministic: true` fixes the build date and PDF identifiers, so the same input gives the same bytes:

```js
import { createHash } from "node:crypto";

const pdfHash = (source) => {
  engine.clearOutputs();
  engine.addFile("main.tex", source);
  engine.compile({ entry: "main.tex", deterministic: true });
  return createHash("sha256").update(engine.pdf()).digest("hex");
};

assert.equal(pdfHash(source), expectedHash);
```

Set `buildDate` (Unix seconds) if the document prints `\today`.

## Recover from a crashed compile

A compile that traps inside the module leaves the instance unusable and throws `EnginePoisonedError`. Build a new engine and retry once:

```js
import { EnginePoisonedError } from "glyphtex-engine";

async function compileSafely(entry, files) {
  try {
    engine.addFiles(files);
    return engine.compile({ entry });
  } catch (error) {
    if (!(error instanceof EnginePoisonedError)) throw error;
    engine = await createEngine(); // load + bundle + packs, as above
    engine.addFiles(files);
    return engine.compile({ entry });
  }
}
```

## See also

- [glyphtex-engine guide](../glyphtex-engine)
- [API reference](./api)
- [Supported LaTeX packages](../../packages)
