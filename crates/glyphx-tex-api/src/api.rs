//! The typed boundary between the engine and its callers.
//!
//! These types are the single source of truth for the API: `serde` carries them
//! across the WASM boundary as JSON, and `ts-rs` emits the matching TypeScript
//! declarations into `packages/tex-engine/src/generated/` (written by the
//! `export_bindings_*` tests, which `pnpm generate` drives).
//!
//! Only the *control plane* travels as JSON. File contents — the LaTeX source
//! going in, the PDF coming out — move through raw linear memory, because
//! base64-ing a multi-megabyte PDF through a JSON string would dominate the
//! cost of a compile that otherwise takes well under a second.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// How much the engine should write to stderr.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    /// Nothing at all.
    Silent,
    /// Fatal problems only.
    #[default]
    Error,
    /// Adds per-pass progress.
    Info,
    /// Adds every file the engine opens. Extremely verbose — hundreds of lines
    /// per compile — so it is opt-in rather than the default.
    Trace,
}

/// Which artifact the caller wants.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
pub enum OutputFormat {
    /// Run XeTeX, then xdvipdfmx to produce a PDF.
    #[default]
    Pdf,
    /// Stop after XeTeX and return the raw XDV. Useful for a custom backend, and
    /// noticeably faster when the PDF is not needed.
    Xdv,
}

/// Everything the caller can control about a compile.
///
/// Construct with [`CompileOptions::default`] and override what you need; the
/// defaults are chosen to match what a user would get from `tectonic main.tex`.
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(default, rename_all = "camelCase")]
pub struct CompileOptions {
    /// The file the engine starts from. Must already have been supplied via
    /// `add_file`.
    pub entry: String,

    /// Base name for generated artifacts (`<jobname>.pdf`, `.log`, `.synctex`).
    /// Defaults to `entry` with its extension removed.
    pub jobname: Option<String>,

    /// Stop after this many XeTeX passes even if the log still asks for a rerun.
    /// LaTeX normally converges in two or three; latexmk's own ceiling is five.
    pub max_passes: u8,

    /// Run at least this many passes regardless of what the log says. Raise it
    /// when a package writes an auxiliary file the rerun heuristics miss.
    pub min_passes: u8,

    /// Upgrade TeX errors to fatal errors. Off by default, matching `tectonic`:
    /// TeX recovers from most errors and still produces a usable PDF.
    pub halt_on_error: bool,

    /// Permit `\write18`. Always fails under WASM — there is no process to spawn
    /// — but it is exposed so the same options struct drives a native build.
    pub shell_escape: bool,

    /// Emit `<jobname>.synctex` for editor↔PDF position mapping.
    pub synctex: bool,

    /// XeTeX's "semantic pagination" mode, used by the HTML backend.
    pub semantic_pagination: bool,

    /// Run INITEX instead of typesetting: execute the entry file and dump the
    /// resulting engine state to `<jobname>.fmt`.
    ///
    /// This is how the preloaded LaTeX format in the bundle is produced. It has
    /// to be built by *this* engine — a format is a memory image, so one dumped
    /// by a different XeTeX build will not load — which is why the option lives
    /// here rather than the format being treated as an opaque input.
    ///
    /// A single pass is run and no PDF is produced, so `max_passes`,
    /// `output_format` and the xdvipdfmx options are all ignored.
    pub initex: bool,

    /// PDF or raw XDV.
    pub output_format: OutputFormat,

    /// Paper size passed to xdvipdfmx, e.g. `letter`, `a4`.
    pub paper: String,

    /// Compress PDF streams. Disable to inspect the PDF as text.
    pub compress_pdf: bool,

    /// Produce byte-identical output across runs: fixes the build date and uses
    /// deterministic PDF tags. Implies ignoring the system clock.
    pub deterministic: bool,

    /// Build timestamp as a Unix epoch second. Ignored unless set; when
    /// `deterministic` is on and this is `None`, the epoch is used.
    ///
    /// Typed as a TS `number` rather than the `bigint` ts-rs infers for `i64`:
    /// serde emits a plain JSON number, and `JSON.stringify` cannot serialize a
    /// `bigint` at all, so `bigint` would be actively wrong at the boundary.
    #[ts(type = "number | null")]
    pub build_date: Option<i64>,

