import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { deflateRawSync } from "node:zlib";

import { formatOptions, parseArgs } from "../dist/args.js";
import { readFromZip } from "../dist/extract.js";
import { parseTectonicOutput, targetTriple } from "../dist/native.js";
import { looksLikeRoot, resolveProject, usedPackages, UsageError } from "../dist/project.js";
import { detectColor, formatBytes, formatDuration, renderBar } from "../dist/ui.js";

const specs = {
	output: { type: "string", short: "o", description: "out" },
	json: { type: "boolean", description: "json" },
	quiet: { type: "boolean", short: "q", description: "q" }
};

describe("parseArgs", () => {
	test("positionals, flags, short flags and --flag=value", () => {
		const r = parseArgs(["main.tex", "--json", "-o", "out.pdf", "-q"], specs);
		assert.deepEqual(r.positionals, ["main.tex"]);
		assert.deepEqual(r.flags, { json: true, output: "out.pdf", quiet: true });
		assert.equal(parseArgs(["--output=a.pdf"], specs).flags.output, "a.pdf");
	});

	test("unknown flags are errors, never ignored", () => {
		assert.match(parseArgs(["--jsno"], specs).error ?? "", /Unknown option --jsno/);
		assert.match(parseArgs(["-z"], specs).error ?? "", /Unknown option -z/);
	});

	test("a string flag needs a value and a boolean takes none", () => {
		assert.match(parseArgs(["-o"], specs).error ?? "", /needs a value/);
		assert.match(parseArgs(["-o", "--json"], specs).error ?? "", /needs a value/);
		assert.match(parseArgs(["--json=maybe"], specs).error ?? "", /takes no value/);
	});

	test("-- ends flag parsing", () => {
		assert.deepEqual(parseArgs(["--", "--weird.tex"], specs).positionals, ["--weird.tex"]);
	});

	test("help text lists every option", () => {
		const text = formatOptions(specs);
		assert.match(text, /-o, --output <value>/);
		assert.match(text, /--json/);
	});
});

describe("project resolution", () => {
	async function folder(files) {
		const dir = await mkdtemp(join(tmpdir(), "glyphtex-cli-"));
		for (const [name, body] of Object.entries(files)) {
			await mkdir(join(dir, name, ".."), { recursive: true });
			await writeFile(join(dir, name), body);
		}
		return dir;
	}
	const doc = "\\documentclass{article}\\begin{document}x\\end{document}";

	test("a folder with main.tex builds main.tex", async () => {
		const dir = await folder({ "main.tex": doc, "other.tex": doc });
		assert.equal((await resolveProject(dir)).entry, "main.tex");
		await rm(dir, { recursive: true });
	});

	test("a folder with one document resolves to it, and chapters are not roots", async () => {
		const dir = await folder({ "thesis.tex": doc, "chapter1.tex": "\\section{One}" });
		assert.equal((await resolveProject(dir)).entry, "thesis.tex");
		await rm(dir, { recursive: true });
	});

	test("several documents is an error that names them", async () => {
		const dir = await folder({ "a.tex": doc, "b.tex": doc });
		await assert.rejects(
			resolveProject(dir),
			(e) => e instanceof UsageError && /a\.tex, b\.tex/.test(e.message)
		);
		await rm(dir, { recursive: true });
	});

	test("a file target uses its own folder as the root", async () => {
		const dir = await folder({ "paper.tex": doc });
		const p = await resolveProject(join(dir, "paper.tex"));
		assert.deepEqual([p.entry, p.root], ["paper.tex", dir]);
		await rm(dir, { recursive: true });
	});

	test("missing paths and non-tex files are usage errors", async () => {
		await assert.rejects(resolveProject("definitely-not-here"), UsageError);
		const dir = await folder({ "notes.md": "x" });
		await assert.rejects(resolveProject(join(dir, "notes.md")), /not a .tex file/);
		await assert.rejects(resolveProject(dir), /No LaTeX document/);
		await rm(dir, { recursive: true });
	});

	test("looksLikeRoot needs a class and a body", () => {
		assert.equal(looksLikeRoot(doc), true);
		assert.equal(looksLikeRoot("\\section{x}"), false);
		assert.equal(looksLikeRoot("\\documentclass{article}"), false);
	});
});

describe("usedPackages", () => {
	test("reads lists and options, and ignores comments", () => {
		const names = usedPackages([
			"\\usepackage{amsmath,amssymb}\n\\usepackage[utf8]{inputenc}\n% \\usepackage{commented}\n\\RequirePackage{xcolor}",
			"\\usepackage [margin=1in] { geometry }"
		]);
		assert.deepEqual(names, ["amsmath", "amssymb", "geometry", "inputenc", "xcolor"]);
	});

	test("an escaped percent does not start a comment", () => {
		assert.deepEqual(usedPackages(["100\\% sure \\usepackage{tikz}"]), ["tikz"]);
	});
});

