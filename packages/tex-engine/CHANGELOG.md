# Changelog

## 0.1.7

### Added

- `template-helpers` pack, closing #85, #86, #87 and #88: `fullpage`, `makecell`, `subfiles` (with
  `subfiles.cls` and the `import` package it needs) and `algorithmic` (the classic pseudocode syntax from
  the `algorithms` package, which pairs with the existing `algorithm` float). It requires the `algorithms`
  and `figures` packs.

### Changed

- `scripts/build-packs.mjs` accepts `--texmf <folder>`: a plain folder of TeX files (for example unzipped
  CTAN or TeX Live package archives) searched before `kpsewhich`, so packs can be built on a machine with no
  TeX Live installed. Existing packs are untouched; only the new one is added to the index.

## 0.1.6

### Added

- `mnras` pack: the Monthly Notices of the RAS class and its BibTeX style, tested with the
  declarations from #83 (`bm`, `soul`, `xargs`, T1 fonts, `usenatbib`). It requires the
  `references`, `math-helpers`, `review`, `writing` and `fonts-latinmodern` packs.

## 0.1.5

### Added

- `math-helpers` pack: `bm` (bold math symbols) and `xargs` (commands with several
  optional arguments), requested in #83. Built against the shipped core with
  `build-packs.mjs --only math-helpers`, so no existing pack changed.

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
