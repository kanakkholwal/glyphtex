# Tectonic engine

GlyphTeX compiles LaTeX → PDF by driving the [Tectonic](https://tectonic-typesetting.github.io)
binary as a subprocess (the in-process crate needs vcpkg/native libs on Windows,
so the binary keeps the build simple and cross-platform).

The Rust command (`src/compile.rs`) resolves the binary in this order:

1. **`GLYPHTEX_TECTONIC_BIN`** environment variable (absolute path), then
2. a **managed engine** downloaded into the app-data dir (see `src/engine.rs`), then
3. a **sidecar** next to the app executable, or a `binaries/` dir in any ancestor
   (`tectonic[.exe]` — the ancestor walk covers `tauri dev`, where the exe lives
   under `target/debug`), then
4. **`tectonic` on `PATH`**.

## Getting Tectonic

The quickest path during development is to put it on `PATH`:

- **Windows:** `choco install tectonic` (or `scoop install tectonic`)
- **macOS:** `brew install tectonic`
- **Linux:** `cargo install tectonic`, or your distro's package

…or download a release binary from
<https://github.com/tectonic-typesetting/tectonic/releases> and either drop it
in this folder, set `GLYPHTEX_TECTONIC_BIN` to its path, or add it to `PATH`.

> First compile downloads Tectonic's TeX bundle (~once, cached). After that it
> works fully offline.

> **Bundle vintage.** Tectonic's default bundle is **TeX Live 2023** (frozen
> 2023-03-13) and upstream has not published a newer one — the bundle repo was
> archived in Oct 2024. Packages added to CTAN after that date are simply not in
> it, which is the usual cause of a "file not found" for a recent package.

## Bundling for distribution

Tectonic ships inside the installer as a Tauri **sidecar**. `tauri.conf.json`
declares `"externalBin": ["binaries/tectonic"]` under `bundle`, so Tauri expects
a binary here named `tectonic-<target-triple>[.exe]` (e.g.
`tectonic-x86_64-pc-windows-msvc.exe`) and copies it next to the app executable
in the bundle. `tauri::generate_context!` validates that the file exists for the
build target, so **it must be present before `tauri dev`/`build` will compile**.

- **Local dev:** run `pnpm --filter @glyphtex/desktop tectonic:setup`. It copies an
  existing `tectonic[.exe]` here into the triple-named sidecar, or downloads the
  pinned release if you don't have one yet.
- **CI / release:** `scripts/release/download-tectonic.mjs` fetches the pinned
  Tectonic version for each target triple (see `TECTONIC_VERSION` in the
  workflows). CI uses empty placeholder files since it never runs the engine.

The plain `tectonic[.exe]` (no triple) is still used at runtime when found next
to the app exe (Tauri copies the sidecar there) or in this folder during dev.
