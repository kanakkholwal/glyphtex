//! Entry point for the WebAssembly main module.
//!
//! The engine is a library; this exists only so the crate links as a *binary*.
//! See the note in `Cargo.toml`: a `cdylib` on this target becomes an
//! Emscripten side module, which requires every linked object to be
//! position-independent — including Emscripten's own non-PIC ICU and HarfBuzz
//! ports. A main module has no such requirement.
//!
//! `main` deliberately does nothing. The host drives everything through the
//! exported `glyphx_*` functions after instantiation; running `_start` merely
//! completes libc initialisation.

use std::ffi::c_void;

fn main() {}

/// Anchors the FFI entry points so the linker keeps them.
///
/// Nothing inside the module calls these — the JavaScript host is the only
/// caller — so Rust would otherwise not link the library objects that define
/// them at all, and `-sEXPORTED_FUNCTIONS` would fail with
/// `undefined exported symbol: "_glyphx_abi_version"`.
///
/// `#[used]` keeps the array itself from being dropped as dead code, and
/// naming each function in it forces its defining object to be linked in.
struct Anchors([*const c_void; 13]);

// SAFETY: the pointers are never dereferenced, and never read at all — this
// static exists solely so the linker retains the symbols it names. Raw pointers
// are not `Sync`, which a `static` requires, so the promise is made explicitly.
unsafe impl Sync for Anchors {}

#[used]
static KEEP_FFI_EXPORTS: Anchors = Anchors([
    glyphtex_tex::glyphx_abi_version as *const c_void,
    glyphtex_tex::glyphx_alloc as *const c_void,
    glyphtex_tex::glyphx_dealloc as *const c_void,
    glyphtex_tex::glyphx_add_file as *const c_void,
    glyphtex_tex::glyphx_remove_file as *const c_void,
    glyphtex_tex::glyphx_file_count as *const c_void,
    glyphtex_tex::glyphx_clear_files as *const c_void,
    glyphtex_tex::glyphx_clear_outputs as *const c_void,
    glyphtex_tex::glyphx_compile as *const c_void,
    glyphtex_tex::glyphx_result_ptr as *const c_void,
    glyphtex_tex::glyphx_result_len as *const c_void,
    glyphtex_tex::glyphx_output_len as *const c_void,
    glyphtex_tex::glyphx_output_copy as *const c_void,
]);
