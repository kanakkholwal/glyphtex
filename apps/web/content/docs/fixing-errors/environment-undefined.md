---
title: "Fix: LaTeX Error: Environment … undefined"
description: "What 'LaTeX Error: Environment algorithm undefined' (or align, figure*, theorem…) means, why it happens, and the package or definition that fixes it."
category: "Fixing errors"
order: 13
updated: "2026-11-02"
tags: [latex, errors, environments, troubleshooting]
faq:
  - q: "What does 'Environment undefined' mean in LaTeX?"
    a: "LaTeX reached \\begin{name} for an environment nobody has defined. Usually the package that provides it is not loaded, or the name is misspelled."
  - q: "How do I fix 'LaTeX Error: Environment align undefined'?"
    a: "Add \\usepackage{amsmath} to the preamble. align, gather, multline and cases all come from amsmath."
  - q: "How do I fix 'Environment theorem undefined'?"
    a: "theorem is not built in. Load amsthm and declare it with \\newtheorem{theorem}{Theorem} in the preamble before you use it."
---

:::takeaways
- LaTeX met `\begin{name}` for an environment that does not exist yet.
- Cause 1: the package that defines it is not loaded.
- Cause 2: the name is misspelled, or has the wrong case.
- Cause 3: it is a custom environment that was never declared.
- One undefined environment usually causes a second error at its `\end`; fix the first.
:::

## The error

```text
! LaTeX Error: Environment algorithm undefined.

See the LaTeX manual or LaTeX Companion for explanation.
```

It is often followed by a second, confusing one:

```text
! LaTeX Error: \begin{document} ended by \end{algorithm}.
```

The second error is a side effect. Because `\begin{algorithm}` never opened, LaTeX matches `\end{algorithm}` against the last thing that did open, `\begin{document}`. Fix the first error and both go away.

## Cause 1: the package is not loaded

Most environments outside the basics come from a package.

| Environment | Load |
| --- | --- |
| `align`, `gather`, `multline`, `cases` | `amsmath` |
| `proof` | `amsthm` |
| `algorithm` | `algorithm` |
| `algorithmic` | `algpseudocode` |
| `lstlisting` | `listings` |
| `tikzpicture` | `tikz` |
| `subfigure` | `subcaption` |
| `tabularx` | `tabularx` |
| `longtable` | `longtable` |

**Fix:** add the package to the preamble, before `\begin{document}`:

```latex
\usepackage{amsmath}
...
\begin{align}
  a &= b + c
\end{align}
```

## Cause 2: a typo

Environment names are case-sensitive and must match exactly.

```latex
\begin{Figure}   % wrong: capital F
\begin{figure}   % right
\begin{itemise}  % wrong: British spelling
\begin{itemize}  % right
```

## Cause 3: a custom environment that was never declared

`theorem`, `lemma` and `definition` look built in but are not. You declare them yourself.

```latex
\usepackage{amsthm}
\newtheorem{theorem}{Theorem}
\newtheorem{lemma}[theorem]{Lemma}
```

The same applies to anything you copied from another document that had its own `\newenvironment`. Copy the definition into your preamble too.

:::callout{type=tip title="Packages in GlyphTeX"}
If the package is not in the base engine, GlyphTeX shows a **Missing packages** notice naming the package set that has it. One click adds it.
:::

## Still stuck

- Search the environment name in the [package reference](../../packages) to see which package provides it.
- Related: [Undefined control sequence](./undefined-control-sequence) is the same problem for commands.
