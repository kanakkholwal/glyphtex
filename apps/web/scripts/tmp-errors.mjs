import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EnginePoisonedError, TexEngine } from "glyphtex-engine";
import { gunzip, untar } from "../src/lib/tex/tar.ts";

const dir = "static/engine";
const sets = [untar(await gunzip(readFileSync(join(dir, "tectonic-bundle.tar.gz"))))];
for (const n of readdirSync(join(dir, "packs")))
	if (n.endsWith(".tar.gz")) sets.push(untar(await gunzip(readFileSync(join(dir, "packs", n)))));
const wasm = readFileSync(join(dir, "tectonic_wasm.wasm"));
const fresh = async () => {
	const e = await TexEngine.load(wasm);
	for (const s of sets) e.addFiles(s);
	return e;
};

const D = (pre, body) => `\\documentclass{article}\n${pre}\n\\begin{document}\n${body}\n\\end{document}\n`;
const cases = {
	envUndefined: D("", "\\begin{algorithm}\nx\n\\end{algorithm}"),
	missingBegin: "\\documentclass{article}\n\\usepackage{amsmath}\nHello\n\\begin{document}\nx\n\\end{document}\n",
	runaway: D("", "\\textbf{bold\n\nmore} text"),
	fileEnded: D("", "\\footnote{never closed"),
	overfull: D("", "A verylongwordthatcannotbehyphenatedanywhereatallbecauseitistoolongforthelinewidthsurely and more text here."),
	refUndefined: D("", "See Figure~\\ref{fig:plot}."),
	extraTab: D("", "\\begin{tabular}{ll}\na & b & c \\\\\n\\end{tabular}"),
	misplacedTab: D("", "Smith & Jones wrote it."),
	optionClash: "\\documentclass{article}\n\\usepackage{xcolor}\n\\usepackage[table]{xcolor}\n\\begin{document}\nx\n\\end{document}\n",
	preambleOnly: D("", "\\usepackage{amsmath}\nx"),
	missingChar: D("", "Emoji: 😀 and Chinese: 中文."),
	missingBrace: D("", "$\\frac{1}{2$ text"),
	extraBrace: D("", "text}} more")
};

let engine = await fresh();
for (const [name, src] of Object.entries(cases)) {
	let log = "";
	try {
		engine.clearOutputs();
		engine.addFile("main.tex", src);
		const r = engine.compile({ entry: "main.tex", maxPasses: 3 });
		log = engine.log() ?? "";
		console.log(`===== ${name} status=${r.status}`);
	} catch (e) {
		if (!(e instanceof EnginePoisonedError)) throw e;
		console.log(`===== ${name} POISONED`);
		engine = await fresh();
		continue;
	}
	const lines = log.split("\n");
	lines.forEach((l, i) => {
		if (/^!|LaTeX Warning|Overfull|Underfull|Missing character|Runaway|Package .* Error/.test(l))
			console.log(lines.slice(i, i + 3).join("\n"));
	});
}
