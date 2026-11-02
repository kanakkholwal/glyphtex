---
title: "glyphtex-tex-api: parse TeX logs in Rust"
description: "glyphtex-tex-api is a Rust crate that parses TeX logs into structured errors and warnings with file and line, and defines the typed JSON contract of the GlyphTeX engine."
category: "glyphtex-tex-api (Rust)"
order: 11
updated: "2026-11-03"
faq:
  - q: "How do I parse a LaTeX log file in Rust?"
    a: "Add glyphtex-tex-api to Cargo.toml and call parse_log on the log text. It returns a Vec<Diagnostic> with the severity, source file, line number and message of every error, warning and box warning."
  - q: "Does glyphtex-tex-api compile LaTeX?"
    a: "No. It is the engine's typed API and a log parser, with no C dependencies. The compiler is the glyphtex-engine npm package, which speaks the same JSON types."
---

:::takeaways
- `parse_log` turns any TeX log into errors, warnings and box warnings with file and line.
- `CompileOptions` and `CompileResult` are the GlyphTeX engine's JSON contract, with `serde`.
- No C dependencies, no engine: it builds anywhere, `wasm32-unknown-unknown` included.
- The same types generate the TypeScript of `glyphtex-engine`, through `ts-rs`.
:::

## Install

```toml
[dependencies]
glyphtex-tex-api = "0.1"
serde_json = "1" # only if you send or receive the JSON
```

API documentation is on [docs.rs](https://docs.rs/glyphtex-tex-api), source on [GitHub](https://github.com/kanakkholwal/glyphtex/tree/main/crates/glyphtex-tex-api).

## Parse a TeX log

```rust
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

It works on logs from pdfLaTeX, XeLaTeX, LuaLaTeX and Tectonic. For a log with an undefined command at `l.12`, a missing reference and an overfull box, it reports:

```text
error   main.tex:12 Undefined control sequence.
warning main.tex:20 Reference `fig:plot' on page 1 undefined on input line 20.
info    main.tex:24 Overfull \hbox (79.26889pt too wide) in paragraph at lines 24--25
```

How it works:

- **Wrapped lines are rejoined.** TeX hard-wraps its log at 79 columns, so one message can span several lines.
- **Files are tracked** through TeX's `(file … )` nesting. File names may contain parentheses, so this is best effort, and a diagnostic is still emitted when the file is unknown.
- **Error lines come from the `l.<n>` context** TeX prints after an error.

## Talk to the GlyphTeX engine

The engine takes `CompileOptions` as JSON and answers with a `CompileResult`. Build one with the defaults and override what you need:

```rust
use glyphtex_tex_api::CompileOptions;

let options = CompileOptions {
    entry: "thesis.tex".to_owned(),
    synctex: true,
    paper: "a4".to_owned(),
    ..CompileOptions::default()
}
.normalized(); // clamps pass counts into 1..=16

let json = serde_json::to_string(&options).unwrap();
```

Field names are camelCase on the wire and every field is optional, so `{ "entry": "notes.tex" }` is a complete request. [More in the examples](./glyphtex-tex-api/examples).

## TypeScript from the same types

Every type derives `ts_rs::TS`. Running `cargo test` writes matching `.ts` files into `bindings/`; in the GlyphTeX repository those become the types of [glyphtex-engine](./glyphtex-engine), and CI fails if they drift.

## Next

- [Examples](./glyphtex-tex-api/examples): a CI log checker, GitHub annotations, and engine requests.
- [API reference](./glyphtex-tex-api/api)
- [glyphtex-engine](./glyphtex-engine), the compiler these types describe.
