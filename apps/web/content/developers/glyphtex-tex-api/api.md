---
title: "glyphtex-tex-api API reference"
description: "Every glyphtex-tex-api item: parse_log, CompileOptions and its defaults, CompileResult, CompileStatus, Diagnostic, Severity, OutputFile, OutputKind, OutputFormat and LogLevel."
category: "glyphtex-tex-api (Rust)"
order: 13
updated: "2026-11-03"
---

:::takeaways
- One function, `parse_log`, and the types of the GlyphTeX engine's JSON contract.
- All types implement `Serialize`, `Deserialize`, `Clone`, `Debug` and `ts_rs::TS`.
- Rustdoc for every item is on [docs.rs](https://docs.rs/glyphtex-tex-api).
:::

## parse_log

```rust
pub fn parse_log(log: &str) -> Vec<Diagnostic>
```

Parses a TeX log into diagnostics, in the order they appear. Errors come from `! ` lines, with the line number from the `l.<n>` context that follows. Warnings come from `LaTeX Warning:` and `Package … Warning:` lines. Overfull and underfull boxes are `Severity::Info`. Messages that TeX wrapped at 79 columns are rejoined.

## CompileOptions

```rust
pub struct CompileOptions { /* fields below */ }
impl Default for CompileOptions          // what `tectonic main.tex` does
impl CompileOptions {
    pub fn resolved_jobname(&self) -> &str;  // jobname, or entry without ".tex"
    pub fn normalized(self) -> Self;         // clamps max_passes to 1..=16, min_passes to 1..=max
}
```

Serialised with camelCase names and `#[serde(default)]`, so any subset of fields is a valid request.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `entry` | `String` | `"main.tex"` | Root document. |
| `jobname` | `Option<String>` | `None` | Base name for outputs. |
| `max_passes` | `u8` | `4` | Upper bound on XeTeX passes. |
| `min_passes` | `u8` | `1` | Passes run regardless of rerun requests. |
| `halt_on_error` | `bool` | `false` | Stop at the first TeX error. |
| `shell_escape` | `bool` | `false` | Permit `\write18`. Always fails in WebAssembly. |
| `synctex` | `bool` | `false` | Write `<jobname>.synctex.gz`. |
| `semantic_pagination` | `bool` | `false` | XeTeX semantic pagination. |
| `initex` | `bool` | `false` | Dump a format instead of typesetting. |
| `output_format` | `OutputFormat` | `Pdf` | `Xdv` skips xdvipdfmx. |
| `paper` | `String` | `"letter"` | Default paper size. |
| `compress_pdf` | `bool` | `true` | Compress PDF streams. |
| `deterministic` | `bool` | `false` | Byte-identical output across runs. |
| `build_date` | `Option<i64>` | `None` | Build time in Unix seconds. |
| `keep_intermediates` | `bool` | `false` | List `.aux` and similar in `outputs`. |
| `keep_logs` | `bool` | `true` | Keep `.log` in `outputs`. |
| `log_level` | `LogLevel` | `Error` | Engine verbosity. |

## CompileResult

| Field | Type | Description |
| --- | --- | --- |
| `status` | `CompileStatus` | Overall outcome. |
| `passes_run` | `u8` | XeTeX passes that ran. |
| `outputs` | `Vec<OutputFile>` | Files produced, with sizes. |
| `diagnostics` | `Vec<Diagnostic>` | Parsed from the log. |
| `missing_files` | `Vec<String>` | Files TeX asked for and did not find. |
| `message` | `Option<String>` | Why a `Failed` compile produced nothing. |

`CompileResult::failed(message, missing_files)` builds a failed result.

## Enums

| Type | Variants | Wire form |
| --- | --- | --- |
| `CompileStatus` | `Spotless`, `Warnings`, `Errors`, `Failed` | lowercase |
| `Severity` | `Error`, `Warning`, `Info` | lowercase |
| `OutputKind` | `Pdf`, `Xdv`, `Log`, `Synctex`, `Intermediate`, `Format`, `Other` | lowercase |
| `OutputFormat` | `Pdf` (default), `Xdv` | lowercase |
| `LogLevel` | `Silent`, `Error` (default), `Info`, `Trace` | lowercase |

`Failed` is the only status without output: TeX recovers from most errors and still typesets, so `Errors` usually has a PDF. `OutputKind::classify(name)` maps a file name to its kind, `.synctex.gz` included.

## Diagnostic

| Field | Type | Description |
| --- | --- | --- |
| `severity` | `Severity` | Error, warning or info. |
| `file` | `Option<String>` | Source file, when the log identifies one. |
| `line` | `Option<u32>` | 1-based line, when known. |
| `message` | `String` | The message, unwrapped. |
| `package` | `Option<String>` | The package that emitted it, such as `hyperref`. |

## OutputFile

| Field | Type | Description |
| --- | --- | --- |
| `name` | `String` | File name as the engine wrote it. |
| `size` | `usize` | Size in bytes. |
| `kind` | `OutputKind` | Classification. |

## See also

- [Guide](../glyphtex-tex-api) · [Examples](./examples)
- [glyphtex-engine API](../glyphtex-engine/api), the same contract in TypeScript
