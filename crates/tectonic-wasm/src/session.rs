//! Compile orchestration: passes, convergence, and result assembly.

use std::cell::RefCell;
use std::collections::hash_map::DefaultHasher;
use std::collections::{BTreeSet, HashMap};
use std::hash::{Hash, Hasher};
use std::rc::Rc;
use std::time::{Duration, SystemTime};

use tectonic_bridge_core::{CoreBridgeLauncher, MinimalDriver};
use tectonic_engine_xdvipdfmx::XdvipdfmxEngine;
use tectonic_engine_xetex::{TexEngine, TexOutcome};
use tectonic_status_base::NoopStatusBackend;

use glyphtex_tex_api::api::{
    CompileOptions, CompileResult, CompileStatus, LogLevel, OutputFile, OutputFormat, OutputKind,
};
use glyphtex_tex_api::logparse;

use crate::io::MemoryIo;

/// Files whose contents decide whether another pass is needed. These are the
/// ones LaTeX writes on one pass and reads on the next.
const INTERMEDIATE_EXTENSIONS: &[&str] = &[
    "aux", "toc", "lof", "lot", "out", "bbl", "bcf", "nav", "snm", "idx", "glo",
];

/// Files produced by a compile, shared across passes so each one sees what the
/// last wrote.
type Outputs = Rc<RefCell<HashMap<String, Rc<Vec<u8>>>>>;

/// A compile session: holds the virtual filesystem across compiles so repeated
/// builds of the same project can reuse the previous run's auxiliary files.
#[derive(Default)]
pub struct Session {
    files: HashMap<String, Rc<Vec<u8>>>,
    last_outputs: HashMap<String, Rc<Vec<u8>>>,
}

impl Session {
    /// Create an empty session.
    pub fn new() -> Self {
        Self::default()
    }

    /// Add or replace a file in the virtual filesystem.
    pub fn add_file(&mut self, name: impl Into<String>, data: Vec<u8>) {
        self.files.insert(name.into(), Rc::new(data));
    }

    /// Remove a file. Returns whether it was present.
    pub fn remove_file(&mut self, name: &str) -> bool {
        self.files.remove(name).is_some()
    }

    /// Number of files currently loaded.
    pub fn file_count(&self) -> usize {
        self.files.len()
    }

    /// Drop every input file. The bundle usually stays put across compiles, so
    /// this is for switching projects entirely.
    pub fn clear_files(&mut self) {
        self.files.clear();
    }

    /// Discard auxiliary files from the previous compile, forcing the next one
    /// to start cold.
    pub fn clear_outputs(&mut self) {
        self.last_outputs.clear();
    }

    /// Fetch a file produced by the last compile.
    pub fn output(&self, name: &str) -> Option<Rc<Vec<u8>>> {
        self.last_outputs.get(name).map(Rc::clone)
    }

    /// Run a compile.
    ///
    /// Never panics, and reports "produced nothing" only via
    /// [`CompileStatus::Failed`] — TeX errors are recoverable and usually still
    /// yield a PDF.
    pub fn compile(&mut self, options: CompileOptions) -> CompileResult {
        let options = options.normalized();
        let jobname = options.resolved_jobname().to_owned();

        let Some(entry) = self.files.get(&options.entry).map(Rc::clone) else {
            return CompileResult::failed(
                format!(
                    "entry file `{}` was not added to the session ({} files loaded)",
                    options.entry,
                    self.files.len()
                ),
                vec![options.entry.clone()],
            );
        };

        // The entry document must also be readable under `<jobname>.tex`,
        // because that is the name TeX derives from the job it is given.
        let mut inputs = self.files.clone();
        inputs.insert(format!("{jobname}.tex"), Rc::clone(&entry));

        let run = Run {
            // Carry the previous compile's auxiliary files in so cross-references
            // can converge in one pass instead of two.
            outputs: Rc::new(RefCell::new(self.last_outputs.clone())),
            missing: Rc::new(RefCell::new(BTreeSet::new())),
            inputs: Rc::new(inputs),
            build_date: resolve_build_date(&options),
            jobname,
            entry,
            options,
        };

        let (result, kept) = run.execute();
        self.last_outputs = kept;
        result
    }
}

