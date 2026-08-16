# Vendored: Font Awesome 5

These files ship Font Awesome 5 in the browser engine. Upstream `fontawesome5.sty`
builds its icon table by enumerating glyph names with `\XeTeXglyphname`, which traps
the WASM engine (see `../../KNOWN_ISSUES.md`). `fontawesome5.sty` here replaces that
one step: it reuses the upstream `fontawesome5-mapping.def` (icon name, font bank, and
Unicode codepoint) and renders each icon by `\char`, so no glyph-name enumeration runs.
The fonts load by filename through the `.fd` files, which the in-memory VFS resolves.

| File | Origin | Licence |
|---|---|---|
| `FontAwesome5Free-Solid-900.otf` | Font Awesome Free 5 | SIL OFL 1.1 |
| `FontAwesome5Free-Regular-400.otf` | Font Awesome Free 5 | SIL OFL 1.1 |
| `FontAwesome5Brands-Regular-400.otf` | Font Awesome Free 5 | SIL OFL 1.1 |
| `fontawesome5-mapping.def` | CTAN `fontawesome5` (Marcel Krüger) | LPPL 1.3c |
| `tufontawesomefree.fd` | CTAN `fontawesome5` (Marcel Krüger) | LPPL 1.3c |
| `tufontawesomebrands.fd` | CTAN `fontawesome5` (Marcel Krüger) | LPPL 1.3c |
| `fontawesome5.sty` | GlyphTeX (this project), after the upstream package | LPPL 1.3c |

The icon command set (`\faHome`, `\faGithub`, `\faIcon{...}`, …) and codepoints match
upstream, since the mapping is upstream data used unchanged. What differs is only the
font-loading and glyph-selection path.