describe("terminal helpers", () => {
	test("byte and time formatting", () => {
		assert.equal(formatBytes(512), "512 B");
		assert.equal(formatBytes(2048), "2.0 KB");
		assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
		assert.equal(formatDuration(420), "420 ms");
		assert.equal(formatDuration(2500), "2.5 s");
	});

	test("the progress bar fills with the ratio and shows speed and eta", () => {
		const half = renderBar({ done: 50, total: 100, width: 10 });
		assert.match(half, /^█████░░░░░ {2}50%/);
		const timed = renderBar({ done: 50, total: 100, width: 10, bytesPerSecond: 25 });
		assert.match(timed, /25 B\/s {2}eta 2\.0 s/);
		assert.equal(
			renderBar({ done: 2048, total: undefined }),
			"2.0 KB",
			"unknown total shows bytes only"
		);
		assert.match(renderBar({ done: 999, total: 100, width: 4 }), /100%/, "never overflows");
	});

	test("colour honours NO_COLOR, FORCE_COLOR and terminals", () => {
		assert.equal(detectColor({ NO_COLOR: "1" }, true), false);
		assert.equal(detectColor({ FORCE_COLOR: "1" }, false), true);
		assert.equal(detectColor({}, true), true);
		assert.equal(detectColor({}, false), false);
		assert.equal(detectColor({ TERM: "dumb" }, true), false);
	});
});

describe("native engine helpers", () => {
	test("release triples match the desktop build matrix", () => {
		assert.equal(targetTriple("win32", "x64"), "x86_64-pc-windows-msvc");
		assert.equal(targetTriple("darwin", "arm64"), "aarch64-apple-darwin");
		assert.equal(targetTriple("darwin", "x64"), "x86_64-apple-darwin");
		assert.equal(targetTriple("linux", "x64"), "x86_64-unknown-linux-gnu");
		assert.equal(targetTriple("freebsd", "x64"), null);
	});

	test("Tectonic's error and warning lines become diagnostics", () => {
		const out = parseTectonicOutput(
			[
				"Running TeX ...",
				"warning: main.tex:7: Overfull \\hbox",
				"error: main.tex:12: Undefined control sequence",
				"error: halted on potentially-recoverable error as specified",
				"note: see the log"
			].join("\n")
		);
		assert.deepEqual(out[0], {
			severity: "warning",
			file: "main.tex",
			line: 7,
			message: "Overfull \\hbox"
		});
		assert.deepEqual(out[1], {
			severity: "error",
			file: "main.tex",
			line: 12,
			message: "Undefined control sequence"
		});
		assert.equal(out[2]?.file, null);
		assert.equal(out[3]?.severity, "info");
	});
});

describe("zip reading", () => {
	/** A one-entry zip, built by hand so the test needs no tools. */
	function zip(name, content, method) {
		const data = Buffer.from(content);
		const body = method === 8 ? deflateRawSync(data) : data;
		const nameBuf = Buffer.from(name);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(method, 8);
		local.writeUInt32LE(body.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(nameBuf.length, 26);
		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(method, 10);
		central.writeUInt32LE(body.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(nameBuf.length, 28);
		central.writeUInt32LE(0, 42);
		const eocd = Buffer.alloc(22);
		eocd.writeUInt32LE(0x06054b50, 0);
		eocd.writeUInt16LE(1, 8);
		eocd.writeUInt16LE(1, 10);
		const cdSize = central.length + nameBuf.length;
		eocd.writeUInt32LE(cdSize, 12);
		eocd.writeUInt32LE(local.length + nameBuf.length + body.length, 16);
		return new Uint8Array(Buffer.concat([local, nameBuf, body, central, nameBuf, eocd]));
	}

	test("reads stored and deflated entries by file name, ignoring folders", () => {
		const text = "tectonic binary bytes ".repeat(50);
		for (const method of [0, 8]) {
			const found = readFromZip(zip("release/tectonic.exe", text, method), "tectonic.exe");
			assert.equal(Buffer.from(found ?? []).toString(), text, `method ${method}`);
		}
	});

	test("a missing entry is null and garbage is an error", () => {
		assert.equal(readFromZip(zip("a.txt", "x", 0), "b.txt"), null);
		assert.throws(() => readFromZip(new Uint8Array(100), "x"), /not a valid .zip/);
	});
});
