//! GlyphTeX TeX engine — Tectonic (XeTeX + xdvipdfmx) compiled to WebAssembly.
//!
//! # Boundary design
//!
//! The ABI splits into a *control plane* and a *data plane*:
//!
//! - **Control plane** — options in, results out — travels as JSON. It is small,
//!   crosses once per compile, and gets its TypeScript types generated from the
//!   Rust definitions in [`api`], so the two can never drift.
//! - **Data plane** — LaTeX sources in, PDF out — travels as raw bytes in linear
//!   memory. Base64-ing a multi-megabyte PDF through JSON would cost more than
//!   the entire compile.
//!
//! # Calling sequence
//!
//! ```text
//! glyphtex_alloc(n)                        -> write bytes into linear memory
//! glyphtex_add_file(name, data)            -> repeat per project/bundle file
//! glyphtex_compile(options_json)           -> 0 on completion
//! glyphtex_result_ptr() / _len()           -> read the JSON CompileResult
//! glyphtex_output_len() / _copy()          -> pull out the PDF bytes
//! ```
//!
//! `glyphtex_compile` returning 0 means *the call completed*, not that the
//! document built — read `status` in the result for that. Only a negative
//! return indicates the arguments themselves were unusable.
//!
//! # Concurrency
//!
//! Tectonic serialises all engine runs behind a global lock, and WebAssembly
//! here is single-threaded, so the session is a single thread-local rather than
//! a handle table.

#![deny(missing_docs)]

mod io;
mod session;

/// The typed API surface, shared with the pure-Rust `glyphtex-tex-api` crate that
/// also generates the TypeScript declarations.
pub use glyphtex_tex_api::api;
pub use glyphtex_tex_api::{
    CompileOptions, CompileResult, CompileStatus, Diagnostic, LogLevel, OutputFile, OutputFormat,
    OutputKind, Severity,
};
pub use session::Session;

use std::alloc::{alloc, dealloc, Layout};
use std::cell::RefCell;

/// ABI version. Bump on any breaking change to the exported functions or to the
/// JSON shapes in [`api`]; callers should check it before anything else.
pub const ABI_VERSION: u32 = 2;

/// Argument pointers were null, or lengths were implausible.
const ERR_BAD_POINTER: i32 = -1;
/// A name or JSON argument was not valid UTF-8.
const ERR_BAD_UTF8: i32 = -2;
/// The options JSON did not parse.
const ERR_BAD_JSON: i32 = -3;
/// The session is still borrowed from an earlier call that never returned.
///
/// This means a previous `glyphtex_compile` trapped rather than returning: the
/// wasm stack was torn down without unwinding Rust, so the `RefCell` guard was
/// never dropped. Every later call would otherwise panic on the borrow, and
/// under `panic = "abort"` a panic is a trap — so one bad document would brick
/// the instance for good.
///
/// Reporting it instead lets the host do the only thing that actually works:
/// discard this instance and load a fresh one.
const ERR_POISONED: i32 = -4;

thread_local! {
    static SESSION: RefCell<Session> = RefCell::new(Session::new());
}

/// Borrow the session mutably, or `None` if a previous call left it borrowed.
///
/// `try_borrow_mut`, never `borrow_mut`: the panicking form aborts under
/// `panic = "abort"`, turning a recoverable "this instance is spent" into a
/// trap that takes the whole module with it. See [`ERR_POISONED`].
fn with_session_mut<R>(f: impl FnOnce(&mut Session) -> R) -> Option<R> {
    SESSION.with(|cell| cell.try_borrow_mut().ok().map(|mut s| f(&mut s)))
}

/// Borrow the session for reading, or `None` if it is poisoned.
fn with_session<R>(f: impl FnOnce(&Session) -> R) -> Option<R> {
    SESSION.with(|cell| cell.try_borrow().ok().map(|s| f(&s)))
}

thread_local! {
    /// JSON for the most recent compile, held so the caller can read it back
    /// without us leaking an allocation on every call.
    static LAST_RESULT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    /// Bytes staged by the most recent [`glyphtex_output_len`] call.
    static STAGED_OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

/// Reconstruct a byte slice from a caller-provided pointer and length.
///
/// # Safety
/// `ptr` must be valid for reads of `len` bytes, or `len` must be zero.
unsafe fn slice_from<'a>(ptr: *const u8, len: usize) -> Option<&'a [u8]> {
    if len == 0 {
        return Some(&[]);
    }
    if ptr.is_null() {
        return None;
    }
    Some(unsafe { std::slice::from_raw_parts(ptr, len) })
}

/// The ABI version this module implements.
#[no_mangle]
pub extern "C" fn glyphtex_abi_version() -> u32 {
    ABI_VERSION
}

/// Allocate `len` bytes for the caller to write into.
///
/// Pair every call with [`glyphtex_dealloc`] using the same length. Returns null
/// if `len` is zero or the allocation fails.
#[no_mangle]
pub extern "C" fn glyphtex_alloc(len: usize) -> *mut u8 {
    if len == 0 {
        return std::ptr::null_mut();
    }
    let Ok(layout) = Layout::from_size_align(len, 1) else {
        return std::ptr::null_mut();
    };
    // SAFETY: layout has a non-zero size, checked above.
    unsafe { alloc(layout) }
}

/// Release memory obtained from [`glyphtex_alloc`].
///
/// # Safety
/// `ptr` must come from [`glyphtex_alloc`] with the same `len`, and must not have
/// been freed already.
#[no_mangle]
pub unsafe extern "C" fn glyphtex_dealloc(ptr: *mut u8, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }
    if let Ok(layout) = Layout::from_size_align(len, 1) {
        // SAFETY: delegated to the caller by this function's contract.
        unsafe { dealloc(ptr, layout) }
    }
}

