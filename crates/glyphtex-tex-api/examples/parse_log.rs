//! Turn a TeX log into structured diagnostics: `cargo run --example parse_log [file.log]`.
//!
//! With no argument it parses a built-in sample, so it runs without a TeX install.

use glyphtex_tex_api::{parse_log, Severity};

const SAMPLE: &str = r"This is XeTeX, Version 3.141592653-2.6-0.999995 (TeX Live 2026)
(./main.tex
LaTeX2e <2026-06-01>
(/texmf/tex/latex/base/article.cls
Document Class: article 2025/01/22 v1.4n Standard LaTeX document class
)
! Undefined control sequence.
l.12 \includegraphics
                     {plot.png}
LaTeX Warning: Reference `fig:plot' on page 1 undefined on input line 20.

Overfull \hbox (79.26889pt too wide) in paragraph at lines 24--25
)
";

fn main() -> std::io::Result<()> {
    let log = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_owned(),
    };

    let diagnostics = parse_log(&log);
    for d in &diagnostics {
        let marker = match d.severity {
            Severity::Error => "error",
            Severity::Warning => "warning",
            Severity::Info => "info",
        };
        let place = match (&d.file, d.line) {
            (Some(file), Some(line)) => format!("{file}:{line}"),
            (Some(file), None) => file.clone(),
            _ => "?".to_owned(),
        };
        println!("{marker:<7} {place:<14} {}", d.message);
    }

    let errors = diagnostics
        .iter()
        .filter(|d| d.severity == Severity::Error)
        .count();
    println!("\n{} diagnostics, {errors} errors", diagnostics.len());
    Ok(())
}