    /// List `.aux`, `.toc`, `.out` and friends in `CompileResult::outputs`.
    ///
    /// Only affects reporting. They are always retained internally, because the
    /// next compile reads them to converge in fewer passes.
    pub keep_intermediates: bool,

    /// Keep `<jobname>.log`. On by default — the log is where diagnostics live.
    pub keep_logs: bool,

    /// Engine verbosity.
    pub log_level: LogLevel,
}

impl Default for CompileOptions {
    fn default() -> Self {
        Self {
            entry: "main.tex".to_owned(),
            jobname: None,
            max_passes: 4,
            min_passes: 1,
            halt_on_error: false,
            shell_escape: false,
            synctex: false,
            semantic_pagination: false,
            initex: false,
            output_format: OutputFormat::default(),
            paper: "letter".to_owned(),
            compress_pdf: true,
            deterministic: false,
            build_date: None,
            keep_intermediates: false,
            keep_logs: true,
            log_level: LogLevel::default(),
        }
    }
}

impl CompileOptions {
    /// The job name, derived from `entry` when not set explicitly.
    pub fn resolved_jobname(&self) -> &str {
        if let Some(name) = self.jobname.as_deref() {
            return name;
        }
        let base = self.entry.rsplit(['/', '\\']).next().unwrap_or(&self.entry);
        base.strip_suffix(".tex").unwrap_or(base)
    }

    /// Clamp nonsensical pass counts rather than rejecting them: a caller
    /// asking for zero passes wants "compile it", not an error.
    pub fn normalized(mut self) -> Self {
        self.max_passes = self.max_passes.clamp(1, 16);
        self.min_passes = self.min_passes.clamp(1, self.max_passes);
        self
    }
}

/// How a compile ended.
///
/// `Spotless`/`Warnings`/`Errors` mirror TeX's own notion of severity and all
/// mean the engine ran to completion. Only `Failed` means no output at all.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
pub enum CompileStatus {
    /// Ran with no warnings or errors.
    Spotless,
    /// Ran with warnings. Overwhelmingly the common case for real documents.
    Warnings,
    /// TeX reported errors but recovered; output is usually still usable.
    Errors,
    /// The engine could not produce output. See `message`.
    Failed,
}

/// Severity of a single parsed log message.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    /// A TeX or package error.
    Error,
    /// A TeX or package warning.
    Warning,
    /// Overfull/underfull boxes and similar typesetting notes.
    Info,
}

/// One diagnostic extracted from the TeX log.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    /// How serious it is.
    pub severity: Severity,
    /// Source file, when the log identifies one.
    pub file: Option<String>,
    /// 1-based line number, when the log identifies one.
    pub line: Option<u32>,
    /// The message, with TeX's line wrapping undone.
    pub message: String,
    /// Which package emitted it, e.g. `hyperref`.
    pub package: Option<String>,
}

/// What kind of artifact an output file is.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
pub enum OutputKind {
    /// The final PDF.
    Pdf,
    /// Raw XDV from XeTeX.
    Xdv,
    /// The TeX log.
    Log,
    /// SyncTeX position map.
    Synctex,
    /// `.aux`, `.toc`, `.out` — inputs to the next pass.
    Intermediate,
    /// A dumped TeX format, produced by an INITEX run.
    Format,
    /// Anything else the document wrote.
    Other,
}

impl OutputKind {
    /// Classify by file extension.
    pub fn classify(name: &str) -> Self {
        // Checked before the extension match because SyncTeX output may arrive
        // gzipped, as `<job>.synctex.gz`, where the extension alone says `gz`.
        if name.contains(".synctex") {
            return OutputKind::Synctex;
        }
        match name.rsplit('.').next() {
            Some("pdf") => OutputKind::Pdf,
            Some("xdv") => OutputKind::Xdv,
            Some("log") => OutputKind::Log,
            Some("fmt") => OutputKind::Format,
            Some("aux" | "toc" | "out" | "lof" | "lot" | "bbl" | "bcf" | "nav" | "snm") => {
                OutputKind::Intermediate
            }
            _ => OutputKind::Other,
        }
    }
}

