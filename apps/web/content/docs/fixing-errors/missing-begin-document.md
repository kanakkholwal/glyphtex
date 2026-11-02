---
title: "Fix: LaTeX Error: Missing \\begin{document}"
description: "Why LaTeX says 'Missing \\begin{document}' even when your file has one, and how to find the stray text in the preamble that causes it."
category: "Fixing errors"
order: 14
updated: "2026-11-02"
tags: [latex, errors, preamble, troubleshooting]
faq:
  - q: "Why does LaTeX say Missing \\begin{document} when I have one?"
    a: "Something in the preamble produced text before \\begin{document}. LaTeX can only typeset after the document starts, so any stray character, word or typo in the preamble triggers this error."
  - q: "How do I find what causes Missing \\begin{document}?"
    a: "Look at the lines just above the reported line. Common culprits are a typo in a \\usepackage line, a missing backslash, an unbalanced bracket in package options, or text pasted into the preamble."
---

:::takeaways
- The error means something tried to print text before `\begin{document}`.
- The `\begin{document}` line is usually fine. The problem is above it.
- Cause 1: plain text or a stray character in the preamble.
- Cause 2: a command missing its backslash, so its name is printed as text.
- Cause 3: a broken `\usepackage` line or unbalanced option brackets.
:::

## The error

```text
! LaTeX Error: Missing \begin{document}.

See the LaTeX manual or LaTeX Companion for explanation.
```

The preamble (everything between `\documentclass` and `\begin{document}`) is for settings only. The moment anything in it produces a visible character, LaTeX stops with this error, because there is no page to put it on yet.

## Cause 1: text in the preamble

```latex
\documentclass{article}
\usepackage{amsmath}
Hello                  % <- this word is the problem
\begin{document}
```

**Fix:** move the text below `\begin{document}`, or delete it. This often happens when a title or a sentence is pasted into the wrong place.

## Cause 2: a missing backslash

Without its backslash a command is just a word, and a word is text.

```latex
usepackage{graphicx}    % wrong: printed as "usepackage"
\usepackage{graphicx}   % right
```

## Cause 3: a broken package line

An unclosed bracket or brace swallows the next lines, and what is left over is printed.

```latex
\usepackage[margin=2cm{geometry}     % wrong: ] missing
\usepackage[margin=2cm]{geometry}    % right
```

Also check for stray characters at the end of lines, like a trailing `.` or `]` after `\usepackage{...}`.

## How to find it fast

Comment out the preamble in halves with `%`. Recompile after each change. When the error disappears, the culprit is in the half you just disabled.

:::callout{type=tip title="In GlyphTeX"}
The preview recompiles as you type, so commenting out lines one at a time is quick. The Problems panel points at the line LaTeX stopped on.
:::

## Still stuck

- Check files you `\input` in the preamble: text in those counts too.
- Related: [Can be used only in preamble](./can-be-used-only-in-preamble) is the opposite mistake.