/// One compile, start to finish.
///
/// This exists so the pass loop, the PDF step and result assembly can share the
/// filesystem, options and job name without threading eight arguments through
/// each of them.
struct Run {
    options: CompileOptions,
    jobname: String,
    entry: Rc<Vec<u8>>,
    inputs: Rc<HashMap<String, Rc<Vec<u8>>>>,
    outputs: Outputs,
    missing: Rc<RefCell<BTreeSet<String>>>,
    build_date: SystemTime,
}

impl Run {
    fn trace(&self) -> bool {
        self.options.log_level == LogLevel::Trace
    }

    fn verbose(&self) -> bool {
        matches!(self.options.log_level, LogLevel::Info | LogLevel::Trace)
    }

    fn io(&self) -> MemoryIo {
        MemoryIo::new(
            Rc::clone(&self.inputs),
            Rc::clone(&self.outputs),
            Rc::clone(&self.missing),
            self.trace(),
        )
    }

    /// Drive XeTeX until the auxiliary files stop changing, then convert to PDF.
    fn execute(self) -> (CompileResult, HashMap<String, Rc<Vec<u8>>>) {
        if self.options.initex {
            return self.initex();
        }

        let mut passes_run = 0;
        let mut outcome = TexOutcome::Spotless;
        let mut prior = signature(&self.outputs.borrow());

        for pass in 1..=self.options.max_passes {
            if self.verbose() {
                eprintln!("[glyphtex] xetex pass {pass}/{}", self.options.max_passes);
            }

            passes_run = pass;
            match self.tex_pass() {
                Ok(o) => outcome = o,
                Err(message) => {
                    return self.finish(CompileStatus::Failed, passes_run, Some(message))
                }
            }

            let current = signature(&self.outputs.borrow());
            let converged = current == prior;
            prior = current;

            // Convergence is decided by whether the auxiliary files *changed*,
            // not by whether they exist. Checking existence — as an earlier
            // version did — always ran exactly two passes for any document with
            // a section, and never the third that a shifting table of contents
            // sometimes needs.
            if converged && pass >= self.options.min_passes {
                break;
            }
        }

        if self.options.output_format == OutputFormat::Pdf {
            if let Some(message) = self.xdvipdfmx() {
                return self.finish(CompileStatus::Failed, passes_run, Some(message));
            }
        }

        let status = match outcome {
            TexOutcome::Spotless => CompileStatus::Spotless,
            TexOutcome::Warnings => CompileStatus::Warnings,
            TexOutcome::Errors => CompileStatus::Errors,
        };
        self.finish(status, passes_run, None)
    }

    /// One INITEX run, dumping `<jobname>.fmt`.
    ///
    /// Deliberately not the normal loop: there is nothing to converge on, no
    /// XDV to convert, and rerunning would dump the format twice. A run that
    /// produces no `.fmt` is a failure even if XeTeX reports success, because
    /// the whole point of the call is that file.
    fn initex(self) -> (CompileResult, HashMap<String, Rc<Vec<u8>>>) {
        if let Err(message) = self.tex_pass() {
            return self.finish(CompileStatus::Failed, 1, Some(message));
        }

        let dump = format!("{}.fmt", self.jobname);
        if !self.outputs.borrow().contains_key(&dump) {
            return self.finish(
                CompileStatus::Failed,
                1,
                Some(format!(
                    "INITEX ran but wrote no `{dump}`. The entry file has to reach \\dump — \
                     a plain document will not, an .ini file will."
                )),
            );
        }

        self.finish(CompileStatus::Spotless, 1, None)
    }

