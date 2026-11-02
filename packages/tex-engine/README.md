# glyphtex-engine

[![npm](https://img.shields.io/npm/v/glyphtex-engine)](https://www.npmjs.com/package/glyphtex-engine)
[![licence](https://img.shields.io/npm/l/glyphtex-engine)](./LICENSE)

Compile LaTeX to PDF in the browser or in Node, with no server and no TeX install.
It is [Tectonic](https://tectonic-typesetting.github.io) (XeTeX, xdvipdfmx and BibTeX)
compiled to WebAssembly, plus a TeX bundle and typed bindings. It powers the
[GlyphTeX](https://glyphtex.nexonauts.com) editor.

- Real XeTeX, so documents behave as they do in TeX Live: reruns, `.aux` files, BibTeX.
- The engine, the LaTeX format and the packages all ship inside the package.
- Typed end to end: the option and result types are generated from the Rust API.
- Structured diagnostics with file and line, instead of a raw log to grep.

Full guide and runnable examples: **[glyphtex.nexonauts.com/developers/glyphtex-engine](https://glyphtex.nexonauts.com/developers/glyphtex-engine)**.

## Contents

- [Install](#install)
- [Quick start (Node)](#quick-start-node)
- [In the browser](#in-the-browser)
- [Package sets](#package-sets)
- [Reading the result](#reading-the-result)
- [API reference](#api-reference)
- [Limits](#limits)

## Install

```console
npm install glyphtex-engine
```

Node 20.6 or later (the examples use `import.meta.resolve`; the bindings themselves need
Node 18 for `DecompressionStream`), or any current browser. The package
carries everything the engine needs:

| Export | What it is |
| --- | --- |
| `glyphtex-engine` | The bindings: `TexEngine`, pack helpers, tar helpers, types |
| `glyphtex-engine/wasm` | The engine, `tectonic_wasm.wasm` (~3.5 MB) |
| `glyphtex-engine/bundle` | The TeX bundle, `.tar.gz` (~15 MB): LaTeX format, classes, core packages, fonts |
| `glyphtex-engine/packs/index.json` | Index of the optional package sets |
| `glyphtex-engine/packs/pack-<id>.tar.gz` | One package set |
| `glyphtex-engine/bundle-manifest.json` | The headline packages the bundle guarantees |
| `glyphtex-engine/packs.config.json` | What each package set contains |

## Quick start (Node)

```js
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defaultPacks, parsePackIndex, TexEngine, unpackTarGz } from "glyphtex-engine";

const asset = (specifier) => readFile(fileURLToPath(import.meta.resolve(specifier)));

const engine = await TexEngine.load(await asset("glyphtex-engine/wasm"));
engine.addFiles(await unpackTarGz(await asset("glyphtex-engine/bundle")));

// Package sets: fancyhdr, tcolorbox, biblatex, beamer themes and more.
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

A complete version with a bibliography is in
[`examples/node-compile.mjs`](./examples/node-compile.mjs).

## In the browser

Compile in a Web Worker: a compile is synchronous and takes from tens of
milliseconds to a few seconds, which would freeze the page on the main thread.

```js
// tex.worker.js
import { TexEngine, unpackTarGz } from "glyphtex-engine";
import wasmUrl from "glyphtex-engine/wasm?url";     // Vite; other bundlers have an equivalent
import bundleUrl from "glyphtex-engine/bundle?url";

const ready = (async () => {
	// Passing the Response lets the module compile while it downloads.
	const engine = await TexEngine.load(fetch(wasmUrl));
	const bundle = new Uint8Array(await (await fetch(bundleUrl)).arrayBuffer());
	engine.addFiles(await unpackTarGz(bundle));
	return engine;
})();

self.onmessage = async ({ data: { files, entry } }) => {
	const engine = await ready;
	engine.addFiles(files);
	const result = engine.compile({ entry, synctex: true });
	const pdf = result.status === "failed" ? null : engine.pdf();
	self.postMessage({ result, pdf }, pdf ? [pdf.buffer] : []);
};
```

```js
// main.js
const worker = new Worker(new URL("./tex.worker.js", import.meta.url), { type: "module" });
worker.onmessage = ({ data: { result, pdf } }) => {
	if (pdf) iframe.src = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
	console.table(result.diagnostics);
};
worker.postMessage({ entry: "main.tex", files: { "main.tex": source } });
```

Serve the wasm and the bundle from your own origin and cache them (the
[Cache API](https://developer.mozilla.org/docs/Web/API/Cache) works well): together
they are about 20 MB. The engine needs no `SharedArrayBuffer`, so no COOP/COEP headers.

## Package sets

The bundle covers the common packages (amsmath, graphicx, hyperref, tikz, pgfplots,
geometry, booktabs, listings, siunitx, beamer, …). Package sets add more, each a
small `.tar.gz`. `defaultPacks(index)` lists the ones to load up front; optional ones
(large fonts) are worth loading only when a document asks for them:

```js
import { resolveMissing } from "glyphtex-engine";

let result = engine.compile({ entry: "main.tex" });
const { packs, unsupported } = resolveMissing(index, result.missingFiles, installed);
for (const pack of packs) {
	engine.addFiles(await unpackTarGz(await loadPack(pack.id)));   // your fetch or readFile
	installed.push({ id: pack.id, hash: pack.hash });
}
if (packs.length) result = engine.compile({ entry: "main.tex" });
if (unsupported.length) console.warn("No package set provides:", unsupported);
```

`pack.hash` changes whenever a pack's contents do, so use it as a cache key. The
full list of supported packages is at
[glyphtex.nexonauts.com/packages](https://glyphtex.nexonauts.com/packages).

## Reading the result

`compile()` returns for every run that completed. `status` has four values, and only
one of them means there is no PDF:

| `status` | Meaning |
| --- | --- |
| `spotless` | No warnings or errors. |
| `warnings` | Warnings only, the common case for real documents. |
| `errors` | TeX reported errors but recovered. **A PDF usually still exists.** |
| `failed` | Nothing was produced. `message` says why. |

```js
const result = engine.compile({ entry: "main.tex" });

for (const d of result.diagnostics) {
	// { severity: "error" | "warning" | "info", file, line, message, package }
	console.log(`${d.severity} ${d.file ?? "?"}:${d.line ?? "?"} ${d.message}`);
}
result.missingFiles;   // ["fancyhdr.sty"]: files TeX asked for and did not find
result.outputs;        // [{ name: "main.pdf", size: 48213, kind: "pdf" }, { name: "main.xdv", … }]
result.passesRun;      // reruns stop once the .aux files stop changing

engine.pdf();          // Uint8Array, for the last compile's job name
engine.log();          // the TeX log as text
engine.output("main.synctex.gz");
```

Multi-file projects work the same way: add every file, then compile the root.
`\input`, `\include`, `\includegraphics` and `\bibliography` resolve against the
same virtual filesystem.

```js
engine.addFiles({
	"main.tex": main,
	"chapters/intro.tex": intro,
	"figures/plot.pdf": plotBytes,   // Uint8Array
	"refs.bib": bib
});
engine.compile({ entry: "main.tex" });
```

> **BibTeX styles live in a package set.** `plain.bst` and the other `.bst` files are
> in the `references` set, which `defaultPacks` includes. Without it BibTeX cannot
> open the style, citations stay `[?]`, and the only trace is in `engine.output("main.blg")`:
> a missing `.bst` is not reported in `missingFiles`.

## API reference

### `TexEngine`

| Member | Description |
| --- | --- |
| `static load(source, io?)` | Instantiate the engine. `source` is bytes, a `WebAssembly.Module`, a `Response` or a promise of one. Throws `EngineError` if the module is not a GlyphTeX engine or its ABI does not match. |
| `addFile(name, data)` | Add or replace a file. `data` is a string (stored as UTF-8) or a `Uint8Array`. |
| `addFiles(files)` | Add many files from an object, a `Map` or any iterable of `[name, data]`. |
| `removeFile(name)` | Remove a file. Returns whether it existed. |
| `clearFiles()` | Remove every input file, bundle included. |
| `clearOutputs()` | Drop the previous compile's outputs and `.aux` files, forcing a cold build. |
| `fileCount` | Number of files in the virtual filesystem. |
| `compile(request?)` | Compile and return a `CompileResult`. Every option is optional. |
| `output(name)` | Bytes of a file from the last compile, or `undefined`. |
| `pdf(jobname?)` | The last compile's PDF. |
| `log(jobname?)` | The last compile's log, decoded. |

Outputs and `.aux` files are kept between compiles of the same document, which is
what lets a recompile converge in fewer passes. Call `clearOutputs()` when you switch
to a different document that uses the same file names.

### Compile options

| Option | Default | Description |
| --- | --- | --- |
| `entry` | `"main.tex"` | Root document. |
| `jobname` | `entry` without `.tex` | Base name for `.pdf`, `.log`, `.synctex`. |
| `maxPasses` | `4` | Upper bound on XeTeX passes (clamped to 1–16). |
| `minPasses` | `1` | Passes to run regardless of rerun requests. |
| `haltOnError` | `false` | Stop at the first TeX error. |
| `synctex` | `false` | Write `<jobname>.synctex.gz` for source ↔ PDF mapping. |
| `outputFormat` | `"pdf"` | `"xdv"` skips xdvipdfmx. |
| `paper` | `"letter"` | Default paper size, such as `"a4"`. |
| `compressPdf` | `true` | Set `false` to read the PDF as text. |
| `deterministic` | `false` | Byte-identical output across runs. |
| `buildDate` | `null` | Unix seconds to use as the build date. |
| `keepIntermediates` | `false` | List `.aux`, `.toc` and similar in `outputs`. |
| `keepLogs` | `true` | Keep the `.log` among the outputs. |
| `logLevel` | `"error"` | Engine verbosity: `silent`, `error`, `info`, `trace`. |
| `semanticPagination` | `false` | XeTeX semantic pagination (HTML backends). |
| `initex` | `false` | Run INITEX and dump a format instead of typesetting. |
| `shellEscape` | `false` | Accepted for parity with native builds; has no effect in WebAssembly. |

### Results

```ts
type CompileResult = {
	status: "spotless" | "warnings" | "errors" | "failed";
	passesRun: number;
	outputs: { name: string; size: number; kind: OutputKind }[];
	diagnostics: Diagnostic[];
	missingFiles: string[];
	message: string | null;      // set when status is "failed"
};
type Diagnostic = {
	severity: "error" | "warning" | "info";   // overfull/underfull boxes are "info"
	file: string | null;
	line: number | null;
	message: string;               // TeX's line wrapping undone
	package: string | null;        // e.g. "hyperref"
};
type OutputKind = "pdf" | "xdv" | "log" | "synctex" | "intermediate" | "format" | "other";
```

### Package sets and archives

| Function | Description |
| --- | --- |
| `parsePackIndex(json)` | Validate a parsed `packs/index.json`; throws on a malformed or newer index. |
| `defaultPacks(index)` | Packs to install up front, dependencies included. |
| `resolveMissing(index, missingFiles, installed?)` | Packs that provide the missing files (with dependencies), and the files no pack provides. |
| `unpackTarGz(bytes)` | Async. Unpack the bundle or a pack into a `Map` for `addFiles`. |
| `gunzip(bytes)`, `untar(bytes)` | The two halves of `unpackTarGz`. |

### Errors

| Class | When |
| --- | --- |
| `EngineError` | The module rejected a call: bad arguments, invalid options JSON, an ABI mismatch. `code` holds the status code. |
| `EnginePoisonedError` | A compile trapped inside the module, which leaves the instance unusable. Discard it and `load()` a new one; every later call would fail too. |

```js
try {
	result = engine.compile({ entry });
} catch (error) {
	if (!(error instanceof EnginePoisonedError)) throw error;
	engine = await freshEngine();   // load + add the bundle and packs again
	result = engine.compile({ entry });
}
```

### Logging

`TexEngine.load(source, { onStderr, onStdout })` receives the engine's own output,
which is useful with `logLevel: "info"` or `"trace"`.

## Limits

These need a subprocess or system resources a WebAssembly sandbox does not have:

- **`minted`** needs Python. Use `listings`, which is pure TeX and is in the bundle.
- **`biber`** is a Perl program. Use `biblatex` with `backend=bibtex`, which runs in-process.
- **Shell escape** and **TikZ externalisation** need to start processes.
- **System fonts** are not visible. Add `.otf`/`.ttf` files to the project and load them with `fontspec` by file name.
- **`xeCJK`** and colour emoji are not supported yet.

A document that needs a package no pack provides fails with that file in
`missingFiles`. Request it at
[github.com/kanakkholwal/glyphtex/issues](https://github.com/kanakkholwal/glyphtex/issues/new?title=Package%20support%3A%20).

## Types come from Rust

`src/generated/` is produced from [`glyphtex-tex-api`](https://crates.io/crates/glyphtex-tex-api)
by [ts-rs](https://github.com/Aleph-Alpha/ts-rs), so the TypeScript types cannot drift
from what the engine accepts. Regenerate with `pnpm generate`.

## Development

```console
pnpm build
GLYPHTEX_BUNDLE=/path/to/extracted/bundle pnpm test
```

The compile tests skip without an engine and bundle; set `GLYPHTEX_REQUIRE_ENGINE=1`
to make that a failure. How the bundle and package sets are built is in
[PACKS.md](./PACKS.md).

## Licence

MIT. The engine is built from Tectonic (MIT), and the TeX bundle contains TeX Live
packages under their own free licences.
