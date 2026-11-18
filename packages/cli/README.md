# glyphtex

Compile LaTeX to PDF from the command line. No TeX install, no server, no account.
Built for people writing a resume or a thesis, and for agents that write LaTeX and need to
check it compiles.

```console
npx glyphtex build main.tex
```

It runs the same engine as the [GlyphTeX](https://glyphtex.nexonauts.com) editor: XeTeX,
xdvipdfmx and BibTeX compiled to WebAssembly, with the LaTeX format and common packages
included. Needs Node 20.6 or newer.

## Commands

| Command | Does |
| --- | --- |
| `glyphtex build [file.tex \| folder]` | Compile once and write the PDF next to the source |
| `glyphtex watch [file.tex \| folder]` | Rebuild on every change, keeping the engine loaded |
| `glyphtex doctor` | Check Node, the engine, the bundle and the optional native engine |
| `glyphtex engine install` | Download the optional native Tectonic, with a progress bar |

A folder builds `main.tex`, or the only file in it that begins a document. `glyphtex main.tex` is
shorthand for `glyphtex build main.tex`.

Options for `build` and `watch`:

| Option | Meaning |
| --- | --- |
| `-o, --output <file>` | Where to write the PDF |
| `--json` | One JSON object on stdout; progress stays on stderr |
| `--log` | Also write the TeX log next to the PDF |
| `--synctex` | Also write a `.synctex` file |
| `--engine wasm\|native` | Built-in engine (default) or a downloaded native Tectonic |
| `-q, --quiet` | Print only errors |
| `--no-color` | Plain output |

## For agents

Run `glyphtex build . --json` and read stdout. It is always a single JSON object, and the exit code
says the same thing: `0` built cleanly, `1` TeX errors or no PDF, `2` bad usage, `3` the engine could
not start.

```json
{
  "ok": false,
  "status": "errors",
  "entry": "main.tex",
  "pdf": "/work/main.pdf",
  "bytes": 2934,
  "passes": 2,
  "durationMs": 520,
  "engine": "wasm",
  "diagnostics": [
    { "severity": "error", "file": "main.tex", "line": 3, "message": "Undefined control sequence." }
  ],
  "missingFiles": [],
  "unsupported": [],
  "packsLoaded": ["writing"],
  "logPath": null,
  "message": null
}
```

- `diagnostics` carries every error and warning with file and line, so a fix can target the exact line.
- `missingFiles` lists package or class files TeX could not find; `unsupported` is the subset the engine
  cannot provide at all. Ask for a package at
  [github.com/kanakkholwal/glyphtex/issues](https://github.com/kanakkholwal/glyphtex/issues).
- Field names are stable. New fields may be added; none will be renamed or removed without a major version.
- `glyphtex watch --json` prints one such line per rebuild.

## Engines

- **wasm** (default): ships in the package, runs anywhere Node runs, works offline. Packages come from the
  bundled sets, loaded only when your document uses them.
- **native**: `glyphtex engine install` downloads the pinned [Tectonic](https://tectonic-typesetting.github.io)
  once (about 19 MB) into your cache. It fetches any TeX package on demand, so coverage is the full set. The
  first build is slower while packages download; later ones are cached.

The cache is `~/.cache/glyphtex` (or `%LOCALAPPDATA%\glyphtex` on Windows). Set `GLYPHTEX_HOME` to move it, or
`GLYPHTEX_TECTONIC_BIN` to use your own Tectonic.

## Limits of the built-in engine

`minted` (needs Python), `biber` (use `biblatex` with `backend=bibtex`), shell escape and TikZ
externalisation, system fonts (add `.ttf` or `.otf` files to the project) and `xeCJK`. The `--engine native`
route covers most of these except shell-dependent packages.

## Releasing (maintainers)

The first version is published once from a maintainer machine, because npm trusted publishing can only be set
up for a package that already exists:

```console
npm login
pnpm --filter glyphtex-engine build
cd packages/cli
pnpm test
pnpm publish --access public --no-git-checks
```

Then on npmjs.com open the package, Settings, Trusted Publisher, and add GitHub repo
`kanakkholwal/glyphtex` with workflow `cli.yml`. After that, bump `version` in `package.json` and merge to
`main`: the workflow tests on Linux, Windows and macOS, publishes, and creates the `cli-v<version>` release.

## Licence

MIT.
