//! The virtual filesystem the engine reads and writes through.
//!
//! Tectonic routes *all* file access through [`IoProvider`] — the vendored C
//! never calls `fopen` — so this module is the entire filesystem as far as
//! XeTeX and xdvipdfmx are concerned. That is what makes a browser build
//! possible at all.

use std::cell::RefCell;
use std::collections::{BTreeSet, HashMap};
use std::io::{Read, Seek, SeekFrom, Write};
use std::rc::Rc;

use tectonic_errors::Result;
use tectonic_io_base::{InputFeatures, InputHandle, InputOrigin, IoProvider, OpenResult, OutputHandle};
use tectonic_status_base::StatusBackend;

/// A reader over shared bytes.
///
/// The obvious implementation is `Cursor<Vec<u8>>`, but that requires owning the
/// data, so every `input_open` would copy the whole file — including the ~21 MB
/// format file, on every pass. This reads directly out of the shared `Rc`
/// instead, so opening a file costs a refcount bump.
struct SharedCursor {
    data: Rc<Vec<u8>>,
    pos: usize,
}

impl SharedCursor {
    fn new(data: Rc<Vec<u8>>) -> Self {
        Self { data, pos: 0 }
    }
}

impl Read for SharedCursor {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let start = self.pos.min(self.data.len());
        let remaining = &self.data[start..];
        let n = remaining.len().min(buf.len());
        buf[..n].copy_from_slice(&remaining[..n]);
        self.pos = start + n;
        Ok(n)
    }
}

impl Seek for SharedCursor {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        let len = self.data.len() as i64;
        let target = match pos {
            SeekFrom::Start(n) => n as i64,
            SeekFrom::End(n) => len + n,
            SeekFrom::Current(n) => self.pos as i64 + n,
        };
        if target < 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "seek before start of file",
            ));
        }
        // Seeking past the end is legal and yields EOF on the next read.
        self.pos = target as usize;
        Ok(self.pos as u64)
    }
}

impl InputFeatures for SharedCursor {
    fn get_size(&mut self) -> Result<usize> {
        Ok(self.data.len())
    }

    fn get_unix_mtime(&mut self) -> Result<Option<i64>> {
        Ok(None)
    }

    fn try_seek(&mut self, pos: SeekFrom) -> Result<u64> {
        Ok(self.seek(pos)?)
    }
}

/// Accumulates one output file, publishing it on drop.
///
/// Tectonic signals "this output is complete" by dropping the handle, so the
/// write-back has to happen in `Drop` rather than at an explicit close.
struct CaptureWriter {
    name: String,
    buffer: Vec<u8>,
    sink: Rc<RefCell<HashMap<String, Rc<Vec<u8>>>>>,
}

