# TeX engine — backlog

State of the GlyphX TeX engine work, what is blocked, and what to do next.
Written 2026-07-21.

Related: [`scripts/build-wasm.sh`](scripts/build-wasm.sh) (canonical build, every
constraint documented inline), [`packages/tex-engine`](../../packages/tex-engine)
(TypeScript bindings), [`crates/glyphx-tex-api`](../glyphx-tex-api) (types + log
parsing, no C dependencies).

---

## Done

- Engine rewritten into modules: `io.rs` (VFS), `session.rs` (pass
  orchestration), `lib.rs` (FFI), with types and log parsing split into the
  dependency-free `glyphx-tex-api` crate.
- **Harmful font fallback removed.** It fuzzy-matched missing fonts by size digit
  (`cmsy5` → `cmsy10`) and returned a Type1 `.pfb` where TFM metrics were
  expected, which hung the engine on `booktabs` and produced a 15-byte PDF for
  `{\Large …}` — in both cases with no error. Missing files are now reported in
  `CompileResult.missingFiles`.
- Correctness: `static mut` → `thread_local`; `from_utf8_unchecked` → checked
  with error codes; unconditional `return 0` → real `CompileStatus`;
  existence-based rerun check → hash comparison of intermediates; per-open
  `Vec` clone (including the 21 MB format file, twice per compile) → zero-copy
  `SharedCursor`.
- Options exposed: entry, jobname, pass bounds, halt-on-error, SyncTeX, output
  format, paper size, deterministic builds, log level. `TexEngine::synctex`
  existed upstream and was simply never wired up.
- TypeScript types generated from the Rust definitions via `ts-rs`; CI fails if
  the committed output drifts.
- Git hygiene: 3.5 MB wasm untracked, CRLF footgun closed in two layers,
  binary attributes set.
- CI: fast API job, engine build with size reporting, e2e tests, tag-triggered
  npm publish with provenance + GitHub Release.
- Bundle manifest + verifier; root `pnpm engine:*` commands.

---

## Blocked

### 1. The wasm build does not link

**Retry this first** — the toolchains were pinned *after* the last attempt, and
pinning was the whole point.

```console
cd crates/tectonic-wasm && ./scripts/build-wasm.sh
```

Requires Linux (WSL works) with emsdk activated. Confirm the versions actually
in use are rustc 1.94 and emcc 5.0.2 — not whatever `latest` resolves to.

**The underlying conflict.** Newer rustc hardcodes `-fwasm-exceptions` in the
`wasm32-unknown-emscripten` target spec, selecting native wasm exception
handling. Emscripten's prebuilt ports (ICU is C++ and throws; libpng and
freetype use `setjmp`) are built for the JS-based scheme and emit `invoke_*`
trampolines. Linking the two fails with:

```
AssertionError: invoke_ functions exported but exceptions and longjmp are both disabled
```

Rebuilding the ports for wasm EH makes Emscripten emit *variant-suffixed*
libraries (`libfreetype-legacysjlj.a`), so plain `-lfreetype` stops resolving —
`resolve_lib()` in the build script discovers the real names, but prefers an
exact match, so a stale default-mode library in the sysroot wins. Run
`emcc --clear-cache` before retrying if the sysroot has mixed variants.

Things already ruled out, so nobody repeats them:

- `panic = "abort"` does **not** stop rustc passing `-fwasm-exceptions`.
- `-sRELOCATABLE` was **removed in Emscripten 6**, closing the side-module route.
- `-fPIC` on the vendored C fixes our objects but not Emscripten's ports.

**If the pinned pair still fails**, the fallback is to keep the committed
prebuilt `output/tectonic_wasm.wasm` as the shipped artifact and defer rebuilds.
That artifact is a fossil of an older toolchain, which is exactly the risk this
work exists to remove — but it does compile documents today.

### 2. Open question: main module vs cdylib

`Cargo.toml` was switched from `cdylib` to a `bin` target (a main module) to
escape the side-module PIC requirement, with `KEEP_FFI_EXPORTS` in `main.rs`
anchoring the entry points. On the *pinned* toolchain the original `cdylib` may
work unchanged. If it does, reverting is worth it — less machinery.

### 3. The host shim needs verifying against the real module

[`packages/tex-engine/src/imports.ts`](../../packages/tex-engine/src/imports.ts)
implements the 24 imports of the *prebuilt* wasm. A rebuild will almost
certainly differ — a main module and a side module do not import the same set,
and wasm EH removes `emscripten_longjmp` and the `invoke_*` trampolines
entirely. Diff the real import table before running the e2e tests:

```js
WebAssembly.Module.imports(await WebAssembly.compile(bytes))
```

### 4. Bundle is missing 8 files across 6 groups

```console
pnpm engine:bundle:verify
```

```
GAP  Core compiler   report.cls, book.cls
GAP  Math            mathtools.sty
GAP  Layout & links  cleveref.sty
GAP  Presentations   beamer.cls
GAP  Code            algorithm2e.sty
GAP  Typography      siunitx.sty, lmodern.sty
```

The installer UI offers these groups, so today it promises things the engine
cannot compile — the same class of silent false promise as the font fallback,
one layer up. Either fill the gaps or remove the groups; do not ship them
broken.

Filling them needs a TeX Live installation for `kpsewhich`, then:

```console
pnpm engine:bundle:extend && pnpm engine:bundle:verify
```

⚠️ `C:\texlive\2026\bin\windows` is on `PATH` but **does not exist** — a stale
entry, not an install.

`extend-bundle.mjs` resolves dependencies by scanning `\RequirePackage`,
`\usepackage`, `\LoadClass` and `\input`. That is approximate, because TeX's
real resolution is Turing-complete. The robust replacement, once the engine
links: compile a document, feed `result.missingFiles` back in, repeat until
empty. No guessing at all — and it doubles as the on-demand fetch path.

---

## Planned

- **On-demand package fetching.** `missingFiles` is the designed hook: fetch,
  `addFile`, recompile. Auxiliary files are retained across compiles, so the
  retry resumes rather than restarting.
- **Offline bundle format.** Packed archive + offset index, fetched once and
  mounted, so every lookup during a compile is a synchronous in-memory read.
  This matters because `kpse_find_file`-style lookups are synchronous C and OPFS
  handles can only be opened asynchronously — all asynchrony has to be resolved
  at load time.
- **Font closure gate.** Verify at build time that every `.map` entry's
  referenced `.pfb`/`.enc`/`.tfm` is present. pdfTeX has no graceful font
  degradation: a missing file is `pdftex_fail`, and a missing map entry falls
  through to the PK path, which is also fatal without Metafont.
- **SyncTeX wiring.** The engine emits it; the editor does not consume it yet.
- **Size budget in CI.** Currently reported, not enforced.

## Not achievable in WebAssembly

Each needs a subprocess. Say so in the UI rather than failing obscurely.

- **`minted`** — needs Python/Pygments. Use `listings` (pure TeX).
- **`biber`** — Perl, no wasm build exists. Note the current bundle ships **no
  bibtex binary either**, so citations do not work at all today; do not offer a
  bibliography group until that changes.
- **TikZ externalization** — needs shell escape.

`shellEscape` is exposed for parity with a native build and has no effect here.
