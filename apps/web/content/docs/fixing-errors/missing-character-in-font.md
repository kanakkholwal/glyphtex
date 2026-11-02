---
title: "Fix: Missing character: There is no … in font (emoji, Chinese, symbols vanish)"
description: "Why characters such as emoji, Chinese or Greek disappear from the PDF with only 'Missing character: There is no 😀 (U+1F600) in font' in the log, and how to fix it."
category: "Fixing errors"
order: 23
updated: "2026-11-03"
tags: [latex, warnings, fonts, unicode, xelatex, troubleshooting]
faq:
  - q: "Why do characters disappear from my LaTeX PDF?"
    a: "The current font has no glyph for them. XeLaTeX drops the character and writes 'Missing character: There is no … in font' to the log, without stopping the compile."
  - q: "How do I fix Missing character: There is no … in font?"
    a: "Replace the character with a LaTeX command where one exists, such as $\\alpha$ or \\checkmark. You can also load fontspec and choose a font that contains the characters; in GlyphTeX, add the font file to the project and load it by file name."
  - q: "What is the pdfLaTeX version of this error?"
    a: "pdfLaTeX stops with 'Package inputenc Error: Unicode character … not set up for use with LaTeX'. The cause is the same: the font setup has no glyph for the character."
---

:::takeaways
- The compile succeeds, but some characters are silently missing from the PDF.
- The only sign is `Missing character: There is no … in font` in the log.
- The default font, Latin Modern, covers accented Latin text but not Greek letters, emoji, or Chinese, Japanese and Korean.
- Fix: use a LaTeX command for the symbol, or a font that has it.
:::

## The warning

GlyphTeX compiles with XeTeX, which reports this as a log line rather than an error:

```text
Missing character: There is no 😀 (U+1F600) in font [lmroman10-regular]:mapping=tex-text;!
Missing character: There is no 中 (U+4E2D) in font [lmroman10-regular]:mapping=tex-text;!
```

Each line names the character, its Unicode code point, and the font that lacks it (`lmroman10-regular` is Latin Modern, the default). Because the compile reports success, you may only notice when the words are missing from the PDF.

Accented Latin letters such as é, ï and Ø are covered and need nothing special.

## Fix 1: use a command instead of the raw character

This works everywhere, GlyphTeX included:

| Character | Write | Needs |
| --- | --- | --- |
| α, β, γ | `$\alpha$`, `$\beta$`, `$\gamma$` | nothing |
| ° | `\textdegree` | nothing |
| € | `\texteuro` | nothing |
| ✓ | `\checkmark` | `amssymb` |
| ≤, ≥, → | `$\leq$`, `$\geq$`, `$\to$` | nothing |

## Fix 2: choose a font that has the characters

Load `fontspec` and pick a font with the glyphs. GlyphTeX has no access to fonts installed on your computer, so add the `.otf` or `.ttf` file to the project and load it by file name:

```latex
\usepackage{fontspec}
\setmainfont{NotoSerif-Regular.ttf}

% or a second font for just a few characters
\newfontfamily\symbolfont{NotoSansSymbols2-Regular.ttf}
Rated {\symbolfont ★★★★}.
```

In a full TeX installation (TeX Live or MiKTeX) with XeLaTeX or LuaLaTeX, you can name installed fonts instead: `\setmainfont{Noto Serif}`.

For Chinese, Japanese or Korean text, a full TeX installation can use `xeCJK` with a CJK font:

```latex
\usepackage{xeCJK}
\setCJKmainfont{Noto Serif CJK SC}
```

:::callout{type=warn title="In GlyphTeX today"}
`fontspec` works in GlyphTeX, but `xeCJK` does not yet, and XeTeX cannot draw colour emoji. For CJK text or emoji, use a full TeX installation. [Request a package](../../packages#search) if you need one.
:::

## The pdfLaTeX equivalent

In pdfLaTeX the same problem stops the compile:

```text
! Package inputenc Error: Unicode character 😀 (U+1F600)
(inputenc)                not set up for use with LaTeX.
```

The commands in Fix 1 work there too.

## Still stuck

- Search the log for `Missing character` after any compile with non-Latin text.
- Related: [Undefined control sequence](./undefined-control-sequence), if a symbol command is not recognised.
