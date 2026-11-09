---
title: "Move your projects from Overleaf or OpenAI Prism"
description: "Export a LaTeX project from Overleaf or OpenAI Prism as a .zip and open it in GlyphTeX: what carries over, how the main file is chosen, and what to check before Prism shuts down on January 1, 2027."
category: "Getting started"
order: 2
updated: "2026-11-04"
tags: [overleaf, prism, import, migration, latex]
faq:
  - q: "How do I move a project from Overleaf to GlyphTeX?"
    a: "In Overleaf, open the project, open the Menu and choose Download, Source. Then drop the .zip on the GlyphTeX projects page or use Import, Import .zip. Every file and folder comes across as it was."
  - q: "When does OpenAI Prism shut down?"
    a: "OpenAI announced that Prism shuts down on January 1, 2027 and that project data is deleted after that date. Export every project you want to keep before then."
  - q: "Will my imported project compile?"
    a: "Most do. GlyphTeX compiles with XeTeX in the browser, so documents that need Biber, shell escape (minted), or packages outside its bundle need a small change. The Problems panel names what is missing."
---

:::takeaways
- Export the project as a .zip, then drop it on the GlyphTeX projects page. Folders and images keep their paths.
- GlyphTeX picks the main file: `main.tex` first, otherwise the file with `\documentclass`. You can change it.
- Prism shuts down on January 1, 2027 and deletes project data after that. Export now.
- Nothing is uploaded: the import and every compile happen in your browser.
:::

## Export from Overleaf

1. Open the project in Overleaf.
2. Open **Menu** (top left) and choose **Download → Source**. You get one `.zip` with every file.
3. Repeat for each project. Overleaf has no bulk export, so start with the ones you still edit.

Overleaf's Git integration and GitHub sync also work as an export: clone the repository and import the folder.

## Export from OpenAI Prism

OpenAI [announced](https://community.openai.com/t/prism-will-shut-down-on-january-1-2027/1411150) that Prism shuts down on **January 1, 2027** and that project data is deleted after that date. Use Prism's own export to download each project as a `.zip` (or its files as a folder) before then.

## Import into GlyphTeX

1. Open [your projects](/workspace).
2. Drop the `.zip` anywhere on the page, or choose **Import → Import .zip**. A folder works the same way with **Import folder**.
3. GlyphTeX opens the project. If more than one file could be the main document, it asks which one to compile.

A `.zip` that wraps everything in one top folder is unwrapped, so `paper/main.tex` becomes `main.tex`. Build output (`.aux`, `.log`, `.synctex.gz`) and `__MACOSX` folders are skipped.

## What to check after importing

| Symptom | Why | Fix |
| --- | --- | --- |
| "Package biblatex: Biber not found" | Biber can't run in a browser. | Load biblatex with `backend=bibtex`, or switch to natbib. See [bibliographies](/docs/writing/bibliographies). |
| `File ... .sty not found` | The package isn't in the engine bundle. | Check [supported packages](/packages) and request it there. See [file not found](/docs/fixing-errors/file-not-found). |
| `minted` or `svg` fails | They run external programs (shell escape). | Use `listings` for code, and convert SVG figures to PDF. |
| EPS figures don't show | Converting EPS needs Ghostscript. | Convert them to PDF before importing. |

## Sharing again

Overleaf and Prism projects are often shared. In GlyphTeX, sharing needs a GlyphTeX server: open the project, choose **Share**, and save a copy to the cloud. Collaborators get an email invite or a link with the role you pick. Without a server, the project stays in your browser and nobody else can see it.
