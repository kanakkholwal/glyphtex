# glyphtex-tex-api

[![crates.io](https://img.shields.io/crates/v/glyphtex-tex-api)](https://crates.io/crates/glyphtex-tex-api)
[![docs.rs](https://img.shields.io/docsrs/glyphtex-tex-api)](https://docs.rs/glyphtex-tex-api)
[![licence](https://img.shields.io/crates/l/glyphtex-tex-api)](./LICENSE)

The typed contract of the [GlyphTeX](https://glyphtex.nexonauts.com) TeX engine, and a
parser that turns a TeX log into structured diagnostics.

GlyphTeX compiles LaTeX with Tectonic's XeTeX built to WebAssembly. Options go into
that engine as JSON and results come back as JSON; this crate defines both, with
`serde` and `ts-rs`, so Rust hosts, the TypeScript bindings and the engine all agree on
one shape. It has no C dependencies and does not contain the engine, so it builds
anywhere, `wasm32-unknown-unknown` included.

Use it to:

- **Parse TeX logs** from any TeX run (pdfLaTeX, XeLaTeX, LuaLaTeX, Tectonic) into
  errors, warnings and box warnings with file and line.
- **Drive the GlyphTeX engine** from Rust: build requests and read results with the
  exact types the engine uses.
- **Generate TypeScript types** that match your Rust service.

Guide and examples: **[glyphtex.nexonauts.com/developers/glyphtex-tex-api](https://glyphtex.nexonauts.com/developers/glyphtex-tex-api)**.
API docs: [docs.rs/glyphtex-tex-api](https://docs.rs/glyphtex-tex-api).

## Install

```toml
[dependencies]
glyphtex-tex-api = "0.1"
serde_json = "1"   # to send and receive the JSON
```

## Parse a TeX log

```rust,no_run
use glyphtex_tex_api::{parse_log, Severity};

fn main() -> std::io::Result<()> {
    let log = std::fs::read_to_string("main.log")?;
    for d in parse_log(&log) {
        let place = format!("{}:{}", d.file.as_deref().unwrap_or("?"), d.line.unwrap_or(0));
        match d.severity {
            Severity::Error => eprintln!("error   {place} {}", d.message),
            Severity::Warning => eprintln!("warning {place} {}", d.message),
            Severity::Info => {} // overfull and underfull boxes
        }
    }
    Ok(())
}
```

For a log with `! Undefined control sequence.` at `l.12`, a missing reference and an
overfull box, that prints:

```text
error   main.tex:12 Undefined control sequence.
warning main.tex:20 Reference `fig:plot' on page 1 undefined on input line 20.
```

The parser undoes TeX's 79-column line wrapping, attaches the file by tracking TeX's
`(file … )` nesting, and reads the line from the `l.<n>` context after an error. File
attribution is best effort, since file names can contain parentheses; it never stops a
diagnostic from being emitted.

## Build a request, read a result

```rust
use glyphtex_tex_api::{CompileOptions, CompileResult, CompileStatus, OutputKind};

fn main() -> Result<(), serde_json::Error> {
    // Start from the defaults (what `tectonic main.tex` does) and override.
    let options = CompileOptions {
        entry: "thesis.tex".to_owned(),
        synctex: true,
        paper: "a4".to_owned(),
        ..CompileOptions::default()
    }
    .normalized(); // clamps passes into 1..=16
    assert_eq!(options.resolved_jobname(), "thesis");

    let request = serde_json::to_string(&options)?;
    println!("send to the engine: {request}");

    // ...and parse what comes back.
    let reply = r#"{ "status": "warnings", "passesRun": 2, "missingFiles": [], "message": null,
        "outputs": [{ "name": "thesis.pdf", "size": 48213, "kind": "pdf" }], "diagnostics": [] }"#;
    let result: CompileResult = serde_json::from_str(reply)?;
    if result.status != CompileStatus::Failed {
        let pdf = result.outputs.iter().find(|o| o.kind == OutputKind::Pdf);
        println!("{:?} in {} passes: {:?}", result.status, result.passes_run, pdf);
    }
    Ok(())
}
```

Every field is optional on the wire (`#[serde(default)]`), and names are camelCase,
so `{ "entry": "notes.tex", "maxPasses": 3 }` is a complete request.

Runnable versions of both: `cargo run --example parse_log [main.log]` and
`cargo run --example compile_request`.

## API

| Item | What it is |
| --- | --- |
| `parse_log(&str) -> Vec<Diagnostic>` | TeX log to diagnostics, in log order. |
| `CompileOptions` | Every compile setting. `Default` matches `tectonic`; `normalized()` clamps pass counts; `resolved_jobname()` derives the job name from `entry`. |
| `CompileResult` | `status`, `passes_run`, `outputs`, `diagnostics`, `missing_files`, `message`. `CompileResult::failed(msg, missing)` builds a failure. |
| `CompileStatus` | `Spotless`, `Warnings`, `Errors`, `Failed`. Only `Failed` means no output; TeX recovers from most errors. |
| `Diagnostic` | `severity`, `file`, `line`, `message`, `package`. |
| `Severity` | `Error`, `Warning`, `Info` (box warnings are `Info`). |
| `OutputFile` | `name`, `size`, `kind` of one produced file. |
| `OutputKind` | `Pdf`, `Xdv`, `Log`, `Synctex`, `Intermediate`, `Format`, `Other`. `OutputKind::classify(name)` maps a file name, including `.synctex.gz`. |
| `OutputFormat` | `Pdf` (default) or `Xdv`. |
| `LogLevel` | `Silent`, `Error` (default), `Info`, `Trace`. |

### `CompileOptions` fields

| Field | Default | Description |
| --- | --- | --- |
| `entry` | `"main.tex"` | Root document. |
| `jobname` | `None` | Base name for outputs; derived from `entry` when unset. |
| `max_passes` / `min_passes` | `4` / `1` | XeTeX pass bounds; reruns stop when `.aux` files settle. |
| `halt_on_error` | `false` | Stop at the first TeX error. |
| `shell_escape` | `false` | Permit `\write18`. Always fails in WebAssembly. |
| `synctex` | `false` | Write `<jobname>.synctex.gz`. |
| `semantic_pagination` | `false` | XeTeX semantic pagination for HTML backends. |
| `initex` | `false` | Run INITEX and dump `<jobname>.fmt` instead of typesetting. |
| `output_format` | `Pdf` | `Xdv` skips xdvipdfmx. |
| `paper` | `"letter"` | Default paper size, e.g. `"a4"`. |
| `compress_pdf` | `true` | Compress PDF streams. |
| `deterministic` | `false` | Byte-identical output across runs. |
| `build_date` | `None` | Unix seconds for the build date. |
| `keep_intermediates` | `false` | List `.aux`, `.toc` and similar in `outputs`. |
| `keep_logs` | `true` | Keep `.log` among the outputs. |
| `log_level` | `Error` | Engine verbosity. |

## TypeScript bindings

The types derive [`ts-rs`](https://crates.io/crates/ts-rs)'s `TS`, so `cargo test` writes
matching declarations into `bindings/`. In the GlyphTeX repository they become the
types of the [`glyphtex-engine`](https://www.npmjs.com/package/glyphtex-engine) npm
package, and CI fails if they drift. `bindings/` is not in the published crate.

## The engine

The compiler is the `glyphtex-engine` npm package: the `.wasm` module, a TeX bundle and
TypeScript bindings. This crate does not compile documents and does not depend on it.

## Licence

MIT.
