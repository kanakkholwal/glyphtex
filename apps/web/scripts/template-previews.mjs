// Compiles every template with the shipped engine and saves page 1 as WebP, so the gallery shows
// previews without the visitor downloading the engine. Run after `sync:engine` when templates change.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EnginePoisonedError, TexEngine } from "glyphtex-engine";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { TEMPLATE_CATALOG } from "../../../packages/ui/src/lib/project-templates/catalog.ts";
import { gunzip, untar } from "../src/lib/tex/tar.ts";
import { PREVIEW_WIDTH, previewFile } from "../src/lib/templates/preview.ts";
import { templateSlug } from "../src/lib/templates/slug.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const engineDir = join(root, "static/engine");
const sourcesDir = join(root, "../../packages/ui/src/lib/project-templates/sources");
const only = process.argv.slice(2);

if (!existsSync(join(engineDir, "tectonic_wasm.wasm"))) {
	throw new Error("previews: no engine in static/engine; run `pnpm sync:engine` first");
}

const wasm = readFileSync(join(engineDir, "tectonic_wasm.wasm"));
const files = [untar(await gunzip(readFileSync(join(engineDir, "tectonic-bundle.tar.gz"))))];
const packsDir = join(engineDir, "packs");
for (const name of existsSync(packsDir) ? readdirSync(packsDir) : []) {
	if (name.endsWith(".tar.gz")) files.push(untar(await gunzip(readFileSync(join(packsDir, name)))));
}

async function freshEngine() {
	const engine = await TexEngine.load(wasm);
	for (const set of files) engine.addFiles(set);
	return engine;
}

// Some classes open on a near-empty page (elsarticle's "Graphical Abstract"); show the first real one.
async function coverPage(doc) {
	for (let n = 1; n <= Math.min(3, doc.numPages); n++) {
		const page = await doc.getPage(n);
		const text = (await page.getTextContent()).items.map((i) => i.str ?? "").join("");
		// 40 keeps slide title pages (title, author, date) and skips one-heading cover pages.
		if (text.replace(/\s/g, "").length >= 40) return page;
	}
	return doc.getPage(1);
}

let engine = await freshEngine();
const failed = [];
const manifestPath = join(root, "src/lib/templates/previews.json");
// Kept across partial runs (`node scripts/template-previews.mjs <slug>`), so one slug never drops the rest.
const sizes = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
let written = 0;

for (const t of TEMPLATE_CATALOG) {
	const slug = templateSlug(t.id);
	if (only.length && !only.includes(slug)) continue;
	const source = readFileSync(join(sourcesDir, `${t.id}.tex`), "utf8");
	let pdf;
	try {
		engine.clearOutputs();
		engine.addFile("main.tex", source);
		const result = engine.compile({ entry: "main.tex", maxPasses: 3 });
		pdf = result.status === "failed" ? undefined : engine.pdf();
	} catch (error) {
		// An aborted compile leaves the instance unusable (AGENTS.md §6), so the next template gets a new one.
		if (!(error instanceof EnginePoisonedError)) throw error;
		engine = await freshEngine();
	}
	if (!pdf?.length) {
		failed.push(slug);
		continue;
	}

	const task = getDocument({ data: new Uint8Array(pdf), verbosity: 0, disableFontFace: true });
	const doc = await task.promise;
	const page = await coverPage(doc);
	const base = page.getViewport({ scale: 1 });
	const viewport = page.getViewport({ scale: PREVIEW_WIDTH / base.width });
	const { canvas, context } = doc.canvasFactory.create(
		Math.round(viewport.width),
		Math.round(viewport.height)
	);
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, canvas.width, canvas.height);
	await page.render({ canvas, canvasContext: context, viewport }).promise;
	const out = join(root, "static", previewFile(slug));
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, await canvas.encode("webp", 82));
	await task.destroy();
	sizes[slug] = { width: canvas.width, height: canvas.height };
	written++;
}

const sorted = Object.fromEntries(Object.entries(sizes).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(manifestPath, `${JSON.stringify(sorted, null, "\t")}\n`);
console.log(`previews: wrote ${written}${failed.length ? `, failed: ${failed.join(", ")}` : ""}`);
if (failed.length) process.exitCode = 1;
