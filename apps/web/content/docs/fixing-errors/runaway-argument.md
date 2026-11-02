---
title: "Fix: Runaway argument? Paragraph ended before … was complete"
description: "What 'Runaway argument?', 'Paragraph ended before \\textbf was complete' and 'File ended while scanning use of' mean in LaTeX, and how to find the missing brace."
category: "Fixing errors"
order: 15
updated: "2026-11-02"
tags: [latex, errors, braces, troubleshooting]
faq:
  - q: "What does Runaway argument mean in LaTeX?"
    a: "A command's argument never ended. Almost always a closing brace } is missing, so LaTeX kept reading until it hit a blank line or the end of the file."
  - q: "What does 'Paragraph ended before \\textbf was complete' mean?"
    a: "A blank line appeared inside the argument of \\textbf (or a similar command). Either a closing brace is missing, or the argument really does contain a paragraph break, which that command does not allow."
  - q: "What does 'File ended while scanning use of' mean?"
    a: "LaTeX reached the end of the file while still reading a command's argument. A closing brace is missing somewhere after that command."
---

:::takeaways
- "Runaway argument?" means a command's `{...}` argument never closed.
- The fix is nearly always a missing `}`.
- "Paragraph ended before" means a blank line appeared inside the argument.
- "File ended while scanning use of" means the file ran out first; nothing after the error compiles.
- The line under "Runaway argument?" shows where the argument started.
:::

## The errors

These come in two flavours. A blank line inside an argument:

```text
Runaway argument?
{bold
! Paragraph ended before \text@command was complete.
```

Or the file ending inside one:

```text
Runaway argument?
{never closed \end {document}
! File ended while scanning use of \@footnotetext.
...
! Emergency stop
```

The line straight after "Runaway argument?" is the start of the argument that never ended. Search your file for it. The command named in the error is an internal one (`\text@command` is what `\textbf` and friends use, `\@footnotetext` is `\footnote`), so go by the text, not the name.

## Cause 1: a missing closing brace

```latex
\textbf{bold

more} text                 % wrong: blank line inside the argument

\textbf{bold} more text    % right
```

```latex
\footnote{never closed     % wrong: no } before the end of the file
\footnote{closed}          % right
```

**Fix:** add the `}` where the argument should end. In math, the same mistake reports as the command it broke:

```latex
$\frac{1}{2$     % "File ended while scanning use of \frac"
$\frac{1}{2}$    % right
```

## Cause 2: a paragraph break the command does not accept

Commands like `\textbf`, `\section` and `\caption` take one paragraph at most. A blank line inside them is an error even with balanced braces.

**Fix:** remove the blank line, or use a form that allows paragraphs: `{\bfseries ...}` instead of `\textbf{...}`, or an environment.

## How to find it fast

- Your editor's bracket matching shows where each `{` closes. In GlyphTeX, put the cursor next to a brace to see its pair.
- If the error says "File ended", everything after the opening brace was swallowed. Work forward from the text shown under "Runaway argument?".

## Still stuck

- Related: [Too many }'s](./too-many-braces) is the opposite problem, one brace too many.
- Related: [Missing $ inserted](./missing-dollar-inserted) often appears alongside a broken math argument.