/// Add or replace a file in the virtual filesystem.
///
/// Returns 0 on success, or a negative error code.
///
/// # Safety
/// Both pointers must be valid for reads of their stated lengths.
#[no_mangle]
pub unsafe extern "C" fn glyphtex_add_file(
    name_ptr: *const u8,
    name_len: usize,
    data_ptr: *const u8,
    data_len: usize,
) -> i32 {
    // SAFETY: delegated to the caller.
    let (Some(name_bytes), Some(data)) =
        (unsafe { slice_from(name_ptr, name_len) }, unsafe {
            slice_from(data_ptr, data_len)
        })
    else {
        return ERR_BAD_POINTER;
    };
    let Ok(name) = std::str::from_utf8(name_bytes) else {
        return ERR_BAD_UTF8;
    };
    match with_session_mut(|s| s.add_file(name, data.to_vec())) {
        Some(()) => 0,
        None => ERR_POISONED,
    }
}

/// Remove a file. Returns 1 if it existed, 0 if not, or a negative error code.
///
/// # Safety
/// `name_ptr` must be valid for reads of `name_len` bytes.
#[no_mangle]
pub unsafe extern "C" fn glyphtex_remove_file(name_ptr: *const u8, name_len: usize) -> i32 {
    // SAFETY: delegated to the caller.
    let Some(bytes) = (unsafe { slice_from(name_ptr, name_len) }) else {
        return ERR_BAD_POINTER;
    };
    let Ok(name) = std::str::from_utf8(bytes) else {
        return ERR_BAD_UTF8;
    };
    match with_session_mut(|s| s.remove_file(name)) {
        Some(existed) => i32::from(existed),
        None => ERR_POISONED,
    }
}

/// Number of files currently in the virtual filesystem.
#[no_mangle]
pub extern "C" fn glyphtex_file_count() -> i32 {
    match with_session(|s| s.file_count()) {
        Some(n) => i32::try_from(n).unwrap_or(i32::MAX),
        None => ERR_POISONED,
    }
}

/// Drop every input file.
#[no_mangle]
pub extern "C" fn glyphtex_clear_files() -> i32 {
    match with_session_mut(|s| s.clear_files()) {
        Some(()) => 0,
        None => ERR_POISONED,
    }
}

/// Discard auxiliary files from the previous compile, forcing a cold build.
#[no_mangle]
pub extern "C" fn glyphtex_clear_outputs() -> i32 {
    match with_session_mut(|s| s.clear_outputs()) {
        Some(()) => 0,
        None => ERR_POISONED,
    }
}

/// Compile the document described by `options_json` (a JSON `CompileOptions`;
/// pass length 0 for defaults).
///
/// Returns 0 once the call completes — including when the document failed to
/// build. Inspect `status` in the JSON result for the outcome. Negative values
/// mean the arguments could not be used at all.
///
/// # Safety
/// `options_ptr` must be valid for reads of `options_len` bytes.
#[no_mangle]
pub unsafe extern "C" fn glyphtex_compile(options_ptr: *const u8, options_len: usize) -> i32 {
    // SAFETY: delegated to the caller.
    let Some(bytes) = (unsafe { slice_from(options_ptr, options_len) }) else {
        return ERR_BAD_POINTER;
    };

    let options = if bytes.is_empty() {
        CompileOptions::default()
    } else {
        let Ok(text) = std::str::from_utf8(bytes) else {
            return ERR_BAD_UTF8;
        };
        match serde_json::from_str(text) {
            Ok(o) => o,
            Err(e) => {
                store_result(&CompileResult::failed(
                    format!("could not parse options JSON: {e}"),
                    Vec::new(),
                ));
                return ERR_BAD_JSON;
            }
        }
    };

    let Some(result) = with_session_mut(|s| s.compile(options)) else {
        return ERR_POISONED;
    };
    store_result(&result);
    0
}

fn store_result(result: &CompileResult) {
    // Serialising our own types cannot fail; fall back rather than panic across
    // the FFI boundary if it somehow does.
    let json = serde_json::to_vec(result).unwrap_or_else(|_| {
        br#"{"status":"failed","passesRun":0,"outputs":[],"diagnostics":[],"missingFiles":[],"message":"result serialization failed"}"#.to_vec()
    });
    LAST_RESULT.with_borrow_mut(|slot| *slot = json);
}

