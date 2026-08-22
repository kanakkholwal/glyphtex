---
title: "Fix: Missing $ inserted"
description: "Why LaTeX reports 'Missing $ inserted', the maths-mode causes behind it, and how to fix each one with clear examples."
category: "Fixing errors"
order: 11
updated: "2026-08-22"
tags: [latex, errors, maths, troubleshooting]
faq:
  - q: "What causes 'Missing $ inserted' in LaTeX?"
    a: "A maths-only symbol was used in ordinary text. Characters like underscore, caret, and commands such as \\alpha only work inside maths mode, delimited by dollar signs or a maths environment."
  - q: "How do I fix 'Missing $ inserted'?"
    a: "Wrap the maths in dollar signs, for example $x_1$ instead of x_1. For a literal underscore in text, escape it as \\_."
---

:::takeaways
- The error means a maths-only character appeared in plain text.
- Underscore `_` and caret `^` are the usual culprits.
- Fix: wrap maths in `$...$`, or escape the literal character.
- The reported line is reliable here; look for `_`, `^`, or a Greek-letter command.
:::

## The error

```text
! Missing $ inserted.
<inserted text>
                $
l.17 The value x_1
                  is defined below.
```

LaTeX has two modes: text mode and maths mode. Some characters only mean something in maths mode. When one appears in plain text, LaTeX assumes you forgot to enter maths mode and reports `Missing $ inserted`.

## Cause 1: subscripts and superscripts in text

`_` (subscript) and `^` (superscript) are maths-only.

```latex
The value x_1 is set.        % wrong: x_1 is maths
The value $x_1$ is set.      % right
```

**Fix:** wrap the maths in dollar signs: `$x_1$`, `$x^2$`.

## Cause 2: maths commands in text

Commands like `\alpha`, `\sum`, `\frac`, and `\to` only work in maths mode.

```latex
The rate is \alpha per year.        % wrong
The rate is $\alpha$ per year.      % right
```

**Fix:** wrap them: `$\alpha$`, `$\frac{1}{2}$`.

## Cause 3: a literal underscore in text

You wanted a real underscore, for example in a filename or an identifier.

```latex
The file data_set.csv is loaded.     % wrong: _ starts a subscript
The file data\_set.csv is loaded.    % right: escaped underscore
```

**Fix:** escape it as `\_`, or set the text in `\texttt{data\_set.csv}`.

## Cause 4: an unclosed maths block

A maths block opened but never closed makes the following text look like stray maths.

```latex
$x + y = z            % missing closing $
```

**Fix:** close every `$` with a matching `$`, and every `\[` with `\]`.

:::callout{type=warn title="Two dollars start display maths"}
`$$...$$` is discouraged in modern LaTeX. Use `\[ ... \]` for display equations; it spaces better and reports errors more clearly.
:::

## Decide the fix in one step

```mermaid
flowchart TD
  A[Missing $ inserted] --> B{Did you mean maths?}
  B -->|Yes| C[Wrap it in $...$]
  B -->|No, literal character| D[Escape it, e.g. \_ ]
  C --> E{Block closed?}
  E -->|No| F[Add the closing $ or \]]
```

## Related

- [Undefined control sequence](/docs/fixing-errors/undefined-control-sequence)
- [File not found](/docs/fixing-errors/file-not-found)