impl Write for CaptureWriter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.buffer.extend_from_slice(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl Drop for CaptureWriter {
    fn drop(&mut self) {
        let data = std::mem::take(&mut self.buffer);
        // Publish even when empty: the engine truncating a file to nothing is
        // meaningful, and swallowing it would leave a stale copy from an
        // earlier pass visible to the next one.
        self.sink
            .borrow_mut()
            .insert(std::mem::take(&mut self.name), Rc::new(data));
    }
}

/// An in-memory filesystem for one compile session.
///
/// Inputs are the caller-supplied bundle and project files. Outputs accumulate
/// as the engine writes, and are visible as *inputs* to subsequent passes —
/// that is how `.aux` and `.toc` carry cross-references forward.
pub struct MemoryIo {
    inputs: Rc<HashMap<String, Rc<Vec<u8>>>>,
    outputs: Rc<RefCell<HashMap<String, Rc<Vec<u8>>>>>,
    missing: Rc<RefCell<BTreeSet<String>>>,
    primary: Option<Rc<Vec<u8>>>,
    primary_name: String,
    trace: bool,
}

impl MemoryIo {
    /// Build a filesystem view over shared input files.
    ///
    /// `outputs` and `missing` are shared with the caller so they survive the
    /// provider being dropped between passes.
    pub fn new(
        inputs: Rc<HashMap<String, Rc<Vec<u8>>>>,
        outputs: Rc<RefCell<HashMap<String, Rc<Vec<u8>>>>>,
        missing: Rc<RefCell<BTreeSet<String>>>,
        trace: bool,
    ) -> Self {
        Self {
            inputs,
            outputs,
            missing,
            primary: None,
            primary_name: "texput.tex".to_owned(),
            trace,
        }
    }

    /// Set the document the engine starts from.
    pub fn set_primary(&mut self, name: impl Into<String>, data: Rc<Vec<u8>>) {
        self.primary_name = name.into();
        self.primary = Some(data);
    }

    /// Look a name up in outputs first, then inputs.
    ///
    /// Output-before-input is required for multi-pass compilation: pass two must
    /// read the `.aux` that pass one wrote, not the stale one from the bundle.
    fn lookup(&self, name: &str) -> Option<Rc<Vec<u8>>> {
        if let Some(data) = self.outputs.borrow().get(name) {
            return Some(Rc::clone(data));
        }
        self.inputs.get(name).map(Rc::clone)
    }

    fn open_shared(&self, name: &str, data: Rc<Vec<u8>>) -> OpenResult<InputHandle> {
        if self.trace {
            eprintln!("[io] open {} ({} bytes)", name, data.len());
        }
        OpenResult::Ok(InputHandle::new(
            name,
            SharedCursor::new(data),
            InputOrigin::Other,
        ))
    }
}

impl IoProvider for MemoryIo {
    fn output_open_name(&mut self, name: &str) -> OpenResult<OutputHandle> {
        OpenResult::Ok(OutputHandle::new(
            name,
            CaptureWriter {
                name: name.to_owned(),
                buffer: Vec::new(),
                sink: Rc::clone(&self.outputs),
            },
        ))
    }

    fn output_open_stdout(&mut self) -> OpenResult<OutputHandle> {
        OpenResult::Ok(OutputHandle::new(
            "stdout",
            CaptureWriter {
                name: "stdout".to_owned(),
                buffer: Vec::new(),
                sink: Rc::clone(&self.outputs),
            },
        ))
    }

    fn input_open_name(
        &mut self,
        name: &str,
        _status: &mut dyn StatusBackend,
    ) -> OpenResult<InputHandle> {
        match self.lookup(name) {
            Some(data) => self.open_shared(name, data),
            None => {
                // Record and report honestly.
                //
                // The previous implementation fuzzy-matched missing fonts by
                // size digit (cmsy5 -> cmsy10) and returned a Type1 .pfb where
                // TFM metrics were expected. XeTeX either spun forever or
                // emitted an empty page, with no error either way. TeX has no
                // graceful font degradation: a wrong file is strictly worse
                // than an absent one, because absence is recoverable — the
                // caller can supply the file and compile again.
                self.missing.borrow_mut().insert(name.to_owned());
                if self.trace {
                    eprintln!("[io] MISSING {name}");
                }
                OpenResult::NotAvailable
            }
        }
    }

    fn input_open_primary(&mut self, _status: &mut dyn StatusBackend) -> OpenResult<InputHandle> {
        match &self.primary {
            Some(data) => {
                let data = Rc::clone(data);
                let name = self.primary_name.clone();
                self.open_shared(&name, data)
            }
            None => OpenResult::NotAvailable,
        }
    }

    fn input_open_format(
        &mut self,
        name: &str,
        status: &mut dyn StatusBackend,
    ) -> OpenResult<InputHandle> {
        // XeTeX asks for a format by bare name; bundles store it under a few
        // different conventions depending on how they were built.
        for candidate in [name, &format!("{name}.fmt"), "latex.fmt"] {
            if let Some(data) = self.lookup(candidate) {
                return self.open_shared(candidate, data);
            }
        }
        self.input_open_name(name, status)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cursor(bytes: &[u8]) -> SharedCursor {
        SharedCursor::new(Rc::new(bytes.to_vec()))
    }

    #[test]
    fn shared_cursor_reads_all_bytes() {
        let mut c = cursor(b"hello");
        let mut out = Vec::new();
        c.read_to_end(&mut out).expect("read");
        assert_eq!(out, b"hello");
    }

    #[test]
    fn shared_cursor_reports_size() {
        let mut c = cursor(b"hello");
        assert_eq!(c.get_size().expect("size"), 5);
    }

    #[test]
    fn shared_cursor_seeks_from_end() {
        let mut c = cursor(b"hello");
        c.seek(SeekFrom::End(-2)).expect("seek");
        let mut out = Vec::new();
        c.read_to_end(&mut out).expect("read");
        assert_eq!(out, b"lo");
    }

    #[test]
    fn shared_cursor_rejects_seek_before_start() {
        let mut c = cursor(b"hello");
        assert!(c.seek(SeekFrom::Current(-1)).is_err());
    }

    #[test]
    fn shared_cursor_past_end_reads_nothing() {
        let mut c = cursor(b"hello");
        c.seek(SeekFrom::Start(99)).expect("seek");
        let mut out = Vec::new();
        c.read_to_end(&mut out).expect("read");
        assert!(out.is_empty());
    }

    fn provider(files: &[(&str, &[u8])]) -> MemoryIo {
        let inputs: HashMap<_, _> = files
            .iter()
            .map(|(k, v)| ((*k).to_owned(), Rc::new(v.to_vec())))
            .collect();
        MemoryIo::new(
            Rc::new(inputs),
            Rc::new(RefCell::new(HashMap::new())),
            Rc::new(RefCell::new(BTreeSet::new())),
            false,
        )
    }

    #[test]
    fn missing_input_is_recorded_not_substituted() {
        let mut io = provider(&[("cmsy10.pfb", b"real")]);
        let mut status = tectonic_status_base::NoopStatusBackend::default();
        // The old fuzzy fallback would have served cmsy10.pfb for this.
        assert!(matches!(
            io.input_open_name("cmsy5", &mut status),
            OpenResult::NotAvailable
        ));
        assert!(io.missing.borrow().contains("cmsy5"));
    }

    #[test]
    fn outputs_shadow_inputs_for_the_next_pass() {
        let io = provider(&[("main.aux", b"stale")]);
        io.outputs
            .borrow_mut()
            .insert("main.aux".to_owned(), Rc::new(b"fresh".to_vec()));
        assert_eq!(io.lookup("main.aux").expect("found").as_slice(), b"fresh");
    }
}
