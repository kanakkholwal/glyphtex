# glyphtex-tex-api

Typed API surface and TeX log parsing for [GlyphTeX](https://github.com/kanakkholwal/glyphtex),
a real TeX engine (Tectonic's XeTeX, xdvipdfmx and BibTeX) compiled to WebAssembly.

This crate holds everything that does **not** need the engine: the option and
result types that cross the WebAssembly boundary as JSON, and the parser that
turns a TeX log into structured diagnostics.

That separation is deliberate. The engine must be built for
`wasm32-unknown-emscripten` against a C toolchain; this crate builds anywhere,
which is what lets the TypeScript declarations be generated and tested without
Emscripten installed.

## Use

```toml
[dependencies]
glyphtex-tex-api = "0.1"
```

```rust
use glyphtex_tex_api::{parse_log, Severity};

let diagnostics = parse_log("! LaTeX Error: File `nope.sty' not found.\n");
assert_eq!(diagnostics[0].severity, Severity::Error);
```

## TypeScript bindings

The types are annotated for [`ts-rs`](https://crates.io/crates/ts-rs), so
running the tests writes matching `.ts` declarations into `bindings/`:

```console
$ cargo test
```

The published crate excludes `bindings/`, since it is generated output. In the
GlyphTeX repository those files are committed and CI fails if they drift from
the Rust definitions.

## Engine

The compiler itself ships separately as the `glyphtex-engine` npm package, which
carries the `.wasm` module and a bundled TeX distribution. This crate does not
depend on it and does not compile documents on its own.

## Licence

MIT.