    /// One XeTeX pass. Returns a message on failure.
    fn tex_pass(&self) -> Result<TexOutcome, String> {
        let mut io = self.io();
        io.set_primary(format!("{}.tex", self.jobname), Rc::clone(&self.entry));

        let mut driver = MinimalDriver::new(io);
        let mut status = NoopStatusBackend::default();
        let mut launcher = CoreBridgeLauncher::new(&mut driver, &mut status);

        let mut engine = TexEngine::default();
        engine
            .halt_on_error_mode(self.options.halt_on_error)
            .shell_escape(self.options.shell_escape)
            .synctex(self.options.synctex)
            .semantic_pagination(self.options.semantic_pagination)
            .initex_mode(self.options.initex)
            .build_date(self.build_date);

        let result = engine.process(&mut launcher, "latex", &self.jobname);

        // Output handles publish on drop, so the launcher has to go before the
        // caller inspects what this pass wrote.
        drop(launcher);
        drop(driver);

        result.map_err(|e| format!("XeTeX failed: {e}"))
    }

    /// Convert `<jobname>.xdv` to PDF. Returns a message on failure.
    fn xdvipdfmx(&self) -> Option<String> {
        let xdv = format!("{}.xdv", self.jobname);
        if !self.outputs.borrow().contains_key(&xdv) {
            return Some(format!(
                "XeTeX produced no `{xdv}`, so there is nothing to convert to PDF"
            ));
        }
        if self.verbose() {
            eprintln!("[glyphtex] xdvipdfmx");
        }

        let mut driver = MinimalDriver::new(self.io());
        let mut status = NoopStatusBackend::default();
        let mut launcher = CoreBridgeLauncher::new(&mut driver, &mut status);

        let mut engine = XdvipdfmxEngine::default();
        engine
            .enable_compression(self.options.compress_pdf)
            .enable_deterministic_tags(self.options.deterministic)
            .paper_spec(self.options.paper.clone())
            .build_date(self.build_date);

        let result = engine.process(&mut launcher, &xdv, &format!("{}.pdf", self.jobname));
        drop(launcher);
        drop(driver);

        result.err().map(|e| format!("xdvipdfmx failed: {e}"))
    }

    /// Assemble the result and hand back the outputs to retain for next time.
    fn finish(
        self,
        status: CompileStatus,
        passes_run: u8,
        message: Option<String>,
    ) -> (CompileResult, HashMap<String, Rc<Vec<u8>>>) {
        let produced = self.outputs.borrow().clone();

        let diagnostics = produced
            .get(&format!("{}.log", self.jobname))
            .map(|bytes| logparse::parse(&String::from_utf8_lossy(bytes)))
            .unwrap_or_default();

        // Intermediates are always retained regardless of `keep_intermediates`:
        // the next compile needs them to converge in fewer passes. That option
        // controls only whether they are *reported*.
        let kept: HashMap<String, Rc<Vec<u8>>> = produced
            .into_iter()
            .filter(|(name, _)| {
                self.options.keep_logs || OutputKind::classify(name) != OutputKind::Log
            })
            .collect();

        let mut outputs: Vec<OutputFile> = kept
            .iter()
            .filter(|(name, _)| {
                self.options.keep_intermediates
                    || OutputKind::classify(name) != OutputKind::Intermediate
            })
            .map(|(name, data)| OutputFile {
                name: name.clone(),
                size: data.len(),
                kind: OutputKind::classify(name),
            })
            .collect();
        outputs.sort_by(|a, b| a.name.cmp(&b.name));

        let result = CompileResult {
            status,
            passes_run,
            outputs,
            diagnostics,
            missing_files: self.missing.borrow().iter().cloned().collect(),
            message,
        };
        (result, kept)
    }
}

