---
title: "glyphtex CLI: compile LaTeX from the terminal or an agent"
description: "Run npx glyphtex build to compile LaTeX to PDF with no TeX install. Watch mode, JSON output for agents, exit codes, the built-in and native engines, and what to do when a package is missing."
category: "glyphtex (CLI)"
order: 5
updated: "2026-11-18"
faq:
  - q: "How do I compile LaTeX without installing TeX?"
    a: "Run npx glyphtex build main.tex. The CLI includes the engine (Tectonic's XeTeX as WebAssembly) and the common packages, so the only requirement is Node 20.6 or newer."
  - q: "Can an AI agent use it to check a LaTeX document?"
    a: "Yes. glyphtex build . --json prints one JSON object on stdout with the PDF path and every error and warning with file and line. The exit code is 0 for a clean build and 1 for TeX errors."
  - q: "Does it need an account or a server?"
    a: "No. It is free, runs on your machine and sends nothing anywhere. The only network use is the optional one-time download of the native engine."
  - q: "What if a package is missing?"
    a: "The JSON lists it under missingFiles. Try glyphtex engine install and build with --engine native, which fetches any TeX package on demand, or request the package on GitHub."
---

:::takeaways
- `npx glyphtex build main.tex` writes `main.pdf`. No TeX install, no account.
- `--json` gives agents one parseable result with file and line for every error.
- `glyphtex watch` rebuilds on save and keeps the engine loaded.
- An optional native engine downloads once with a progress bar and covers every TeX package.
:::

## Build a document

```bash
npx glyphtex build main.tex
npx glyphtex build .            # a folder: main.tex, or the one file that starts a document
npx glyphtex build main.tex -o dist/cv.pdf --log
```

Every file in the folder is available to the build, so `\input`, `\includegraphics` and `\bibliography` work
as with a local TeX install. The first run unpacks the bundle in about a second and loads only the package sets
your document uses.

## Watch while you write

```bash
npx glyphtex watch .
```

It rebuilds when a source file changes and ignores its own output. With `--json` it prints one result per rebuild.

## Use it from an agent

```bash
glyphtex build . --json
```

Stdout is always a single JSON object; progress and logs go to stderr.

```json
{
  "ok": false,
  "status": "errors",
  "pdf": "/work/main.pdf",
  "diagnostics": [
    { "severity": "error", "file": "main.tex", "line": 3, "message": "Undefined control sequence." }
  ],
  "missingFiles": [],
  "passes": 2,
  "durationMs": 520
}
```

| Exit code | Meaning |
| --- | --- |
| 0 | Built with no TeX errors |
| 1 | TeX errors, or no PDF |
| 2 | Bad usage: unknown option, path not found |
| 3 | The engine could not start. Run `glyphtex doctor` |

A good loop for an agent is: write the `.tex`, run `build --json`, read `diagnostics`, fix the lines named, and
repeat until `ok` is true. Field names are stable across minor versions.

## Engines

The built-in engine ships in the package and works offline. For packages it does not include, or to use
Tectonic's own package fetching, install the native engine once:

```bash
npx glyphtex engine install     # about 19 MB, with a live progress bar
npx glyphtex build main.tex --engine native
```

The first native build downloads the TeX packages it needs, so it is slower; later builds are cached. Set
`GLYPHTEX_HOME` to move the cache, or `GLYPHTEX_TECTONIC_BIN` to use your own Tectonic.

## Check your setup

`glyphtex doctor` verifies Node, the engine, the bundle and the native engine, and says how to fix anything
missing. `glyphtex doctor --json` prints the same checks for scripts.

## Limits

The built-in engine does not run `minted` (needs Python), `biber` (use `biblatex` with `backend=bibtex`), shell
escape or TikZ externalisation, and it cannot see system fonts: put `.ttf` or `.otf` files in the project and load
them with `fontspec` by file name.
