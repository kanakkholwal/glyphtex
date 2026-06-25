//! LaTeX compilation via the Tectonic engine.
//!
//! Tectonic ships heavy native dependencies, so rather than linking the crate
//! (which needs vcpkg/harfbuzz/freetype/… on Windows) we drive the Tectonic
//! binary as a subprocess. The binary is resolved, in order, from:
//!   1. the `GLYPHX_TECTONIC_BIN` environment variable,
//!   2. a bundled sidecar next to the app executable, then
//!   3. `tectonic` on `PATH`.
//!
//! This keeps `cargo build` free of native-lib requirements while still giving
//! a real, offline LaTeX → PDF pipeline once the binary is available. (Tectonic
//! fetches its TeX bundle from the web on first run, then works fully offline.)

use std::path::PathBuf;
use std::process::Command;

use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;

use crate::subprocess::CommandExt as _;

#[derive(Serialize)]
pub struct CompileResult {
    /// Whether a PDF was produced.
    pub success: bool,
    /// The compiled PDF, base64-encoded (None on failure).
    pub pdf_base64: Option<String>,
    /// Tectonic's log / stderr output (warnings, errors).
    pub log: String,
    /// Human-readable message when something went wrong.
    pub message: Option<String>,
    /// Decompressed SyncTeX data (`.synctex.gz` contents) for reverse search.
    pub synctex: Option<String>,
    /// Plain-language, actionable hint for a recognized *engine* limitation
    /// (e.g. biber/biblatex version skew, 0-DPI JPEG) — surfaced above the raw
    /// log so the user gets "switch to System TeX" instead of a cryptic error.
    pub hint: Option<String>,
}

impl CompileResult {
    fn failure(message: impl Into<String>, log: impl Into<String>) -> Self {
        Self {
            success: false,
            pdf_base64: None,
            log: log.into(),
            message: Some(message.into()),
            synctex: None,
            hint: None,
        }
    }
}

/// Everything a compile needs from the app environment, resolved up front from
/// the `AppHandle` in the command layer. Holding it in a plain struct keeps the
/// actual compile (`run_engine` and below) `AppHandle`-free — so the engine
/// dispatch and result assembly are unit-testable and run cleanly inside
/// `spawn_blocking` (AGENTS.md §4 — thin commands, logic in testable functions).
struct EngineEnv {
    /// Resolved Tectonic binary (env override → managed → sidecar → PATH).
    tectonic_bin: PathBuf,
    /// App-managed Tectonic package cache, if available.
    cache_dir: Option<PathBuf>,
    /// fontconfig config file to point XeTeX at (Windows; `None` elsewhere).
    fontconfig: Option<PathBuf>,
}

impl EngineEnv {
    fn resolve(app: &tauri::AppHandle) -> Self {
        Self {
            tectonic_bin: find_tectonic(app),
            cache_dir: crate::engine::cache_dir(app),
            fontconfig: ensure_fontconfig(app),
        }
    }
}

/// Ensure a fontconfig config exists and return its path (Windows only).
///
/// Tectonic's XeTeX engine initializes fontconfig for font lookups; on Windows
/// there is no default config, which prints "Cannot load default config file"
/// and can destabilize font handling. We write a minimal config pointing at the
/// system fonts dir with a writable cache so initialization always succeeds.
#[cfg(windows)]
fn ensure_fontconfig(app: &tauri::AppHandle) -> Option<PathBuf> {
    use tauri::Manager;
    let base = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&base).ok()?;
    let cache = base.join("fontconfig-cache");
    std::fs::create_dir_all(&cache).ok()?;
    let conf = base.join("fonts.conf");
    if !conf.exists() {
        let xml = format!(
            "<?xml version=\"1.0\"?>\n<!DOCTYPE fontconfig SYSTEM \"fonts.dtd\">\n<fontconfig>\n  <dir>C:/Windows/Fonts</dir>\n  <cachedir>{}</cachedir>\n</fontconfig>\n",
            cache.to_string_lossy().replace('\\', "/")
        );
        std::fs::write(&conf, xml).ok()?;
    }
    Some(conf)
}

