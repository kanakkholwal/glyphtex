//! Typed API surface for the GlyphX TeX engine, plus TeX log parsing.
//!
//! This crate holds everything that does *not* need the TeX engine: the option
//! and result types that cross the WebAssembly boundary as JSON, and the parser
//! that turns a TeX log into structured diagnostics.
//!
//! Keeping it separate from the engine crate has a practical payoff. The engine
//! must be built for `wasm32-unknown-emscripten` against a C toolchain; this
//! crate builds anywhere. So the TypeScript declarations — generated from these
//! types by `ts-rs` — can be produced and tested on any machine:
//!
//! ```console
//! $ cargo test -p glyphx-tex-api
//! ```
//!
//! which writes `.ts` files into `bindings/`.

pub mod api;
pub mod logparse;

pub use api::{
    CompileOptions, CompileResult, CompileStatus, Diagnostic, LogLevel, OutputFile, OutputFormat,
    OutputKind, Severity,
};
pub use logparse::parse as parse_log;
