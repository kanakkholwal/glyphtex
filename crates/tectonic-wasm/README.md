# tectonic-wasm

[Tectonic](https://tectonic-typesetting.github.io/) TeX engine compiled to WebAssembly — **LaTeX → PDF in the browser**.

## Features

- **Full LaTeX support** — article, amsmath, hyperref, xcolor, mdframed, booktabs, etc.
- **Two-pass compilation** — automatic TOC, cross-references, bibliography
- **XeTeX + xdvipdfmx** — modern Unicode TeX with direct PDF output
- **474-file bundle** — common packages pre-bundled (11MB gzipped)
- **On-demand CDN fetch** — 134,980 additional packages available via Range requests
- **Memory-optimized** — `Rc<Vec<u8>>` for zero-copy file cloning between passes
- **512MB initial / 1GB max** — handles large documents with memory growth

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│  LaTeX src  │ ──→ │   XeTeX      │ ──→ │ xdvipdfmx  │ ──→ PDF
│  (UTF-8)    │     │ (pass 1 & 2) │     │ (XDV→PDF)  │
└─────────────┘     └──────────────┘     └────────────┘
                           │
               ┌───────────┴───────────┐
               │   MemoryIo Provider   │
               │  (Rc<Vec<u8>> files)  │
               └───────────────────────┘
```

## Build

### Prerequisites

- Rust with `wasm32-unknown-emscripten` target
- Emscripten SDK (emsdk)
- ~2GB disk space

### Quick Start

```bash
make all    # setup + deps + build + check
```

### Step by Step

```bash
make setup  # Install Rust, Emscripten, clone Tectonic
make deps   # Compile WASM dependencies (freetype, harfbuzz, ICU, etc.)
make build  # Build tectonic_wasm.wasm
make check  # Validate WASM output
```

### Output

- `output/tectonic_wasm.wasm` — 3.4MB WASM binary (120 exports)
- `output/tectonic-bundle.tar.gz` — 11MB pre-bundled TeX packages

## WASM API

```javascript
// Load WASM
const instance = await WebAssembly.instantiate(wasmBytes, imports)

// Add files from bundle
instance.exports.tectonic_add_file(namePtr, nameLen, dataPtr, dataLen)

// Set LaTeX input
instance.exports.tectonic_set_input(ptr, len)

// Compile (runs XeTeX twice + xdvipdfmx)
const code = instance.exports.tectonic_compile()  // 0 = success

// Get outputs
const size = instance.exports.tectonic_get_output_size(namePtr, nameLen)
instance.exports.tectonic_get_output(namePtr, nameLen, bufPtr, bufLen)

// List all outputs (newline-separated)
instance.exports.tectonic_list_outputs(bufPtr, bufLen)
```

## Exported Functions

| Function | Description |
|---|---|
| `tectonic_wasm_version()` | Returns API version (currently 7) |
| `tectonic_set_input(ptr, len)` | Set LaTeX source |
| `tectonic_add_file(name_ptr, name_len, data_ptr, data_len)` | Add a TeX file to the virtual filesystem |
| `tectonic_compile()` | Run XeTeX (2 passes) + xdvipdfmx → returns 0 on success |
| `tectonic_get_output_size(name_ptr, name_len)` | Get output file size |
| `tectonic_get_output(name_ptr, name_len, buf_ptr, buf_len)` | Copy output to buffer |
| `tectonic_list_outputs(buf_ptr, buf_len)` | List output filenames |
| `malloc(size)` / `free(ptr)` | Memory management |

## Dependencies (compiled to WASM)

| Library | Source | Purpose |
|---|---|---|
| Tectonic | submodule | TeX engine (XeTeX + xdvipdfmx) |
| FreeType | Emscripten port | Font rendering |
| HarfBuzz | Emscripten port | Text shaping |
| ICU | Emscripten port | Unicode support |
| libpng | Emscripten port | PNG image support |
| zlib | Emscripten port | Compression |
| Graphite2 | Built from source | Smart font rendering |
| Fontconfig | Stub with LM font map | Font discovery |

## Bundle Contents

The pre-built bundle includes 474 files:
- `latex.fmt` — pre-compiled LaTeX format (24MB)
- Document classes: `article.cls`, `report.cls`, `book.cls`
- Math: `amsmath.sty`, `amssymb.sty`, `amsthm.sty`
- Layout: `geometry.sty`, `mdframed.sty`
- Tables: `booktabs.sty`, `array.sty`, `longtable.sty`
- Colors: `xcolor.sty`
- Links: `hyperref.sty` + all dependencies
- Fonts: Latin Modern Roman (.otf, .tfm, .pfb, .enc)
- And 400+ more transitive dependencies

## License

- Tectonic: MIT
- This wrapper: MIT
