---
title: "glyphtex-tex-api examples: TeX log checks in CI and engine requests"
description: "Working glyphtex-tex-api examples in Rust: fail CI on LaTeX errors, emit GitHub Actions annotations from a TeX log, and build and read GlyphTeX engine requests with serde."
category: "glyphtex-tex-api (Rust)"
order: 12
updated: "2026-11-03"
faq:
  - q: "How do I fail a CI build on LaTeX errors?"
    a: "Run your TeX build, then parse the .log with glyphtex-tex-api's parse_log and exit with a non-zero code if any diagnostic has Severity::Error. The check_log example on this page does it in about 40 lines."
---

:::takeaways
- All three examples ship in the crate: `cargo run --example <name>`.
- `parse_log` works on logs from any TeX engine, not only GlyphTeX's.
- The engine types round-trip through `serde_json` with camelCase names.
:::

## Fail CI on LaTeX errors

Prints `file:line: severity: message` for each error and warning, and exits 1 if there are errors. With `--github` it prints [GitHub Actions annotations](https://docs.github.com/actions/reference/workflow-commands-for-github-actions), which show up inline on the pull request.

```rust
use glyphtex_tex_api::{parse_log, Severity};
use std::process::ExitCode;

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1);
    let Some(path) = args.next() else {
        eprintln!("usage: check_log <file.log> [--github]");
        return ExitCode::from(2);
    };
    let github = args.any(|a| a == "--github");
    let Ok(log) = std::fs::read_to_string(&path) else {
        eprintln!("cannot read {path}");
        return ExitCode::from(2);
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
            println!("::{level} file={file},line={line}::{}", d.message);
        } else {
            println!("{file}:{line}: {level}: {}", d.message);
        }
    }

    if errors > 0 { ExitCode::FAILURE } else { ExitCode::SUCCESS }
}
```

For a log with an undefined command in an included chapter and a missing citation:

```console
$ cargo run --example check_log -- main.log
chapters/intro.tex:7: error: Undefined control sequence.
main.tex:30: warning: Citation `knuth' on page 2 undefined on input line 30.

$ cargo run --example check_log -- main.log --github
::error file=chapters/intro.tex,line=7::Undefined control sequence.
::warning file=main.tex,line=30::Citation `knuth' on page 2 undefined on input line 30.
```

In a workflow, after the LaTeX build:

```yaml
- run: latexmk -pdf main.tex || true
- run: cargo run --example check_log -- main.log --github
```

## Print every diagnostic in a log

The `parse_log` example takes a log file, or uses a built-in sample when given none:

```console
$ cargo run --example parse_log
error   main.tex:12    Undefined control sequence.
warning main.tex:20    Reference `fig:plot' on page 1 undefined on input line 20.
info    main.tex:24    Overfull \hbox (79.26889pt too wide) in paragraph at lines 24--25

3 diagnostics, 1 errors
```

## Build a request and read a result

The exact JSON the GlyphTeX engine accepts and returns:

```rust
use glyphtex_tex_api::{CompileOptions, CompileResult, CompileStatus, OutputKind};

fn main() -> Result<(), serde_json::Error> {
    let options = CompileOptions {
        entry: "thesis.tex".to_owned(),
        synctex: true,
        paper: "a4".to_owned(),
        deterministic: true,
        ..CompileOptions::default()
    }
    .normalized();
    println!("{}", serde_json::to_string_pretty(&options)?);

    // Missing fields take their defaults, and nonsense pass counts are clamped.
    let partial: CompileOptions =
        serde_json::from_str(r#"{ "entry": "notes.tex", "maxPasses": 0 }"#)?;
    assert_eq!(partial.normalized().max_passes, 1);

    let reply = r#"{
        "status": "warnings", "passesRun": 2, "missingFiles": [], "message": null,
        "outputs": [{ "name": "thesis.pdf", "size": 48213, "kind": "pdf" }],
        "diagnostics": [{ "severity": "warning", "file": "thesis.tex", "line": 40,
                          "message": "Citation `knuth' undefined.", "package": null }]
    }"#;
    let result: CompileResult = serde_json::from_str(reply)?;
    if result.status != CompileStatus::Failed {
        let pdf = result.outputs.iter().find(|o| o.kind == OutputKind::Pdf);
        println!("{:?} after {} passes: {:?}", result.status, result.passes_run, pdf);
    }
    Ok(())
}
```

The serialised request:

```json
{
  "entry": "thesis.tex",
  "jobname": null,
  "maxPasses": 4,
  "minPasses": 1,
  "haltOnError": false,
  "shellEscape": false,
  "synctex": true,
  "semanticPagination": false,
  "initex": false,
  "outputFormat": "pdf",
  "paper": "a4",
  "compressPdf": true,
  "deterministic": true,
  "buildDate": null,
  "keepIntermediates": false,
  "keepLogs": true,
  "logLevel": "error"
}
```

## See also

- [glyphtex-tex-api guide](../glyphtex-tex-api) · [API reference](./api)
- [glyphtex-engine examples](../glyphtex-engine/examples), compiling with these types in JavaScript
