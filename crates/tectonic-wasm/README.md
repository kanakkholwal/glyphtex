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

- Linux (WSL works). The build does not run on Windows directly.
- Emscripten SDK (emsdk), activated
- Rust with the `wasm32-unknown-emscripten` target and `rust-src`
- ~2GB disk space

### Engine

```bash
make setup                 # Rust, Emscripten, submodules
make deps                  # WASM deps (freetype, harfbuzz, ICU, graphite2)
./scripts/build-wasm.sh    # the canonical build — every flag documented inline
```

`make build` delegates to that script. The link flags are subtle enough
(see BACKLOG "Solved #1") that a second copy would only ever drift.

### TeX bundle and format

Both are produced *by the engine itself* and need TeX Live on PATH:

```bash
pnpm engine:bundle:format <dir>                 # dump latex.fmt via INITEX
pnpm engine:bundle:build  <dir> --format <dir>  # converge against the fixtures
pnpm engine:bundle:pack   <dir>                 # -> output/tectonic-bundle.tar.gz
pnpm engine:bundle:verify <dir>                 # check against bundle-manifest.json
```

The format and the packages must come from the **same** TeX Live snapshot. A
format older than its packages does not fail as a missing file — it fails as
"LaTeX kernel too old", or as undefined macros deep inside a package.

### Everything at once

```bash
pnpm engine:all   # types, checks, build, sync, package, bundle:verify, tests
```

`engine:bundle:verify` is part of that aggregate because all nine manifest
groups are currently satisfied, so a regression should break the build. It was
deliberately excluded while the bundle still had known gaps: a command that is
permanently red trains people to ignore failures.

### Output

- `output/tectonic_wasm.wasm` — 3.36 MB (1.1 MB brotli), 13 `glyphx_*` exports
- `output/tectonic-bundle.tar.gz` — 8.6 MB gzipped, 395 files, 35.4 MB raw

## API

**Use [`@glyphx/tex-engine`](../../packages/tex-engine), not the raw exports.**
It owns the imports the module needs (including the longjmp trampolines), the
ABI check, and the JSON encoding below. The raw ABI is documented here because
it is the contract that package is written against, not because callers should
reimplement it.

```javascript
import { TexEngine } from '@glyphx/tex-engine';

const engine = await TexEngine.load(wasmBytes);
for (const [name, bytes] of bundleFiles) engine.addFile(name, bytes);
engine.addFile('main.tex', source);

const result = engine.compile({ entry: 'main.tex' });
if (result.status !== 'failed') console.log(engine.pdf());
```

### Raw ABI (version 2)

A JSON control plane over a raw linear-memory data plane: arguments and results
are JSON, file bytes are copied directly. `glyphx_compile` takes a JSON options
blob and leaves a JSON `CompileResult` in a buffer the host then reads via
`glyphx_result_ptr`/`glyphx_result_len`.

| Function | Description |
|---|---|
| `glyphx_abi_version()` | ABI version. The binding refuses to load on a mismatch. |
| `glyphx_alloc(len)` / `glyphx_dealloc(ptr, len)` | Buffers for host→module transfer |
| `glyphx_add_file(name_ptr, name_len, data_ptr, data_len)` | Add a file to the VFS |
| `glyphx_remove_file(name_ptr, name_len)` | Remove one file |
| `glyphx_file_count()` | Files currently in the VFS |
| `glyphx_clear_files()` / `glyphx_clear_outputs()` | Reset input / output state |
| `glyphx_compile(opts_ptr, opts_len)` | Run the pass driver; result is JSON |
| `glyphx_result_ptr()` / `glyphx_result_len()` | Where the last JSON result lives |
| `glyphx_output_len(...)` / `glyphx_output_copy(...)` | Size and copy an output file |

Every state-mutating call can return `-4` (`ERR_POISONED`). A compile that
aborts inside the engine tears down the wasm stack without unwinding Rust, so
the session lock is never released — the binding surfaces this as
`EnginePoisonedError`, and the caller must discard the instance and build a new
one. `apps/web/src/lib/tex/worker.ts` does exactly that, retrying once.

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

## Bundle contents

395 files, 35.4 MB raw / 8.6 MB gzipped, all from one TeX Live 2026 snapshot.
`latex.fmt` (21 MB) dominates it — that is a memory image of the engine, dumped
by this build in INITEX mode.

The nine groups in
[`bundle-manifest.json`](../../packages/tex-engine/bundle-manifest.json) are
each covered by a compiling document in `test/fixtures/groups.mjs`: core
classes, math, graphics & colour, tables, layout & links, diagrams & plots,
presentations, code & algorithms, typography.

⚠️ **The bundle contains what those fixtures need, and nothing else.** It is not
general LaTeX coverage — a document using an unlisted package fails on a missing
file, and there is no on-demand fallback yet (BACKLOG, "Planned"). The contents
are *discovered* by compiling the fixtures and feeding `result.missingFiles`
back in, not hand-listed, so widening coverage means widening the fixtures.

## License

- Tectonic: MIT
- This wrapper: MIT
