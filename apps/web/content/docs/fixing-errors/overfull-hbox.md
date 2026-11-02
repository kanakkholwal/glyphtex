---
title: "Fix: Overfull \\hbox (… too wide) in paragraph"
description: "What the LaTeX warning 'Overfull \\hbox (12pt too wide) in paragraph at lines 10--12' means, when you can ignore it, and five ways to fix text running into the margin."
category: "Fixing errors"
order: 17
updated: "2026-11-02"
tags: [latex, warnings, layout, troubleshooting]
faq:
  - q: "What does Overfull \\hbox mean in LaTeX?"
    a: "A line came out wider than the text block, so it sticks into the right margin. LaTeX could not find a good place to break it, usually because of a long word, URL or unbreakable box."
  - q: "Can I ignore Overfull \\hbox warnings?"
    a: "Small ones (under about 1pt) are invisible and safe to ignore. Larger ones show as text poking into the margin and are worth fixing, especially in a thesis or a submission."
  - q: "How do I fix an overfull hbox caused by a URL?"
    a: "Load the url or hyperref package and write the address with \\url{...}, which lets it break at slashes and dots."
---

:::takeaways
- It is a warning, not an error: the PDF still builds.
- A line is wider than the text block and pokes into the margin.
- The number says how far: `79pt too wide` is obvious, `0.3pt` is invisible.
- Common causes: long words, URLs, code, and tables or images wider than the page.
- `microtype` fixes many small ones with no other changes.
:::

## The warning

```text
Overfull \hbox (79.26889pt too wide) in paragraph at lines 4--5
[]\TU/lmr/m/n/10 A verylongwordthatcannotbehyphenatedanywhere...
```

The line range (`lines 4--5`) is in your source file. The text after it is the line as typeset, so you can search for it.

## Fix 1: load microtype

```latex
\usepackage{microtype}
```

It adjusts letter spacing slightly and lets punctuation hang into the margin. Most warnings of a few points disappear, and the text usually looks better too.

## Fix 2: show LaTeX where a word can break

LaTeX cannot hyphenate words it does not know, like product names or chemistry.

```latex
super\-cali\-fragilistic     % allowed break points, here only
\hyphenation{Glyph-TeX data-set}   % in the preamble, for every use
```

## Fix 3: typeset URLs and paths with \url

```latex
\usepackage{url}             % or hyperref, which includes it
\url{https://example.com/a/very/long/path}
```

## Fix 4: make wide tables and figures fit

```latex
\includegraphics[width=\linewidth]{plot.png}   % never wider than the text

\usepackage{tabularx}
\begin{tabularx}{\linewidth}{lX}               % X columns wrap
```

## Fix 5: relax spacing in one paragraph

As a last resort for a single stubborn paragraph:

```latex
\begin{sloppypar}
A paragraph with an unbreakable term in it.
\end{sloppypar}
```

Avoid `\sloppy` for the whole document: it trades margin overruns for big gaps between words.

## The opposite warning

```text
Underfull \hbox (badness 10000) in paragraph
```

This means a line is too loose, not too wide. The usual cause is `\\` used to end a paragraph, or after a blank line. Use a blank line for a new paragraph and `\par\medskip` for extra space.

## Still stuck

- Very small overruns are fine to leave. Fix the ones you can see in the PDF.
- Related: [Reference undefined](./reference-undefined), another warning that still builds a PDF.
