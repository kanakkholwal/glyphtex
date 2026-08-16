# Changelog

## Unreleased

### Known issues

- `\XeTeXglyphname` (glyph index to glyph name) traps the engine with "memory
  access out of bounds". `\XeTeXcountglyphs` and `\XeTeXglyphindex` work; only the
  name lookup aborts. Any package that enumerates glyph names at load (upstream
  `fontawesome5` among them) hits this. Documented in
  `packages/tex-engine/KNOWN_ISSUES.md`; not yet fixed, since it needs a C/Rust
  debug build plus an emsdk rebuild.

## 0.1.2

No engine changes. Font Awesome 5 support was added at the bundle layer (a vendored
`icons` pack), not in this crate; see `packages/tex-engine/CHANGELOG.md`.