#[cfg(not(windows))]
fn ensure_fontconfig(_app: &tauri::AppHandle) -> Option<PathBuf> {
    None
}

/// Pre-download a set of common LaTeX packages into the cache so the first
/// offline compile works. Best-effort: returns the compile result of a small
/// document that pulls the packages in.
#[tauri::command]
pub async fn prefetch_packages(app: tauri::AppHandle) -> Result<CompileResult, String> {
    const WARM: &str = r"\documentclass{article}
\usepackage{amsmath,amssymb,graphicx,geometry,booktabs,enumitem,xcolor,titlesec,fancyhdr,tabularx,microtype,parskip,multicol,listings}
\usepackage[hidelinks]{hyperref}
\usepackage[english]{babel}
\begin{document}Warming the package cache.\end{document}";
    compile_latex(app, WARM.to_string(), Some(false), None, None).await
}

/// Read and gunzip `<stem>.synctex.gz` from the output dir, if present.
fn read_synctex(dir: &std::path::Path, stem: &str) -> Option<String> {
    let path = dir.join(format!("{stem}.synctex.gz"));
    let bytes = std::fs::read(path).ok()?;
    let mut decoder = flate2::read::GzDecoder::new(&bytes[..]);
    let mut text = String::new();
    use std::io::Read as _;
    decoder.read_to_string(&mut text).ok()?;
    Some(text)
}

const BIN_NAMES: [&str; 2] = ["tectonic.exe", "tectonic"];

/// Locate the Tectonic executable, in priority order:
///   1. `GLYPHX_TECTONIC_BIN`
///   2. an engine downloaded into the app-data dir (managed versions)
///   3. next to the app executable (bundled sidecar) or a `binaries/` dir in
///      any ancestor (covers `tauri dev`, where the exe is under target/debug)
///   4. `tectonic` on `PATH`
pub fn find_tectonic(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(custom) = std::env::var("GLYPHX_TECTONIC_BIN") {
        let pb = PathBuf::from(custom);
        if pb.exists() {
            return pb;
        }
    }

    if let Some(managed) = crate::engine::active_engine_path(app) {
        return managed;
    }

    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.parent();
        for _ in 0..7 {
            let Some(d) = dir else { break };
            for name in BIN_NAMES {
                let direct = d.join(name);
                if direct.exists() {
                    return direct;
                }
                let in_binaries = d.join("binaries").join(name);
                if in_binaries.exists() {
                    return in_binaries;
                }
            }
            dir = d.parent();
        }
    }

    // Fall back to PATH (e.g. installed via choco/scoop/apt).
    PathBuf::from("tectonic")
}

