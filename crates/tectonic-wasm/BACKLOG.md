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

## Solved 2026-07-21

### 1. The wasm build links, and the engine compiles documents

```console
cd crates/tectonic-wasm && ./scripts/build-wasm.sh
```

3.36 MB (1.1 MB brotli), 13 `glyphx_*` exports, 24 imports, e2e suite 10/10.
Requires Linux (WSL works) with emsdk activated.

**Pinning was not the fix.** The previous version of this document said to retry
with pinned toolchains because "pinning was the whole point". That was wrong and
it cost hours. Emscripten ships HarfBuzz and ICU built **only** with the JS
exception scheme — a probe compiled with `-fwasm-exceptions` produces no wasm-EH
variant of either, at any SDK version — while rustc defaults to wasm EH here. No
combination of versions reconciles that.

Three flags fix it, and the first two are useless apart:

- `-Zemscripten-wasm-eh=no` — stops rustc selecting wasm EH. Needs
  `RUSTC_BOOTSTRAP=1`; it is unstable.
- `-Zbuild-std=std,panic_abort` — the precompiled `libstd` was built for wasm EH
  and references `__cpp_exception`. Without rebuilding it, the link fails on that
  symbol instead.
- `-sSTANDALONE_WASM=1` — otherwise `-O3` minifies exports to `J`, `K`, `L`… and
  collapses imports to module `a`, because emcc assumes you will use its JS glue.
  Standalone mode emits real names and WASI imports, which is what the hand-
  written shim expects.

Also ruled out, so nobody repeats them:

- `panic = "abort"` alone does **not** stop rustc passing `-fwasm-exceptions`.
- `-sWASM_EXCEPTIONS` and `-sMINIFY_WASM_IMPORTS_AND_EXPORTS` are **internal**
  settings; emcc rejects both from the command line.
- `-sRELOCATABLE` was **removed in Emscripten 6**, closing the side-module route.
- `-fPIC` on the vendored C fixes our objects but not Emscripten's ports.

### 2. Open question: main module vs cdylib

`Cargo.toml` was switched from `cdylib` to a `bin` target (a main module) to
escape the side-module PIC requirement, with `KEEP_FFI_EXPORTS` in `main.rs`
anchoring the entry points. On the *pinned* toolchain the original `cdylib` may
work unchanged. If it does, reverting is worth it — less machinery.

### 3. Host shim verified against the real module ✅

[`packages/tex-engine/src/imports.ts`](../../packages/tex-engine/src/imports.ts)
matches the rebuilt module: 24 imports, 11 `wasi_snapshot_preview1` + 13 `env`.
Because the build stays on the JS exception scheme, `invoke_*` and the longjmp
import are still present — the concern that wasm EH would remove them does not
apply.

One rename was needed: current Emscripten imports `_emscripten_throw_longjmp`
and passes **no arguments**, where older builds used `emscripten_longjmp(env,
value)`. Both are declared, since an unused import is free but a missing one is
a hard `LinkError`.

To re-check after any rebuild:

```js
WebAssembly.Module.imports(await WebAssembly.compile(bytes))
```

### 4. Bundle gaps filled — all 9 groups satisfied ✅

484 → 931 files. `pnpm engine:bundle:verify` reports every group green, and
`article`, `report`, `book`, `beamer`, `mathtools` and `cleveref` all compile
spotless against the built engine.

Filling them needs `kpsewhich`, i.e. a TeX Live install. On Windows that is the
blocker; **TeX Live installs into `$HOME` under WSL without sudo**, which is how
this was unblocked:

```console
pnpm engine:bundle:extend && pnpm engine:bundle:verify
```

⚠️ `C:\texlive\2026\bin\windows` is on `PATH` but **does not exist** — a stale
entry, not an install. Use WSL.

Two traps worth knowing:

- **`extend-bundle.mjs` under-reports.** It flagged `size1.sty` and `bk1.sty`,
  which look like regex noise and were initially dismissed as such. They were
  real: the source says `\input{bk1\@ptsize.clo}` and the pattern stops at the
  macro. The actual files are `size1{0,1,2}.clo` / `bk1{0,1,2}.clo`, and `book`
  and `beamer` both failed without them.
- **`.sty`/`.cls` are not enough for fonts.** XeTeX asks for font *files*
  (`[lmsans10-regular]`), so the OTFs must be present. Beamer surfaced this
  because it defaults to sans; the serif-defaulting classes did not.

`pdftex.map` was **removed** (4.4 MB raw): it is a pdfTeX map and this engine is
XeTeX. A/B tested — byte-identical output across every test document, and
compiles run about twice as fast without it (6.1 s → 2.9 s for the suite).

`extend-bundle.mjs` resolves dependencies by scanning `\RequirePackage`,
`\usepackage`, `\LoadClass` and `\input`. That is approximate, because TeX's
real resolution is Turing-complete. The robust replacement, once the engine
links: compile a document, feed `result.missingFiles` back in, repeat until
empty. No guessing at all — and it doubles as the on-demand fetch path.

---

## Known issues

### siunitx: "LaTeX kernel too old"

`\usepackage{siunitx}` compiles and produces a PDF, but reports:

```text
Package siunitx Error: LaTeX kernel too old.
```

The bundled `latex.fmt` is a dump of an older LaTeX kernel than the packages
now in the bundle, which came from a current TeX Live. siunitx v3 checks the
kernel date and refuses. This is a **format/package version skew**, not a
missing file, so `bundle:extend` cannot fix it.

It is the one gap between "the group is in the manifest" and "the group works",
and it likely affects other modern `expl3`-based packages. Two candidate fixes:

- regenerate `latex.fmt` from the same TeX Live snapshot the packages come from
  (`scripts/generate-format.sh` exists), or
- pin the packages to the vintage the format expects.

The first is the right one — it makes the snapshot internally consistent instead
of freezing packages to an old kernel.

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
