// Compile a LaTeX document to PDF in Node, using only what the npm package ships.
//
//   npm install glyphtex-engine
//   node node-compile.mjs            # writes hello.pdf
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defaultPacks, parsePackIndex, TexEngine, unpackTarGz } from "glyphtex-engine";

// The package exports its assets, so resolve them instead of hard-coding paths.
const asset = (specifier) => readFile(fileURLToPath(import.meta.resolve(specifier)));

const engine = await TexEngine.load(await asset("glyphtex-engine/wasm"));

// The TeX bundle: the LaTeX format, classes, core packages and fonts.
engine.addFiles(await unpackTarGz(await asset("glyphtex-engine/bundle")));

// Package sets (fancyhdr, tcolorbox, biblatex…). Load the default ones up front.
const index = parsePackIndex(JSON.parse(await asset("glyphtex-engine/packs/index.json")));
for (const pack of defaultPacks(index)) {
	engine.addFiles(await unpackTarGz(await asset(`glyphtex-engine/packs/pack-${pack.id}.tar.gz`)));
}

engine.addFiles({
	"main.tex": String.raw`\documentclass{article}
\usepackage{amsmath}
\usepackage[backend=bibtex]{biblatex}
\addbibresource{refs.bib}
\begin{document}
\section{Hello from WebAssembly}
Euler: $e^{i\pi} + 1 = 0$, as in \cite{euler}.
\printbibliography
\end{document}`,
	"refs.bib": "@book{euler, author={Leonhard Euler}, title={Introductio}, year={1748}}"
});

const result = engine.compile({ entry: "main.tex" });
for (const d of result.diagnostics) {
	console.log(`${d.severity}: ${d.file ?? "?"}:${d.line ?? "?"} ${d.message}`);
}

// `failed` is the only status without a PDF; `errors` usually still has one.
if (result.status === "failed") {
	console.error(result.message, result.missingFiles);
	process.exit(1);
}
await writeFile("hello.pdf", engine.pdf());
console.log(`${result.status} after ${result.passesRun} passes, wrote hello.pdf`);