/// Run Tectonic on `main_tex`, writing build artifacts to `outdir`, and assemble
/// the result. Tectonic resolves `\input`, `\includegraphics`, `\bibliography`
/// etc. relative to the main file's own directory, so multi-file projects work
/// as long as `main_tex` lives in the project folder. The PDF / log / synctex
/// are named after the main file's stem (e.g. `report.tex` → `report.pdf`).
fn run_tectonic(
    env: &EngineEnv,
    main_tex: &std::path::Path,
    outdir: &std::path::Path,
    shell_escape: bool,
) -> CompileResult {
    let stem = main_tex
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "main".to_string());

    let bin = &env.tectonic_bin;
    let mut cmd = Command::new(bin);
    cmd.no_window();
    cmd.arg("--outdir")
        .arg(outdir)
        .arg("--keep-logs")
        .arg("--synctex")
        .arg("--chatter")
        .arg("minimal")
        // Keep compiling through recoverable TeX errors (undefined refs / macros,
        // bad boxes, …) and still emit a best-effort PDF — the Overleaf / latexmk
        // `nonstopmode` behaviour. Errors are surfaced in the log / Problems panel.
        .arg("-Z")
        .arg("continue-on-errors");
    // Shell escape (`\write18`) for packages like minted / gnuplot — opt-in
    // (it lets a document run system commands). Set the working dir to the main
    // file's folder so relative paths (e.g. for Pygments) resolve.
    if shell_escape {
        let cwd = main_tex.parent().unwrap_or(outdir);
        cmd.arg("-Z")
            .arg(format!("shell-escape-cwd={}", cwd.to_string_lossy()));
    }
    cmd.arg(main_tex);
    // Deterministic, app-managed package cache (so Settings can show/clear/warm it).
    if let Some(cache) = &env.cache_dir {
        cmd.env("TECTONIC_CACHE_DIR", cache);
    }
    // Give fontconfig a real config so XeTeX font lookups don't emit the
    // "Cannot load default config file" noise (Windows; harmless elsewhere).
    if let Some(conf) = &env.fontconfig {
        cmd.env("FONTCONFIG_FILE", conf);
    }

    let output = match cmd.output() {
        Ok(o) => o,
        Err(e) => {
            return CompileResult::failure(
                format!(
                    "Could not run Tectonic ({}). Install it (e.g. `choco install tectonic`) \
                     or set GLYPHX_TECTONIC_BIN. Underlying error: {e}",
                    bin.display()
                ),
                String::new(),
            );
        }
    };

    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    assemble_result(outdir, &stem, &stderr, &output.status, |tex_log_empty| {
        // No TeX log written ⇒ the engine itself crashed (rather than a normal
        // LaTeX error). Most often an OpenType icon font (e.g. fontawesome5) on
        // the stable engine — the nightly build fixes it.
        if tex_log_empty {
            format!(
                "The LaTeX engine exited unexpectedly (code {:?}) without producing a log — \
                 a package likely crashed it (often an icon font such as fontawesome5 on the \
                 stable engine). Try the Nightly engine, or switch to System TeX, in \
                 Settings → Engine.",
                output.status.code()
            )
        } else {
            "LaTeX compilation failed — no PDF was produced. See the Problems panel.".to_string()
        }
    })
}

/// Assemble a [`CompileResult`] from a finished engine run by reading the PDF,
/// TeX log and SyncTeX out of `outdir`. Shared by every engine.
///
/// We prefer emitting whatever PDF was produced: with `continue-on-errors`
/// (Tectonic) / `-f` (latexmk) the engine renders a best-effort PDF for
/// recoverable errors and still exits non-zero, so a present PDF means "show it"
/// — the errors live in the log and surface in the Problems panel, like Overleaf.
/// `no_pdf` builds the failure message when no PDF exists; it's told whether the
/// TeX log was empty (engine crashed before writing one).
fn assemble_result(
    outdir: &std::path::Path,
    stem: &str,
    stderr: &str,
    status: &std::process::ExitStatus,
    no_pdf: impl Fn(bool) -> String,
) -> CompileResult {
    // The TeX engine log (`<stem>.log`) carries the structured `! error` blocks,
    // `l.<n>` line numbers and `LaTeX Warning ... on input line <n>` that the
    // frontend parses. Combine it with the engine's concise stderr summary.
    let tex_log = std::fs::read_to_string(outdir.join(format!("{stem}.log"))).unwrap_or_default();
    let log = if tex_log.is_empty() {
        stderr.to_string()
    } else {
        format!("{}\n{}", stderr.trim_end(), tex_log)
    };

    let pdf_path = outdir.join(format!("{stem}.pdf"));
    if let Ok(bytes) = std::fs::read(&pdf_path) {
        if !status.success() {
            eprintln!(
                "[glyphx] compiled with errors (exit {:?}) — showing best-effort PDF",
                status.code()
            );
        }
        return CompileResult {
            success: true,
            pdf_base64: Some(general_purpose::STANDARD.encode(bytes)),
            log,
            message: None,
            synctex: read_synctex(outdir, stem),
            hint: None,
        };
    }

    // No PDF at all — a genuine failure. Mirror it to the dev terminal too.
    eprintln!(
        "[glyphx] LaTeX compilation failed (exit {:?}):\n{}",
        status.code(),
        if stderr.trim().is_empty() {
            tex_log.as_str()
        } else {
            stderr.trim()
        }
    );
    CompileResult::failure(no_pdf(tex_log.trim().is_empty()), log)
}

