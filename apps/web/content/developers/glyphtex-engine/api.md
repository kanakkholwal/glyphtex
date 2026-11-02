---
title: "glyphtex-engine API reference"
description: "Every glyphtex-engine export: TexEngine methods, compile options and defaults, CompileResult and Diagnostic types, package-set helpers, archive helpers and errors."
category: "glyphtex-engine (npm)"
order: 3
updated: "2026-11-03"
---

:::takeaways
- One class, `TexEngine`, plus helpers for package sets and archives.
- Every compile option is optional; the defaults match `tectonic main.tex`.
- The types are generated from the Rust crate, so they match the engine exactly.
:::

## TexEngine

```ts
import { TexEngine } from "glyphtex-engine";
const engine = await TexEngine.load(source, io?);
```

| Member | Returns | Description |
| --- | --- | --- |
| `TexEngine.load(source, io?)` | `Promise<TexEngine>` | Instantiate the engine. `source` is bytes, a `WebAssembly.Module`, a `Response` or a promise of one; a `Response` compiles while it downloads. |
| `addFile(name, data)` | `void` | Add or replace a file. `data` is a string (stored as UTF-8) or a `Uint8Array`. |
| `addFiles(files)` | `void` | Add many files from an object, a `Map`, or any iterable of `[name, data]`. |
| `removeFile(name)` | `boolean` | Remove a file; returns whether it existed. |
| `clearFiles()` | `void` | Remove every input file, the bundle included. |
| `clearOutputs()` | `void` | Drop the last compile's outputs and auxiliary files. |
| `fileCount` | `number` | Files in the virtual filesystem. |
| `compile(request?)` | `CompileResult` | Compile. Synchronous; run it in a worker in the browser. |
| `output(name)` | `Uint8Array \| undefined` | Bytes of a file the last compile produced. |
| `pdf(jobname?)` | `Uint8Array \| undefined` | The last compile's PDF. |
| `log(jobname?)` | `string \| undefined` | The last compile's TeX log. |

`io` is `{ onStderr?(text), onStdout?(text) }`, for the engine's own output.

Outputs and auxiliary files are kept between compiles so a recompile converges in fewer passes. `pdf()` and `log()` default to the job name of the last compile.

## Compile options

`compile(request)` takes a `Partial<CompileOptions>`. Omitted fields take these defaults:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `entry` | `string` | `"main.tex"` | Root document. |
| `jobname` | `string \| null` | from `entry` | Base name for the `.pdf`, `.log` and `.synctex.gz`. |
| `maxPasses` | `number` | `4` | Upper bound on XeTeX passes, clamped to 1–16. |
| `minPasses` | `number` | `1` | Passes to run even if no rerun is requested. |
| `haltOnError` | `boolean` | `false` | Stop at the first TeX error. |
| `synctex` | `boolean` | `false` | Write `<jobname>.synctex.gz`. |
| `outputFormat` | `"pdf" \| "xdv"` | `"pdf"` | `"xdv"` skips xdvipdfmx. |
| `paper` | `string` | `"letter"` | Default paper size, such as `"a4"`. |
| `compressPdf` | `boolean` | `true` | `false` leaves PDF streams readable as text. |
| `deterministic` | `boolean` | `false` | Byte-identical output for identical input. |
| `buildDate` | `number \| null` | `null` | Build time in Unix seconds. |
| `keepIntermediates` | `boolean` | `false` | List `.aux`, `.toc` and similar in `outputs`. |
| `keepLogs` | `boolean` | `true` | Keep the `.log` among the outputs. |
| `logLevel` | `"silent" \| "error" \| "info" \| "trace"` | `"error"` | Engine verbosity, sent to `io`. |
| `semanticPagination` | `boolean` | `false` | XeTeX semantic pagination, for HTML backends. |
| `initex` | `boolean` | `false` | Run INITEX and dump a `.fmt` instead of typesetting. |
| `shellEscape` | `boolean` | `false` | Kept for parity with native builds; no effect in WebAssembly. |

## CompileResult

```ts
type CompileResult = {
  status: "spotless" | "warnings" | "errors" | "failed";
  passesRun: number;
  outputs: OutputFile[];
  diagnostics: Diagnostic[];
  missingFiles: string[];
  message: string | null; // set when status is "failed"
};
```

| Field | Description |
| --- | --- |
| `status` | `failed` is the only value without output. `errors` usually still has a PDF. |
| `passesRun` | XeTeX passes that ran; reruns stop once auxiliary files settle. |
| `outputs` | Files produced, with sizes. Read their bytes with `output(name)`. |
| `diagnostics` | Errors, warnings and box warnings parsed from the log. |
| `missingFiles` | Files TeX asked for and did not find, such as `fancyhdr.sty`. |
| `message` | Why a `failed` compile produced nothing. |

## Diagnostic

```ts
type Diagnostic = {
  severity: "error" | "warning" | "info";
  file: string | null;     // e.g. "chapters/intro.tex"
  line: number | null;     // 1-based
  message: string;         // TeX's line wrapping undone
  package: string | null;  // e.g. "hyperref"
};
```

Overfull and underfull boxes are reported as `info`.

## OutputFile

```ts
type OutputFile = {
  name: string;
  size: number;
  kind: "pdf" | "xdv" | "log" | "synctex" | "intermediate" | "format" | "other";
};
```

## Package sets

| Function | Description |
| --- | --- |
| `parsePackIndex(json)` | Validate a parsed `packs/index.json`. Throws on a malformed index or one newer than this version understands. |
| `defaultPacks(index)` | Packs to install up front, with their dependencies. |
| `resolveMissing(index, missingFiles, installed?)` | `{ packs, unsupported }`: the packs that provide the missing files (dependencies first), and the files no pack provides. |
| `PACK_INDEX_VERSION` | The index format this version reads. |

```ts
type PackDefinition = {
  id: string;            // the archive is pack-<id>.tar.gz
  label: string;
  description: string;
  packages: string[];    // .sty / .cls names it provides
  requires: string[];    // packs it depends on
  optional: boolean;     // left out of defaultPacks
  bytes: number;         // compressed size
  hash: string;          // content hash, a good cache key
};
type InstalledPack = { id: string; hash: string };
```

## Archives

| Function | Description |
| --- | --- |
| `unpackTarGz(bytes)` | `Promise<Map<string, Uint8Array>>`. Unpack the bundle or a pack for `addFiles`. Accepts plain `.tar` too. |
| `gunzip(bytes)` | `Promise<Uint8Array>`. Decompress gzip; passes other bytes through. |
| `untar(bytes)` | `Map<string, Uint8Array>`. Read a ustar archive's regular files by base name. |

## Errors

| Class | Thrown when |
| --- | --- |
| `EngineError` | A call was rejected: invalid arguments, unparsable options, a module that is not a GlyphTeX engine, or an ABI mismatch. `code` holds the status code. |
| `EnginePoisonedError` | A compile trapped inside the module. The instance cannot be used again: load a new one. Extends `EngineError`. |
| `ExitStatus` | Internal: the module's `proc_exit`. Not thrown to callers in normal use. |

`SUPPORTED_ABI_VERSION` is the engine ABI this wrapper speaks; `load()` rejects modules built for another.

## See also

- [Guide](../glyphtex-engine) · [Examples](./examples)
- [glyphtex-tex-api](../glyphtex-tex-api), the same types in Rust
