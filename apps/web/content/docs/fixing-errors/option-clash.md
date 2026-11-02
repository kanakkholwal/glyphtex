---
title: "Fix: LaTeX Error: Option clash for package …"
description: "What 'LaTeX Error: Option clash for package hyperref' (or graphicx, xcolor) means: a package loaded twice with different options. How to merge them or pass options early."
category: "Fixing errors"
order: 21
updated: "2026-11-02"
tags: [latex, errors, packages, preamble, troubleshooting]
faq:
  - q: "What does Option clash for package mean in LaTeX?"
    a: "The same package was loaded twice, the second time with options the first did not have. LaTeX loads a package only once, so it cannot apply the new options."
  - q: "How do I fix Option clash for package xcolor?"
    a: "Load xcolor once with every option you need, or put \\PassOptionsToPackage{table}{xcolor} before \\documentclass when a class or another package loads it first."
---

:::takeaways
- A package was loaded twice with different options.
- LaTeX loads each package once, so the second set of options cannot apply.
- Fix 1: merge both loads into one `\usepackage` with all the options.
- Fix 2: if a class or another package loads it first, use `\PassOptionsToPackage` before `\documentclass`.
:::

## The error

```text
! LaTeX Error: Option clash for package hyperref.

See the LaTeX manual or LaTeX Companion for explanation.
```

## Cause 1: you load it twice

Common after pasting a preamble snippet from somewhere else.

```latex
\usepackage{hyperref}
...
\usepackage[colorlinks]{hyperref}   % second load, new option: clash
```

**Fix:** keep one load with all the options:

```latex
\usepackage[colorlinks]{hyperref}
```

Settings that a package also accepts after loading can go in its own setup command instead, for example `\hypersetup{colorlinks}` or `\captionsetup{font=small}`.

## Cause 2: something else loads it first

A class or package may load the package for you, without your options. `beamer` loads `xcolor`, `tikz` loads `xcolor` and `graphicx`, and many journal classes load `hyperref`.

**Fix:** pass your options before anything loads it:

```latex
\PassOptionsToPackage{table}{xcolor}
\documentclass{beamer}
```

Some classes also take the option directly: `\documentclass[xcolor=table]{beamer}`.

## Finding the first load

The second `\usepackage` is the one in the error. To find the first, search your preamble and any files it `\input`s for the package name; if there is only one, a class or another package loaded it.

## Still stuck

- Order matters for `hyperref`: load it last, after other packages, except the few that ask to come after it (like `cleveref`).
- Related: [Can be used only in preamble](./can-be-used-only-in-preamble).
