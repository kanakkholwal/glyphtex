# Changelog

## 0.1.4

### Added

- `unpackTarGz`, `gunzip` and `untar`: load the bundle and package sets without
  another library.
- A rewritten README with install steps, Node and Web Worker quick starts and a
  full API reference, plus runnable `examples/` (a Node compile script and a
  project-folder compiler). The crate's README is now its docs.rs page, with
  doctested examples and three `cargo run --example` programs.
- MIT `LICENSE` files in both packages.
- `bundle-manifest.json` and `packs.config.json` are now exported, so consumers
  can list what the engine supports without unpacking the bundle.
- Three packs that ship with the engine: `exams` (the `exam` class, requested
  in #40), `symbols` (`eurosym`, `pifont`) and `opentype-fonts` (`fontspec`, with
  TeX Gyre Termes). Built against the shipped core; see `KNOWN_ISSUES.md` for why
  the core was not rebuilt.

### Fixed

- The optional `icons` pack (Font Awesome 5) is now actually built and shipped.
  0.1.3 announced it, but its tarball was never committed, so `fontawesome5`
  still failed as a missing file.

## 0.1.3

### Added

- Font Awesome 5 support, shipped as a new optional `icons` pack (offered for
  install when a document uses it). `\usepackage{fontawesome5}` now resolves, with
  `\faHome`, `\faGithub`, `\faIcon{...}` and the full icon set rendering from the
  three FA5 fonts.
- Vendored-pack build mechanism (`vendor` key in `packs.config.json`). A pack can
  ship files straight from `vendor/<name>/` instead of converging against TeX Live,
  for assets TeX Live cannot supply in a form the WASM engine accepts.

### Notes

- Upstream `fontawesome5` builds its icon table with `\XeTeXglyphname`, which traps
  the WASM engine (see `KNOWN_ISSUES.md`). The vendored `fontawesome5.sty` renders
  from the upstream codepoint mapping instead, so no enumeration runs. Icon commands
  and codepoints match upstream; only the font-loading path differs.
- The engine wasm and the runtime bindings are unchanged: this is a bundle/packaging
  change. Consumers get the icons via a rebuilt pack set, not a new engine.
