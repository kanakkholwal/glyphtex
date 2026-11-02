//! Fail a CI job on LaTeX errors: `cargo run --example check_log -- main.log [--github]`.
//!
//! Prints `file:line: severity: message`, or GitHub Actions annotations with `--github`,
//! and exits 1 if the log has any errors.

use glyphtex_tex_api::{parse_log, Severity};
use std::process::ExitCode;

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1);
    let Some(path) = args.next() else {
        eprintln!("usage: check_log <file.log> [--github]");
        return ExitCode::from(2);
    };
    let github = args.any(|a| a == "--github");
    let log = match std::fs::read_to_string(&path) {
        Ok(log) => log,
        Err(error) => {
            eprintln!("cannot read {path}: {error}");
            return ExitCode::from(2);
        }
    };

    let mut errors = 0;
    for d in parse_log(&log) {
        let level = match d.severity {
            Severity::Error => {
                errors += 1;
                "error"
            }
            Severity::Warning => "warning",
            Severity::Info => continue, // box warnings are noise in CI
        };
        let file = d.file.as_deref().unwrap_or("main.tex");
        let line = d.line.unwrap_or(1);
        if github {
            // https://docs.github.com/actions/reference/workflow-commands-for-github-actions
            println!("::{level} file={file},line={line}::{}", d.message);
        } else {
            println!("{file}:{line}: {level}: {}", d.message);
        }
    }

    if errors > 0 {
        eprintln!("{errors} LaTeX error(s)");
        ExitCode::FAILURE
    } else {
        ExitCode::SUCCESS
    }
}