/// latexmk's engine-selection flag for a given TeX program.
fn latexmk_engine_flag(program: &str) -> &'static str {
    match program {
        "xelatex" => "-pdfxe",
        "lualatex" => "-pdflua",
        _ => "-pdf", // pdflatex
    }
}

/// Run a compile on `main_tex` via a local System TeX install, driven by
/// `latexmk` (which handles bibtex + the multi-pass rerun loop automatically).
/// `program` selects the engine: `pdflatex` (default), `xelatex`, or `lualatex`.
///
/// Unlike Tectonic (XeTeX-only), pdfLaTeX / LuaLaTeX use a different graphics
/// pipeline that tolerates images Tectonic rejects (e.g. JPEGs with 0-DPI
/// metadata → "Division by 0"), so this is the compatibility fallback.
fn run_latexmk(
    main_tex: &std::path::Path,
    outdir: &std::path::Path,
    program: &str,
    shell_escape: bool,
) -> CompileResult {
    let stem = main_tex
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "main".to_string());

    let mut cmd = Command::new("latexmk");
    cmd.no_window();
    cmd.arg(latexmk_engine_flag(program))
        // `-f` (force) keeps building through errors so we still get a
        // best-effort PDF; nonstopmode stops the engine from prompting.
        .arg("-f")
        .arg("-interaction=nonstopmode")
        .arg("-file-line-error")
        .arg("-synctex=1")
        .arg(format!("-outdir={}", outdir.to_string_lossy()));
    if shell_escape {
        cmd.arg("-shell-escape");
    }
    // Run inside the project folder so `\input`, `\includegraphics`,
    // `\bibliography` resolve relative to the main file.
    if let Some(parent) = main_tex.parent() {
        cmd.current_dir(parent);
    }
    cmd.arg(main_tex);

    let output = match cmd.output() {
        Ok(o) => o,
        Err(e) => {
            return CompileResult::failure(
                format!(
                    "Could not run latexmk — install a TeX distribution (TeX Live or MiKTeX) \
                     and make sure it's on your PATH, then pick the version in Settings → \
                     Engine. Underlying error: {e}"
                ),
                String::new(),
            );
        }
    };

    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    assemble_result(outdir, &stem, &stderr, &output.status, |_| {
        "System TeX compilation failed — no PDF was produced. See the Problems panel.".to_string()
    })
}

/// Map known *bundled-engine* (Tectonic) limitations in the compile log to a
/// plain-language, actionable hint, so the user sees "switch to System TeX"
/// instead of a cryptic biber / graphics error. Returns `None` when nothing
/// recognizable matched, or when System TeX was already the engine (the hint
/// would point at the engine they're already on).
fn detect_toolchain_hint(log: &str, engine: &str) -> Option<String> {
    // Every hint here is a limitation of the bundled Tectonic (its pinned
    // biblatex bundle, its XeTeX graphics driver) that the host's System TeX
    // install does not have — so there's nothing to suggest if we're on System.
    if engine == "system" {
        return None;
    }

    // biblatex/biber version skew: Tectonic's bundle ships an older biblatex than
    // a freshly installed biber expects, so the `.bcf` versions disagree and no
    // `.bbl` is produced — the bibliography silently fails to build.
    let biber_mismatch = (log.contains("Found biblatex control file version")
        && log.contains("expected version"))
        || (log.contains("biber") && log.contains("biblatex") && log.contains("incompatible"))
        || log.contains("not created by biblatex");
    if biber_mismatch {
        return Some(
            "This document's bibliography uses biblatex + biber, but the bundled \
             Tectonic engine ships an older biblatex that doesn't match your \
             system's biber, so the bibliography can't be built. Switch this \
             project to the System TeX engine in Settings → Engine to use a \
             matching biblatex and biber."
                .to_string(),
        );
    }

    // JPEGs whose metadata reports 0×0 DPI make XeTeX's graphics driver divide
    // by zero while computing the natural size.
    let jpeg_dpi = log.contains("Package graphics Error: Division by 0")
        || (log.contains("Unable to load picture or PDF file")
            && (log.contains(".jpg")
                || log.contains(".JPG")
                || log.contains(".jpeg")
                || log.contains(".JPEG")));
    if jpeg_dpi {
        return Some(
            "A JPEG in this document reports 0×0 DPI, which the bundled Tectonic \
             (XeTeX) engine can't scale (\"Division by 0\"). Re-save the image \
             with a valid resolution or convert it to PNG/PDF — or switch to the \
             System TeX engine in Settings → Engine, which tolerates it."
                .to_string(),
        );
    }

    None
}

