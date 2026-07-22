# glyphtex-engine

LaTeX → PDF in the browser and on the server. Wraps [Tectonic](https://tectonic-typesetting.github.io)
(XeTeX + xdvipdfmx) compiled to WebAssembly.

```ts
import { TexEngine } from 'glyphtex-engine';

const engine = await TexEngine.load(fetch('/tectonic.wasm'));

// The TeX bundle: document classes, packages, fonts, and the format file.
for (const [name, bytes] of bundle) engine.addFile(name, bytes);

engine.addFile('main.tex', String.raw`
  \documentclass{article}
  \begin{document}\section{Hello}\end{document}
`);

const result = engine.compile({ entry: 'main.tex', synctex: true });

if (result.status !== 'failed') {
  const pdf = engine.pdf();          // Uint8Array
}
for (const d of result.diagnostics) {
  console.log(`${d.severity} ${d.file ?? '?'}:${d.line ?? '?'} — ${d.message}`);
}
```

## Status is not a boolean

`compile()` resolves for any run that completed. `status` distinguishes four
outcomes, and only one of them means "no output":

| `status` | Meaning |
| --- | --- |
| `spotless` | No warnings or errors. |
| `warnings` | Warnings only — the overwhelmingly common case for real documents. |
| `errors` | TeX reported errors but recovered. **A PDF usually still exists.** |
| `failed` | Nothing was produced. `message` explains why. |

Treating `errors` as fatal would reject documents that TeX itself considers
publishable, so check `status !== 'failed'` before reading the PDF.

## Missing files are data, not exceptions

When the engine asks for a file that is not in the virtual filesystem, it is
reported in `result.missingFiles` rather than being guessed at or thrown:

```ts
const result = engine.compile({ entry: 'main.tex' });
if (result.missingFiles.length) {
  for (const name of result.missingFiles) {
    engine.addFile(name, await fetchPackage(name));
  }
  // Auxiliary files are retained, so the retry picks up where it left off.
  const retry = engine.compile({ entry: 'main.tex' });
}
```

This is the hook for on-demand package fetching. It is deliberately not an
error: a missing file is recoverable, and TeX has no graceful degradation for a
*wrong* one — substituting a near-match font silently corrupts output or hangs
the engine.

## Multi-file projects

Add every file, then point `entry` at the root. `\input`, `\include`, and
`\includegraphics` resolve against the same virtual filesystem.

```ts
engine.addFiles({
  'main.tex': mainSource,
  'chapters/intro.tex': introSource,
  'figures/plot.pdf': plotBytes,
  'refs.bib': bibSource
});
engine.compile({ entry: 'main.tex' });
```

## Options

All fields are optional; omitted ones take the Rust-side defaults. See
`CompileOptions` for the full list — it is generated from the Rust definitions,
so your editor's completions are authoritative.

| Option | Default | Notes |
| --- | --- | --- |
| `entry` | `main.tex` | Root document. |
| `jobname` | derived from `entry` | Base name for `.pdf`, `.log`, `.synctex`. |
| `maxPasses` / `minPasses` | `4` / `1` | Reruns stop once auxiliary files stop changing. |
| `haltOnError` | `false` | Matches `tectonic`: TeX recovers from most errors. |
| `synctex` | `false` | Emit `<jobname>.synctex`. |
| `outputFormat` | `pdf` | `xdv` skips xdvipdfmx and is faster. |
| `paper` | `letter` | e.g. `a4`. |
| `deterministic` | `false` | Byte-identical output across runs. |
| `logLevel` | `error` | `trace` logs every file open — very verbose. |

## Types come from Rust

The declarations in `src/generated/` are produced from the Rust definitions in
`crates/glyphtex-tex-api` by [ts-rs](https://github.com/Aleph-Alpha/ts-rs), so
they cannot drift from what the engine accepts.

```console
pnpm generate   # regenerate after changing the Rust types
```

That crate has no C dependencies and does not include the engine, so this works
on any machine — no Emscripten toolchain required.

## Not supported in WebAssembly

These need a subprocess, which does not exist in this sandbox:

- **`minted`** — needs Python/Pygments. Use `listings`, which is pure TeX.
- **`biber`** — a Perl program with no wasm build. `bibtex` runs in-process.
- **TikZ externalization** — needs shell escape.

`shellEscape` is exposed for API parity with a native build; it has no effect here.

## Tests

```console
pnpm build
GLYPHTEX_WASM=path/to/tectonic_wasm.wasm GLYPHTEX_BUNDLE=path/to/bundle pnpm test
```

The suite skips itself when those are absent.