/// Pointer to the JSON result of the last [`glyphtex_compile`].
///
/// Valid until the next call to `glyphtex_compile`.
#[no_mangle]
pub extern "C" fn glyphtex_result_ptr() -> *const u8 {
    LAST_RESULT.with_borrow(|r| r.as_ptr())
}

/// Length in bytes of the JSON result of the last [`glyphtex_compile`].
#[no_mangle]
pub extern "C" fn glyphtex_result_len() -> usize {
    LAST_RESULT.with_borrow(|r| r.len())
}

/// Stage an output file and return its size, or -1 if there is no such file.
///
/// Staging copies the bytes once so a subsequent [`glyphtex_output_copy`] cannot
/// observe a different file; call the two in sequence.
///
/// # Safety
/// `name_ptr` must be valid for reads of `name_len` bytes.
#[no_mangle]
pub unsafe extern "C" fn glyphtex_output_len(name_ptr: *const u8, name_len: usize) -> isize {
    // SAFETY: delegated to the caller.
    let Some(bytes) = (unsafe { slice_from(name_ptr, name_len) }) else {
        return -1;
    };
    let Ok(name) = std::str::from_utf8(bytes) else {
        return -1;
    };
    match with_session(|s| s.output(name)).flatten() {
        Some(data) => {
            let len = data.len();
            STAGED_OUTPUT.with_borrow_mut(|slot| *slot = data.as_ref().clone());
            len as isize
        }
        None => {
            STAGED_OUTPUT.with_borrow_mut(Vec::clear);
            -1
        }
    }
}

/// Copy the file staged by [`glyphtex_output_len`] into `buf`.
///
/// Returns the number of bytes written, which is `min(staged, buf_len)`.
///
/// # Safety
/// `buf` must be valid for writes of `buf_len` bytes.
#[no_mangle]
pub unsafe extern "C" fn glyphtex_output_copy(buf: *mut u8, buf_len: usize) -> isize {
    if buf.is_null() && buf_len != 0 {
        return -1;
    }
    STAGED_OUTPUT.with_borrow(|data| {
        let n = data.len().min(buf_len);
        if n > 0 {
            // SAFETY: `buf` is valid for `buf_len` >= n bytes by contract, and
            // the staged buffer is a distinct allocation, so no overlap.
            unsafe { std::ptr::copy_nonoverlapping(data.as_ptr(), buf, n) };
        }
        n as isize
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn add(name: &str, data: &[u8]) -> i32 {
        // SAFETY: pointers derive from live slices.
        unsafe { glyphtex_add_file(name.as_ptr(), name.len(), data.as_ptr(), data.len()) }
    }

    #[test]
    fn abi_version_is_exposed() {
        assert_eq!(glyphtex_abi_version(), ABI_VERSION);
    }

    #[test]
    fn alloc_of_zero_returns_null() {
        assert!(glyphtex_alloc(0).is_null());
    }

    #[test]
    fn alloc_then_dealloc_round_trips() {
        let p = glyphtex_alloc(64);
        assert!(!p.is_null());
        // SAFETY: p came from glyphtex_alloc with this length.
        unsafe { glyphtex_dealloc(p, 64) };
    }

    #[test]
    fn add_file_rejects_invalid_utf8_names() {
        let bad = [0xff_u8, 0xfe];
        // SAFETY: pointers derive from live slices.
        let rc = unsafe { glyphtex_add_file(bad.as_ptr(), bad.len(), b"x".as_ptr(), 1) };
        assert_eq!(rc, ERR_BAD_UTF8);
    }

    #[test]
    fn add_file_rejects_null_pointers() {
        // SAFETY: deliberately passing null with a non-zero length.
        let rc = unsafe { glyphtex_add_file(std::ptr::null(), 4, b"x".as_ptr(), 1) };
        assert_eq!(rc, ERR_BAD_POINTER);
    }

    #[test]
    fn added_file_can_be_removed() {
        glyphtex_clear_files();
        assert_eq!(add("a.tex", b"hello"), 0);
        // SAFETY: pointer derives from a live slice.
        let removed = unsafe { glyphtex_remove_file("a.tex".as_ptr(), 5) };
        assert_eq!(removed, 1);
    }

    #[test]
    fn removing_an_absent_file_reports_zero() {
        glyphtex_clear_files();
        // SAFETY: pointer derives from a live slice.
        let removed = unsafe { glyphtex_remove_file("ghost.tex".as_ptr(), 9) };
        assert_eq!(removed, 0);
    }

    #[test]
    fn compile_with_malformed_json_reports_bad_json() {
        let bad = b"{not json";
        // SAFETY: pointer derives from a live slice.
        let rc = unsafe { glyphtex_compile(bad.as_ptr(), bad.len()) };
        assert_eq!(rc, ERR_BAD_JSON);
    }

    #[test]
    fn output_len_of_absent_file_is_negative_one() {
        // SAFETY: pointer derives from a live slice.
        let n = unsafe { glyphtex_output_len("nope.pdf".as_ptr(), 8) };
        assert_eq!(n, -1);
    }
}
