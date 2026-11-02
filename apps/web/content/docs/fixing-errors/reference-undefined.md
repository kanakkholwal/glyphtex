---
title: "Fix: LaTeX Warning: Reference … undefined (?? in the PDF)"
description: "Why \\ref shows ?? and LaTeX warns 'Reference fig:plot on page 1 undefined' or 'There were undefined references', and how to fix labels that do not resolve."
category: "Fixing errors"
order: 18
updated: "2026-11-02"
tags: [latex, warnings, references, labels, troubleshooting]
faq:
  - q: "Why does \\ref show ?? in LaTeX?"
    a: "LaTeX has no label by that name. Either the \\label is missing or misspelled, or the document has not been compiled enough times for the reference to resolve."
  - q: "Do I need to compile twice for references?"
    a: "With most LaTeX setups, yes: the first run records labels and the second uses them. GlyphTeX reruns automatically until references settle, so a ?? that remains is a real missing label."
  - q: "Why does my figure reference show the section number?"
    a: "The \\label is placed before \\caption. Put \\label after \\caption, or inside it, so it picks up the figure number."
---

:::takeaways
- `??` in the PDF means LaTeX found no `\label` with that name.
- It is a warning; the PDF still builds.
- GlyphTeX reruns the compile for you, so a `??` that stays is a real problem.
- Cause 1: the label name differs (a typo, or a different prefix).
- Cause 2: the `\label` is missing, or in a file that is not included.
:::

## The warning

```text
LaTeX Warning: Reference `fig:plot' on page 1 undefined on input line 4.

LaTeX Warning: There were undefined references.
```

The name in quotes is what `\ref` asked for. Search your project for `\label{fig:plot}`: if nothing matches exactly, that is the problem.

## Cause 1: the names do not match

Labels are exact, case-sensitive strings.

```latex
\label{fig:Plot}   ...   \ref{fig:plot}     % wrong: case differs
\label{fig:plot}   ...   \ref{fig:plot}     % right
```

## Cause 2: the label is missing or not included

The `\label` was deleted, never added, or lives in a chapter file you have commented out of `\include`/`\input`.

**Fix:** add the label, or include the file that has it.

## Cause 3: not enough compile passes

A label is written to the `.aux` file on one run and read on the next, so a fresh document needs two runs. In a plain LaTeX setup, compile again.

:::callout{type=tip title="In GlyphTeX"}
GlyphTeX reruns the compile automatically until references stop changing. If a `??` survives, rerunning will not fix it; check the label name.
:::

## The wrong number, not ??

If a reference resolves but shows the wrong number (often the section instead of the figure), the `\label` is before the `\caption`:

```latex
\begin{figure}
  \includegraphics{plot.png}
  \label{fig:plot}           % wrong: before the caption
  \caption{Results}
\end{figure}

\begin{figure}
  \includegraphics{plot.png}
  \caption{Results}
  \label{fig:plot}           % right: after the caption
\end{figure}
```

## Citations too

Citations show `[?]` for the same reasons. See [why LaTeX citations show question marks](../../blog/latex-citations-question-marks).

## Still stuck

- Labels inside a `\caption` of a `\section*` (unnumbered) have nothing to point to.
- Related: [Overfull \hbox](./overfull-hbox), another warning that still builds a PDF.
