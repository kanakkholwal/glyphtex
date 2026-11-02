---
title: "Fix: Extra alignment tab has been changed to \\cr"
description: "What the LaTeX table error 'Extra alignment tab has been changed to \\cr' means: a row has more & than the column spec allows. How to fix it."
category: "Fixing errors"
order: 19
updated: "2026-11-02"
tags: [latex, errors, tables, troubleshooting]
faq:
  - q: "What does Extra alignment tab has been changed to \\cr mean?"
    a: "A table row has more cells than the column specification declares. With {ll} there are two columns, so a row may contain at most one &."
  - q: "How do I fix Extra alignment tab in a table?"
    a: "Either add a column to the specification, for example {lll} for three cells, or remove the extra & from the row. Check that \\\\ ends each row, so two rows are not read as one."
---

:::takeaways
- A table row has more cells than the column spec allows.
- `n` columns means at most `n - 1` ampersands per row.
- Cause 1: the column spec is too short.
- Cause 2: a missing `\\` merged two rows into one.
- Cause 3: a literal `&` in a cell that should be `\&`.
:::

## The error

```text
! Extra alignment tab has been changed to \cr.
<recently read> \endtemplate
```

In a table, `&` moves to the next column. When a row runs out of declared columns, LaTeX ends the row early (that is the `\cr`) and complains.

## Cause 1: the column spec is too short

```latex
\begin{tabular}{ll}          % two columns
  a & b & c \\               % three cells: error
\end{tabular}

\begin{tabular}{lll}         % three columns
  a & b & c \\               % fine
\end{tabular}
```

**Fix:** count the cells in your widest row and give the spec one letter per column. This applies to `array`, `matrix`-style environments with a column spec, and `align` too.

## Cause 2: a missing row ending

```latex
  a & b       % no \\ here, so the next row continues this one
  c & d \\
```

**Fix:** end every row with `\\`.

## Cause 3: a literal ampersand

```latex
  Smith & Jones & 2024 \\     % "Smith & Jones" is one cell, but & splits it
  Smith \& Jones & 2024 \\    % right
```

## In aligned equations

`align` alternates right- and left-aligned columns, so pairs of `&` define each block. An extra `&` gives the same error:

```latex
\begin{align}
  a &= b & c &= d    % two blocks: fine
\end{align}
```

## Still stuck

- Related: [Misplaced alignment tab character &](./misplaced-alignment-tab) is an `&` outside any table.
- Use the editor's search for `&` on the reported row to count cells.
