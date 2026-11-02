---
title: "Fix: Misplaced alignment tab character &"
description: "Why LaTeX says 'Misplaced alignment tab character &', usually an ampersand in normal text, a title or a bibliography entry, and how to escape it."
category: "Fixing errors"
order: 20
updated: "2026-11-02"
tags: [latex, errors, tables, special characters, troubleshooting]
faq:
  - q: "What does Misplaced alignment tab character & mean?"
    a: "An & appeared outside a table or aligned equation. In LaTeX & is a column separator, so in ordinary text it must be written as \\&."
  - q: "How do I write an ampersand in LaTeX?"
    a: "Use \\& in text. Inside \\url{...} or verbatim text a plain & is fine."
  - q: "Why does my bibliography give Misplaced alignment tab?"
    a: "An entry has a bare & in a title, journal or publisher field, such as 'Taylor & Francis'. Change it to \\& in the .bib file."
---

:::takeaways
- `&` is a column separator, valid only in tables and aligned math.
- In normal text, write `\&`.
- Common sources: company names, titles, and `.bib` fields like "Taylor & Francis".
- Inside `\url{...}`, a plain `&` is fine.
:::

## The error

```text
! Misplaced alignment tab character &.
l.4 Smith &
            Jones wrote it.
```

The break in the `l.4` line sits right after the offending `&`.

## Cause 1: an ampersand in text

```latex
Smith & Jones wrote it.     % wrong
Smith \& Jones wrote it.    % right
```

The other characters LaTeX reserves work the same way: `\%`, `\$`, `\#`, `\_`, `\{`, `\}`.

## Cause 2: a bibliography field

The error points at the `.bbl` file or the `\bibliography` line, not your text.

```bibtex
publisher = {Taylor & Francis},    % wrong
publisher = {Taylor \& Francis},   % right
```

## Cause 3: an ampersand in a URL outside \url

```latex
https://example.com/?a=1&b=2          % wrong in plain text
\url{https://example.com/?a=1&b=2}    % right, with the url or hyperref package
```

## Cause 4: a table environment that did not start

If the `&` is in what you meant to be a table, the table itself may be broken: a misspelled environment, or a `tabular` inside a command that ended early. Check the `\begin{tabular}` line.

## Still stuck

- Related: [Extra alignment tab](./extra-alignment-tab) is the in-table version of this mistake.
- Related: [Missing $ inserted](./missing-dollar-inserted) covers `_` and `^` outside math.
