//! GlyphX TeX engine — Tectonic (XeTeX + xdvipdfmx) compiled to WebAssembly.
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
//! glyphx_alloc(n)                        -> write bytes into linear memory
//! glyphx_add_file(name, data)            -> repeat per project/bundle file
//! glyphx_compile(options_json)           -> 0 on completion
//! glyphx_result_ptr() / _len()           -> read the JSON CompileResult
//! glyphx_output_len() / _copy()          -> pull out the PDF bytes
//! ```
//!
//! `glyphx_compile` returning 0 means *the call completed*, not that the
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

/// The typed API surface, shared with the pure-Rust `glyphx-tex-api` crate that
/// also generates the TypeScript declarations.
pub use glyphx_tex_api::api;
pub use glyphx_tex_api::{
    CompileOptions, CompileResult, CompileStatus, Diagnostic, LogLevel, OutputFile, OutputFormat,
    OutputKind, Severity,
};
pub use session::Session;

use std::alloc::{alloc, dealloc, Layout};
use std::cell::RefCell;

/// ABI version. Bump on any breaking change to the exported functions or to the
/// JSON shapes in [`api`]; callers should check it before anything else.
pub const ABI_VERSION: u32 = 1;

/// Argument pointers were null, or lengths were implausible.
const ERR_BAD_POINTER: i32 = -1;
/// A name or JSON argument was not valid UTF-8.
const ERR_BAD_UTF8: i32 = -2;
/// The options JSON did not parse.
const ERR_BAD_JSON: i32 = -3;