/// Dispatch to the engine the frontend selected: bundled Tectonic, or a local
/// System TeX install via latexmk.
fn run_engine(
    env: &EngineEnv,
    main_tex: &std::path::Path,
    outdir: &std::path::Path,
    engine: &str,
    program: &str,
    shell_escape: bool,
) -> CompileResult {
    let mut result = if engine == "system" {
        run_latexmk(main_tex, outdir, program, shell_escape)
    } else {
        run_tectonic(env, main_tex, outdir, shell_escape)
    };
    // Recognize engine-specific failure modes and attach an actionable hint.
    result.hint = detect_toolchain_hint(&result.log, engine);
    result
}

/// What System TeX tooling is available on PATH (for Settings → Engine).
#[derive(Serialize)]
pub struct SystemTexInfo {
    pub latexmk: bool,
    pub pdflatex: bool,
    pub xelatex: bool,
    pub lualatex: bool,
    /// First line of `latexmk --version`, if present (e.g. the distro/version).
    pub version: Option<String>,
}

/// Probe a binary by running `<name> --version`; returns its first output line.
fn probe_bin(name: &str) -> Option<String> {
    let out = Command::new(name)
        .arg("--version")
        .no_window()
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    Some(stdout.lines().next().unwrap_or_default().trim().to_string())
}

/// Detect a local TeX installation so the UI can offer / gate System TeX.
/// Runs four `--version` probes (process spawns) on a blocking thread.
#[tauri::command]
pub async fn detect_system_tex() -> SystemTexInfo {
    tauri::async_runtime::spawn_blocking(|| {
        let version = probe_bin("latexmk");
        SystemTexInfo {
            latexmk: version.is_some(),
            pdflatex: probe_bin("pdflatex").is_some(),
            xelatex: probe_bin("xelatex").is_some(),
            lualatex: probe_bin("lualatex").is_some(),
            version,
        }
    })
    .await
    .unwrap_or(SystemTexInfo {
        latexmk: false,
        pdflatex: false,
        xelatex: false,
        lualatex: false,
        version: None,
    })
}

