# Known engine issues

## `\XeTeXglyphname` traps the WASM engine

Calling `\XeTeXglyphname\font<n>` (glyph index to glyph name) crashes the compile
with "memory access out of bounds". `\XeTeXcountglyphs` and `\XeTeXglyphindex`
(by codepoint) both work; only the name lookup traps.

Isolated against the real engine (no TeX Live): l3 deps load, the font loads and
renders by codepoint, `\XeTeXcountglyphs` returns the right count, but the first
`\XeTeXglyphname` on any font aborts. Reproduced with expl3 pinned to the format's
own date, so it is not a version skew.

**Impact.** Upstream `fontawesome5`'s uTeX helper builds its icon table by
enumerating every glyph name at load, so loading it directly aborts. GlyphTeX ships
a shim (`vendor/fontawesome5/fontawesome5.sty`) that renders from the upstream
codepoint mapping instead, avoiding the enumeration. Any other package that walks
glyph names at load will hit the same trap.

**Root cause.** In the XeTeX layout C, not yet isolated to a line. The trap is in
the font engine, not the format. Fixing it needs a C/Rust debug build plus an emsdk
rebuild of the engine.

## TeX Live from October 2026 cannot rebuild the bundle

The shipped format and core bundle come from a mid-2026 TeX Live snapshot. Against
TeX Live 2026 as installed in November 2026 (hyperref 2026-10-09):

- `make-format.mjs` never finishes round 1: INITEX on the newer kernel spins at full
  CPU in the WASM engine with no output. Not isolated yet.
- Rebuilt `science` and new `xeCJK` packs fail with "Cannot run piped system
  commands": their current versions shell out, which the engine does not allow.

**Impact.** A full `rebuild-bundle.mjs` is blocked until the engine handles the new
kernel. New packs can still be built against the shipped core with
`build-packs.mjs --only <ids>`, which keeps every other pack as committed; their
fixtures prove they compile against the shipped format. That is how `exams`,
`symbols` and `opentype-fonts` were added. Do not rebuild existing packs from the
newer snapshot: `science` breaks, and `test/packs-compile.test.mjs` will say so.