thread_local! {
    static SESSION: RefCell<Session> = RefCell::new(Session::new());
    /// JSON for the most recent compile, held so the caller can read it back
    /// without us leaking an allocation on every call.
    static LAST_RESULT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    /// Bytes staged by the most recent [`glyphx_output_len`] call.
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
pub extern "C" fn glyphx_abi_version() -> u32 {
    ABI_VERSION
}

/// Allocate `len` bytes for the caller to write into.
///
/// Pair every call with [`glyphx_dealloc`] using the same length. Returns null
/// if `len` is zero or the allocation fails.
#[no_mangle]
pub extern "C" fn glyphx_alloc(len: usize) -> *mut u8 {
    if len == 0 {
        return std::ptr::null_mut();
    }
    let Ok(layout) = Layout::from_size_align(len, 1) else {
        return std::ptr::null_mut();
    };
    // SAFETY: layout has a non-zero size, checked above.
    unsafe { alloc(layout) }
}

/// Release memory obtained from [`glyphx_alloc`].
///
/// # Safety
/// `ptr` must come from [`glyphx_alloc`] with the same `len`, and must not have
/// been freed already.
#[no_mangle]
pub unsafe extern "C" fn glyphx_dealloc(ptr: *mut u8, len: usize) {
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
pub unsafe extern "C" fn glyphx_add_file(
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
    SESSION.with_borrow_mut(|s| s.add_file(name, data.to_vec()));
    0
}

/// Remove a file. Returns 1 if it existed, 0 if not, or a negative error code.
///
/// # Safety
/// `name_ptr` must be valid for reads of `name_len` bytes.
#[no_mangle]
pub unsafe extern "C" fn glyphx_remove_file(name_ptr: *const u8, name_len: usize) -> i32 {
    // SAFETY: delegated to the caller.
    let Some(bytes) = (unsafe { slice_from(name_ptr, name_len) }) else {
        return ERR_BAD_POINTER;
    };
    let Ok(name) = std::str::from_utf8(bytes) else {
        return ERR_BAD_UTF8;
    };
    i32::from(SESSION.with_borrow_mut(|s| s.remove_file(name)))
}

/// Number of files currently in the virtual filesystem.
#[no_mangle]
pub extern "C" fn glyphx_file_count() -> usize {
    SESSION.with_borrow(|s| s.file_count())
}

/// Drop every input file.
#[no_mangle]
pub extern "C" fn glyphx_clear_files() {
    SESSION.with_borrow_mut(|s| s.clear_files());
}

/// Discard auxiliary files from the previous compile, forcing a cold build.
#[no_mangle]
pub extern "C" fn glyphx_clear_outputs() {
    SESSION.with_borrow_mut(|s| s.clear_outputs());
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
pub unsafe extern "C" fn glyphx_compile(options_ptr: *const u8, options_len: usize) -> i32 {
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

    let result = SESSION.with_borrow_mut(|s| s.compile(options));
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

/// Pointer to the JSON result of the last [`glyphx_compile`].
///
/// Valid until the next call to `glyphx_compile`.
#[no_mangle]
pub extern "C" fn glyphx_result_ptr() -> *const u8 {
    LAST_RESULT.with_borrow(|r| r.as_ptr())
}

/// Length in bytes of the JSON result of the last [`glyphx_compile`].
#[no_mangle]
pub extern "C" fn glyphx_result_len() -> usize {
    LAST_RESULT.with_borrow(|r| r.len())
}

/// Stage an output file and return its size, or -1 if there is no such file.
///
/// Staging copies the bytes once so a subsequent [`glyphx_output_copy`] cannot
/// observe a different file; call the two in sequence.
///
/// # Safety
/// `name_ptr` must be valid for reads of `name_len` bytes.
#[no_mangle]
pub unsafe extern "C" fn glyphx_output_len(name_ptr: *const u8, name_len: usize) -> isize {
    // SAFETY: delegated to the caller.
    let Some(bytes) = (unsafe { slice_from(name_ptr, name_len) }) else {
        return -1;
    };
    let Ok(name) = std::str::from_utf8(bytes) else {
        return -1;
    };
    match SESSION.with_borrow(|s| s.output(name)) {
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

/// Copy the file staged by [`glyphx_output_len`] into `buf`.
///
/// Returns the number of bytes written, which is `min(staged, buf_len)`.
///
/// # Safety
/// `buf` must be valid for writes of `buf_len` bytes.
#[no_mangle]
pub unsafe extern "C" fn glyphx_output_copy(buf: *mut u8, buf_len: usize) -> isize {
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
        unsafe { glyphx_add_file(name.as_ptr(), name.len(), data.as_ptr(), data.len()) }
    }

    #[test]
    fn abi_version_is_exposed() {
        assert_eq!(glyphx_abi_version(), ABI_VERSION);
    }

    #[test]
    fn alloc_of_zero_returns_null() {
        assert!(glyphx_alloc(0).is_null());
    }

    #[test]
    fn alloc_then_dealloc_round_trips() {
        let p = glyphx_alloc(64);
        assert!(!p.is_null());
        // SAFETY: p came from glyphx_alloc with this length.
        unsafe { glyphx_dealloc(p, 64) };
    }

    #[test]
    fn add_file_rejects_invalid_utf8_names() {
        let bad = [0xff_u8, 0xfe];
        // SAFETY: pointers derive from live slices.
        let rc = unsafe { glyphx_add_file(bad.as_ptr(), bad.len(), b"x".as_ptr(), 1) };
        assert_eq!(rc, ERR_BAD_UTF8);
    }

    #[test]
    fn add_file_rejects_null_pointers() {
        // SAFETY: deliberately passing null with a non-zero length.
        let rc = unsafe { glyphx_add_file(std::ptr::null(), 4, b"x".as_ptr(), 1) };
        assert_eq!(rc, ERR_BAD_POINTER);
    }

    #[test]
    fn added_file_can_be_removed() {
        glyphx_clear_files();
        assert_eq!(add("a.tex", b"hello"), 0);
        // SAFETY: pointer derives from a live slice.
        let removed = unsafe { glyphx_remove_file("a.tex".as_ptr(), 5) };
        assert_eq!(removed, 1);
    }

    #[test]
    fn removing_an_absent_file_reports_zero() {
        glyphx_clear_files();
        // SAFETY: pointer derives from a live slice.
        let removed = unsafe { glyphx_remove_file("ghost.tex".as_ptr(), 9) };
        assert_eq!(removed, 0);
    }

    #[test]
    fn compile_with_malformed_json_reports_bad_json() {
        let bad = b"{not json";
        // SAFETY: pointer derives from a live slice.
        let rc = unsafe { glyphx_compile(bad.as_ptr(), bad.len()) };
        assert_eq!(rc, ERR_BAD_JSON);
    }

    #[test]
    fn output_len_of_absent_file_is_negative_one() {
        // SAFETY: pointer derives from a live slice.
        let n = unsafe { glyphx_output_len("nope.pdf".as_ptr(), 8) };
        assert_eq!(n, -1);
    }
}
