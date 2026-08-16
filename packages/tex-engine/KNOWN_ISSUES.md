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
