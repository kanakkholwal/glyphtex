# Changelog

## 0.1.2

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