/// Hash the intermediate files that decide convergence.
///
/// Only names and contents matter, and `HashMap` iteration order does not, so
/// names are sorted first.
fn signature(outputs: &HashMap<String, Rc<Vec<u8>>>) -> u64 {
    let mut relevant: Vec<(&String, &Rc<Vec<u8>>)> = outputs
        .iter()
        .filter(|(name, _)| {
            name.rsplit('.')
                .next()
                .is_some_and(|ext| INTERMEDIATE_EXTENSIONS.contains(&ext))
        })
        .collect();
    relevant.sort_by(|a, b| a.0.cmp(b.0));

    let mut hasher = DefaultHasher::new();
    for (name, data) in relevant {
        name.hash(&mut hasher);
        data.hash(&mut hasher);
    }
    hasher.finish()
}

/// Pick the timestamp handed to the engines.
///
/// `deterministic` pins it to the epoch so repeated builds are byte-identical;
/// otherwise an explicit `build_date` wins, falling back to the system clock.
fn resolve_build_date(options: &CompileOptions) -> SystemTime {
    if let Some(secs) = options.build_date {
        return epoch_plus(secs);
    }
    if options.deterministic {
        return SystemTime::UNIX_EPOCH;
    }
    SystemTime::now()
}

fn epoch_plus(secs: i64) -> SystemTime {
    if secs >= 0 {
        SystemTime::UNIX_EPOCH + Duration::from_secs(secs as u64)
    } else {
        SystemTime::UNIX_EPOCH - Duration::from_secs(secs.unsigned_abs())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn outputs_with(entries: &[(&str, &[u8])]) -> HashMap<String, Rc<Vec<u8>>> {
        entries
            .iter()
            .map(|(k, v)| ((*k).to_owned(), Rc::new(v.to_vec())))
            .collect()
    }

    #[test]
    fn signature_ignores_non_intermediate_files() {
        let a = outputs_with(&[("main.aux", b"x"), ("main.pdf", b"one")]);
        let b = outputs_with(&[("main.aux", b"x"), ("main.pdf", b"different")]);
        assert_eq!(signature(&a), signature(&b));
    }

    #[test]
    fn signature_changes_when_an_aux_file_changes() {
        let a = outputs_with(&[("main.aux", b"first")]);
        let b = outputs_with(&[("main.aux", b"second")]);
        assert_ne!(signature(&a), signature(&b));
    }

    #[test]
    fn signature_is_stable_regardless_of_insertion_order() {
        let a = outputs_with(&[("main.aux", b"x"), ("main.toc", b"y")]);
        let b = outputs_with(&[("main.toc", b"y"), ("main.aux", b"x")]);
        assert_eq!(signature(&a), signature(&b));
    }

    #[test]
    fn signature_detects_a_new_intermediate_appearing() {
        let a = outputs_with(&[("main.aux", b"x")]);
        let b = outputs_with(&[("main.aux", b"x"), ("main.toc", b"y")]);
        assert_ne!(signature(&a), signature(&b));
    }

    #[test]
    fn deterministic_pins_the_build_date_to_the_epoch() {
        let opts = CompileOptions {
            deterministic: true,
            ..Default::default()
        };
        assert_eq!(resolve_build_date(&opts), SystemTime::UNIX_EPOCH);
    }

    #[test]
    fn explicit_build_date_overrides_deterministic_default() {
        let opts = CompileOptions {
            deterministic: true,
            build_date: Some(86_400),
            ..Default::default()
        };
        assert_eq!(
            resolve_build_date(&opts),
            SystemTime::UNIX_EPOCH + Duration::from_secs(86_400)
        );
    }

    #[test]
    fn compile_fails_cleanly_when_entry_is_absent() {
        let mut session = Session::new();
        let result = session.compile(CompileOptions {
            entry: "nope.tex".to_owned(),
            ..Default::default()
        });
        assert_eq!(result.status, CompileStatus::Failed);
        assert!(result.missing_files.contains(&"nope.tex".to_owned()));
    }

    #[test]
    fn add_and_remove_file_track_count() {
        let mut session = Session::new();
        session.add_file("a.tex", b"x".to_vec());
        assert_eq!(session.file_count(), 1);
        assert!(session.remove_file("a.tex"));
        assert_eq!(session.file_count(), 0);
    }
}
