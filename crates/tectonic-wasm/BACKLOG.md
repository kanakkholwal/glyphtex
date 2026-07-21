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

### 4. Bundle rebuilt from one TeX Live snapshot — all 9 groups satisfied ✅

The bundle is now **discovered, not listed**: compile every fixture in
`test/fixtures/groups.mjs`, feed `result.missingFiles` back in from TeX Live,
repeat until they all produce PDFs. TeX's file resolution is Turing-complete, so
no static scan can predict it — but the engine always names what it wants.

```console
pnpm engine:bundle:format <dir>                    # dump latex.fmt with our engine
pnpm engine:bundle:build  <dir> --format <dir>     # converge against the fixtures
pnpm engine:bundle:pack   <dir>                    # deterministic tar.gz
pnpm engine:bundle:verify <dir>
```

396 files, 35.4 MB raw. **12/12 fixtures compile, 9/9 manifest groups green.**
That is *smaller* than the previous 931-file bundle: much of that one existed to
work around a broken kernel (below), and a correct format needs far less.

Needs `kpsewhich`, i.e. TeX Live. On Windows, **TeX Live installs into `$HOME`
under WSL without sudo** — that is what unblocked this. ⚠️
`C:\texlive\2026\bin\windows` is on `PATH` but **does not exist**; stale entry.

Traps worth knowing, each of which cost real time:

- **Files loaded via `\@input` are invisible to discovery.** TeX skips a missing
  `\@input`/`\InputIfFileExists` file *silently*, so it never reaches
  `missingFiles` and the bundle looks complete. See "first-aid" below — this is
  the single nastiest failure mode in this system.
- **A format must be built by the engine that loads it.** It is a memory image.
  `latex.fmt` from TeX Live's xetex will not load here.
- **`.sty`/`.cls` are not enough for fonts.** XeTeX asks for font *files*
  (`[lmsans10-regular]`), so OTFs must be present. Beamer surfaced this because
  it defaults to sans; serif-defaulting classes did not.
- **Regex dependency scanning under-reports.** The old `extend-bundle.mjs`
  flagged `size1.sty`/`bk1.sty`, dismissed as noise — they were real
  (`\input{bk1\@ptsize.clo}`, the pattern stops at the macro). It has been
  deleted in favour of the `missingFiles` loop.

`pdftex.map` was **removed** (4.4 MB raw): it is a pdfTeX map and this engine is
XeTeX. A/B tested — byte-identical output across every test document, and
compiles run about twice as fast without it (6.1 s → 2.9 s for the suite).

---

## Resolved

### siunitx "LaTeX kernel too old" — fixed by regenerating the format ✅

The bundled `latex.fmt` was a dump of an older LaTeX kernel than the packages
around it, and siunitx v3 checks the kernel date and refuses. Format/package
version *skew*, not a missing file.

Fixed the right way: `latex.fmt` is now dumped by our own engine in INITEX mode
from the same TeX Live snapshot as the packages (`pnpm engine:bundle:format`),
so the snapshot is internally consistent instead of packages being frozen to an
old kernel.

### cleveref after hyperref — missing kernel first-aid ✅

Symptom: `\cref` fails with an undefined
`\__socket_refstepcounter_plug_hyperref/fixcleveref:w`, while **native TeX Live
compiled the identical document fine** — which is what ruled out an upstream
package incompatibility.

Cause: `latex.ltx` pulls in `latex2e-first-aid-for-external-files.ltx` with
`\@input`, which **skips silently** when the file is absent. INITEX therefore ran
clean to `\dump` and produced a format that was simply missing first-aid's
definitions. Our cleveref is dated 2018/03/27, one day inside hyperref's
`\@ifpackagelater{cleveref}{2018/03/28}` cutoff, so hyperref installs a compat
plug whose body is the only caller of `\firstaid@cref@updatelabeldata`.

Two things this teaches, both encoded in the scripts now:

- Silently-loaded files must be **seeded explicitly**; `missingFiles` cannot see
  them. `make-format.mjs` seeds them, and the full set was enumerated from
  `latex.ltx` rather than patching the one instance.
- first-aid belongs in the **format**, not the runtime bundle. `\@input` runs
  inside `latex.ltx`, i.e. before `\dump`; adding the file to the bundle is too
  late and does nothing. (Tried it. It did nothing.)

`make-format.mjs` also refuses to write a format from an INITEX run that
reported errors — a dump after a partial kernel load loads happily and then
fails much later in ways that look like package bugs.

---

## Planned

- **On-demand package fetching — the coverage cliff.** ⚠️ This is the largest
  known gap in production behaviour, so state it plainly: **the bundle contains
  what the 12 fixtures need, and nothing else.** It is not general LaTeX
  coverage. A document using any package outside that set fails at compile time
  with a missing file, and there is currently no fallback — the
  `/texlive/[...path]` proxy that used to cover this was removed.

  `missingFiles` is the designed hook: fetch, `addFile`, recompile. Auxiliary
  files are retained across compiles, so the retry resumes rather than
  restarting. Until it exists, either widen the fixture set (which widens the
  bundle) or accept that unlisted packages fail.

  When implementing it, remember the first-aid lesson above: files loaded via
  `\@input`/`\InputIfFileExists` never appear in `missingFiles`, so on-demand
  fetch cannot recover them either. They must stay seeded.
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