/// Metadata for one produced file. Fetch the bytes with `get_output`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct OutputFile {
    /// File name as the engine wrote it.
    pub name: String,
    /// Size in bytes.
    pub size: usize,
    /// Classification.
    pub kind: OutputKind,
}

/// The outcome of a compile.
///
/// Note this carries no file *contents*: `outputs` lists what exists and how
/// big it is, and the caller pulls the bytes it wants out of linear memory.
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct CompileResult {
    /// Overall outcome.
    pub status: CompileStatus,
    /// How many XeTeX passes actually ran.
    pub passes_run: u8,
    /// Every file produced, with sizes.
    pub outputs: Vec<OutputFile>,
    /// Diagnostics parsed out of the log.
    pub diagnostics: Vec<Diagnostic>,
    /// Files the engine asked for that were not in the virtual filesystem.
    ///
    /// This is the hook for on-demand package fetching: supply these via
    /// `add_file` and compile again. It is deliberately a plain list rather than
    /// an error, because a missing file is usually recoverable.
    pub missing_files: Vec<String>,
    /// Human-readable explanation when `status` is `Failed`.
    pub message: Option<String>,
}

impl CompileResult {
    /// A failure that stopped the engine before it produced anything.
    pub fn failed(message: impl Into<String>, missing_files: Vec<String>) -> Self {
        Self {
            status: CompileStatus::Failed,
            passes_run: 0,
            outputs: Vec::new(),
            diagnostics: Vec::new(),
            missing_files,
            message: Some(message.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jobname_defaults_to_entry_without_extension() {
        let opts = CompileOptions {
            entry: "report.tex".to_owned(),
            ..Default::default()
        };
        assert_eq!(opts.resolved_jobname(), "report");
    }

    #[test]
    fn jobname_strips_directories() {
        let opts = CompileOptions {
            entry: "chapters/intro.tex".to_owned(),
            ..Default::default()
        };
        assert_eq!(opts.resolved_jobname(), "intro");
    }

    #[test]
    fn explicit_jobname_wins() {
        let opts = CompileOptions {
            entry: "main.tex".to_owned(),
            jobname: Some("custom".to_owned()),
            ..Default::default()
        };
        assert_eq!(opts.resolved_jobname(), "custom");
    }

    #[test]
    fn normalized_clamps_zero_passes_to_one() {
        let opts = CompileOptions {
            max_passes: 0,
            min_passes: 0,
            ..Default::default()
        }
        .normalized();
        assert_eq!(opts.max_passes, 1);
        assert_eq!(opts.min_passes, 1);
    }

    #[test]
    fn normalized_caps_min_passes_at_max() {
        let opts = CompileOptions {
            max_passes: 2,
            min_passes: 9,
            ..Default::default()
        }
        .normalized();
        assert_eq!(opts.min_passes, 2);
    }

    #[test]
    fn output_kind_classifies_synctex() {
        assert_eq!(OutputKind::classify("main.synctex"), OutputKind::Synctex);
    }

    #[test]
    fn output_kind_classifies_intermediates() {
        assert_eq!(OutputKind::classify("main.aux"), OutputKind::Intermediate);
    }

    #[test]
    fn options_round_trip_through_json() {
        let opts = CompileOptions::default();
        let json = serde_json::to_string(&opts).expect("serialize");
        let back: CompileOptions = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.entry, opts.entry);
        assert_eq!(back.max_passes, opts.max_passes);
    }

    #[test]
    fn partial_json_fills_in_defaults() {
        let back: CompileOptions =
            serde_json::from_str(r#"{"entry":"a.tex"}"#).expect("deserialize");
        assert_eq!(back.entry, "a.tex");
        assert_eq!(back.max_passes, 4);
    }
}
