---
title: "Fix: LaTeX Error: Can be used only in preamble"
description: "Why LaTeX says 'Can be used only in preamble': a \\usepackage or another setup command after \\begin{document}. How to move it, and what to do with pasted snippets."
category: "Fixing errors"
order: 22
updated: "2026-11-02"
tags: [latex, errors, preamble, packages, troubleshooting]
faq:
  - q: "What does Can be used only in preamble mean?"
    a: "A command that configures the document, most often \\usepackage, appears after \\begin{document}. Those commands only work in the preamble, before the document starts."
  - q: "How do I fix Can be used only in preamble?"
    a: "Move the \\usepackage (or \\documentclass, \\geometry setup, and similar) above \\begin{document}. If it came from a pasted snippet, keep only the body of the snippet below \\begin{document}."
---

:::takeaways
- A setup command appears after `\begin{document}`.
- Usually it is a `\usepackage` line.
- Fix: move it above `\begin{document}`.
- A pasted example often brings its own preamble; keep only its body.
:::

## The error

```text
! LaTeX Error: Can be used only in preamble.

See the LaTeX manual or LaTeX Companion for explanation.
```

The preamble is everything between `\documentclass` and `\begin{document}`. Packages have to be loaded there, because they change how the whole document is set up.

## Cause 1: a \usepackage in the body

```latex
\begin{document}
\usepackage{amsmath}     % wrong: too late
\[ \dfrac{a}{b} \]
\end{document}
```

**Fix:**

```latex
\usepackage{amsmath}     % right: before the document starts
\begin{document}
\[ \dfrac{a}{b} \]
\end{document}
```

## Cause 2: a pasted complete example

Examples online are often whole documents. Pasting one into the middle of yours adds a second `\documentclass`, `\usepackage` lines and a nested `\begin{document}`.

**Fix:** copy the `\usepackage` lines into your preamble (skip any you already have), and paste only what was between the example's `\begin{document}` and `\end{document}`.

## Cause 3: an \input file with a preamble

A chapter file pulled in with `\input` or `\include` must not contain `\documentclass` or `\usepackage`. Move those to the main file.

## Still stuck

- Related: [Missing \begin{document}](./missing-begin-document) is the opposite: text in the preamble.
- Related: [Option clash](./option-clash), if moving the line creates a duplicate load.
