// A tiny LaTeX compiler CLI: compile a project folder to PDF.
//
//   node compile-dir.mjs <project-dir> [main.tex]
//
// Every file under the folder is added with its relative path, so \input, \include,
// \includegraphics and \bibliography work as they do with a local TeX install.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultPacks, parsePackIndex, TexEngine, unpackTarGz } from "glyphtex-engine";

const [dir, entry = "main.tex"] = process.argv.slice(2);
if (!dir) {
	console.error("usage: node compile-dir.mjs <project-dir> [main.tex]");
	process.exit(2);
}

const asset = (specifier) => readFile(fileURLToPath(import.meta.resolve(specifier)));

async function* walk(root) {
	for (const item of await readdir(root, { withFileTypes: true })) {
		const path = join(root, item.name);
		if (item.isDirectory()) yield* walk(path);
		else if (item.isFile()) yield path;
	}
}

const engine = await TexEngine.load(await asset("glyphtex-engine/wasm"));
engine.addFiles(await unpackTarGz(await asset("glyphtex-engine/bundle")));
const index = parsePackIndex(JSON.parse(await asset("glyphtex-engine/packs/index.json")));
for (const pack of defaultPacks(index)) {
	engine.addFiles(await unpackTarGz(await asset(`glyphtex-engine/packs/pack-${pack.id}.tar.gz`)));
}

let count = 0;
for await (const path of walk(dir)) {
	// The engine's paths are always forward-slashed, whatever the host OS.
	engine.addFile(relative(dir, path).split(sep).join("/"), await readFile(path));
	count++;
}

const result = engine.compile({ entry });
for (const d of result.diagnostics.filter((d) => d.severity !== "info")) {
	console.log(`${d.file ?? entry}:${d.line ?? "?"}: ${d.severity}: ${d.message}`);
}
if (result.status === "failed") {
	console.error(`failed: ${result.message}`);
	if (result.missingFiles.length) console.error("missing:", result.missingFiles.join(", "));
	process.exit(1);
}

const out = join(dir, entry.replace(/\.tex$/, ".pdf"));
await writeFile(out, engine.pdf());
console.log(`${result.status}: ${count} files, ${result.passesRun} passes -> ${out}`);
