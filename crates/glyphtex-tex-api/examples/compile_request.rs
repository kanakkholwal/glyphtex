//! Build the JSON a host sends to the engine, and read back its result:
//! `cargo run --example compile_request`.
//!
//! The engine itself is the `glyphtex-engine` npm package; these are the exact types
//! that cross its WebAssembly boundary, so a Rust host or server speaks the same contract.

use glyphtex_tex_api::{CompileOptions, CompileResult, CompileStatus, OutputKind};

fn main() -> Result<(), serde_json::Error> {
    // Start from the defaults (what `tectonic main.tex` would do) and override fields.
    let options = CompileOptions {
        entry: "thesis.tex".to_owned(),
        synctex: true,
        paper: "a4".to_owned(),
        deterministic: true,
        ..CompileOptions::default()
    }
    .normalized();

    println!("jobname: {}", options.resolved_jobname());
    println!("request: {}", serde_json::to_string_pretty(&options)?);

    // Every field is optional on the wire: omitted ones take the defaults above.
    let partial: CompileOptions =
        serde_json::from_str(r#"{ "entry": "notes.tex", "maxPasses": 0 }"#)?;
    let partial = partial.normalized();
    println!(
        "partial request -> max passes clamped to {}",
        partial.max_passes
    );

    // What the engine answers, as JSON.
    let reply = r#"{
        "status": "warnings",
        "passesRun": 2,
        "outputs": [
            { "name": "thesis.pdf", "size": 48213, "kind": "pdf" },
            { "name": "thesis.log", "size": 9120, "kind": "log" },
            { "name": "thesis.synctex.gz", "size": 2048, "kind": "synctex" }
        ],
        "diagnostics": [
            { "severity": "warning", "file": "./thesis.tex", "line": 40,
              "message": "Citation `knuth' undefined.", "package": null }
        ],
        "missingFiles": [],
        "message": null
    }"#;
    let result: CompileResult = serde_json::from_str(reply)?;

    // `Failed` is the only status without output; `Errors` usually still has a PDF.
    if result.status == CompileStatus::Failed {
        eprintln!("no output: {:?}", result.message);
        return Ok(());
    }
    let pdf = result.outputs.iter().find(|o| o.kind == OutputKind::Pdf);
    println!(
        "{:?} after {} passes; pdf: {:?}; {} diagnostics",
        result.status,
        result.passes_run,
        pdf.map(|o| (&o.name, o.size)),
        result.diagnostics.len()
    );
    Ok(())
}