/// Compile a standalone LaTeX `source` string into a PDF (no project on disk).
/// Used for the in-memory scratch / sample document and the web fallback.
#[tauri::command]
pub async fn compile_latex(
    app: tauri::AppHandle,
    source: String,
    shell_escape: Option<bool>,
    engine: Option<String>,
    tex_program: Option<String>,
) -> Result<CompileResult, String> {
    // Resolve env from the AppHandle here, then run the (long, blocking) compile
    // off the event loop so it can't freeze the WKWebView or starve the runtime.
    let env = EngineEnv::resolve(&app);
    let engine = engine.unwrap_or_else(|| "tectonic".to_string());
    let program = tex_program.unwrap_or_else(|| "pdflatex".to_string());
    let shell_escape = shell_escape.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || -> Result<CompileResult, String> {
        let dir = tempfile::tempdir().map_err(|e| e.to_string())?;
        let tex_path = dir.path().join("main.tex");
        std::fs::write(&tex_path, &source).map_err(|e| e.to_string())?;
        Ok(run_engine(
            &env,
            &tex_path,
            dir.path(),
            &engine,
            &program,
            shell_escape,
        ))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Compile a multi-file project on disk. `root` is the project folder and `main`
/// is the main `.tex` file's path (relative to `root`, or absolute). Build
/// artifacts go to a throwaway temp dir so the project folder stays clean, while
/// Tectonic still resolves includes relative to the main file inside `root`.
#[tauri::command]
pub async fn compile_project(
    app: tauri::AppHandle,
    root: String,
    main: String,
    shell_escape: Option<bool>,
    engine: Option<String>,
    tex_program: Option<String>,
) -> Result<CompileResult, String> {
    let env = EngineEnv::resolve(&app);
    let engine = engine.unwrap_or_else(|| "tectonic".to_string());
    let program = tex_program.unwrap_or_else(|| "pdflatex".to_string());
    let shell_escape = shell_escape.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || -> Result<CompileResult, String> {
        let root = PathBuf::from(&root);
        let main_path = {
            let p = PathBuf::from(&main);
            if p.is_absolute() {
                p
            } else {
                root.join(&main)
            }
        };
        if !main_path.exists() {
            return Ok(CompileResult::failure(
                format!("Main file not found: {}", main_path.display()),
                String::new(),
            ));
        }
        let out = tempfile::tempdir().map_err(|e| e.to_string())?;
        Ok(run_engine(
            &env,
            &main_path,
            out.path(),
            &engine,
            &program,
            shell_escape,
        ))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn latexmk_flag_maps_each_program() {
        assert_eq!(latexmk_engine_flag("pdflatex"), "-pdf");
        assert_eq!(latexmk_engine_flag("xelatex"), "-pdfxe");
        assert_eq!(latexmk_engine_flag("lualatex"), "-pdflua");
        // Unknown / empty falls back to pdfLaTeX.
        assert_eq!(latexmk_engine_flag("something-else"), "-pdf");
        assert_eq!(latexmk_engine_flag(""), "-pdf");
    }

    #[test]
    fn hint_detects_biber_biblatex_mismatch() {
        let log = "INFO - This is Biber 2.21\n\
                   ERROR - Found biblatex control file version 3.8, expected version 3.11.\n\
                   error: report.tex:207: Package biblatex Error: File 'report.bbl' not created by biblatex.";
        let hint = detect_toolchain_hint(log, "tectonic").expect("should hint");
        assert!(hint.contains("System TeX"));
        assert!(hint.to_lowercase().contains("biblatex"));
    }

    #[test]
    fn hint_detects_zero_dpi_jpeg() {
        let log = "error: chapters/chapter2.tex:64: Unable to load picture or PDF file 'figimages/3DCNN.jpg'\n\
                   error: chapters/chapter2.tex:64: Package graphics Error: Division by 0.";
        let hint = detect_toolchain_hint(log, "tectonic").expect("should hint");
        assert!(hint.contains("System TeX"));
    }

    #[test]
    fn run_tectonic_reports_missing_binary() {
        // The compile path is now AppHandle-free: we can drive it with a hand-built
        // EngineEnv. A bogus binary must surface a plain "Could not run Tectonic"
        // failure (rather than panic), proving the seam is unit-testable.
        let env = EngineEnv {
            tectonic_bin: PathBuf::from("glyphx-no-such-tectonic-binary"),
            cache_dir: None,
            fontconfig: None,
        };
        let dir = tempfile::tempdir().unwrap();
        let tex = dir.path().join("main.tex");
        std::fs::write(
            &tex,
            r"\documentclass{article}\begin{document}x\end{document}",
        )
        .unwrap();
        let result = run_tectonic(&env, &tex, dir.path(), false);
        assert!(!result.success);
        assert!(result.message.unwrap().contains("Could not run Tectonic"));
    }

    #[test]
    fn hint_is_none_for_clean_log_and_for_system_engine() {
        assert!(detect_toolchain_hint("This is pdfTeX ... Output written.", "tectonic").is_none());
        // Same failure on System TeX → no point suggesting System TeX.
        let biber = "ERROR - Found biblatex control file version 3.8, expected version 3.11.";
        assert!(detect_toolchain_hint(biber, "system").is_none());
    }
}
