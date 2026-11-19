import { strict as assert } from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const bin = fileURLToPath(new URL("../bin/glyphtex.mjs", import.meta.url));
const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));
const made = [];

/** A scratch copy of a fixture, so builds never write PDFs into the repository. */
async function scratch(name) {
	const dir = await mkdtemp(join(tmpdir(), "glyphtex-e2e-"));
	made.push(dir);
	await cp(join(fixtures, name), dir, { recursive: true });
	return dir;
}

const run = (args, options = {}) =>
	spawnSync(process.execPath, [bin, ...args], {
		encoding: "utf8",
		env: { ...process.env, NO_COLOR: "1", GLYPHTEX_HOME: join(tmpdir(), "glyphtex-e2e-home") },
		...options
	});

after(async () => {
	for (const dir of made) await rm(dir, { recursive: true, force: true });
});

describe("glyphtex build", () => {
	test("compiles a document with packages and reports it as JSON on stdout", async () => {
		const dir = await scratch("resume");
		const r = run(["build", dir, "--json"]);
		assert.equal(r.status, 0, r.stderr);
		const report = JSON.parse(r.stdout);
		assert.equal(report.ok, true);
		assert.equal(report.engine, "wasm");
		assert.equal(report.entry, "main.tex");
		assert.ok(report.passes >= 1);
		assert.ok(report.packsLoaded.includes("writing"), "fancyhdr lives in the writing pack");
		const pdf = await readFile(report.pdf);
		assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
		assert.equal(pdf.length, report.bytes);
	});

	test("stdout carries only the JSON object; progress stays on stderr", async () => {
		const dir = await scratch("resume");
		const r = run(["build", dir, "--json"]);
		assert.doesNotThrow(() => JSON.parse(r.stdout));
		assert.match(r.stderr, /Compiled main\.tex/);
	});

	test("a TeX error exits 1 with the file, line and message", async () => {
		const dir = await scratch("broken");
		const r = run(["build", dir, "--json"]);
		assert.equal(r.status, 1);
		const report = JSON.parse(r.stdout);
		assert.equal(report.ok, false);
		const error = report.diagnostics.find((d) => d.severity === "error");
		assert.deepEqual([error.file, error.line], ["main.tex", 3]);
		assert.match(error.message, /Undefined control sequence/);
	});

	test("human output shows the offending source line", async () => {
		const dir = await scratch("broken");
		const r = run(["build", dir]);
		assert.equal(r.status, 1);
		assert.match(r.stderr, /main\.tex:3/);
		assert.match(r.stderr, /Hello \\undefinedcommand/);
	});

	test("a bibliography builds in several passes", async () => {
		const dir = await scratch("bib");
		const report = JSON.parse(run(["build", dir, "--json"]).stdout);
		assert.equal(report.ok, true);
		assert.ok(report.passes >= 3, `passes: ${report.passes}`);
	});

	test("--output and --log choose where files go", async () => {
		const dir = await scratch("resume");
		const out = join(dir, "dist", "cv.pdf");
		const report = JSON.parse(run(["build", dir, "-o", out, "--log", "--json"]).stdout);
		assert.equal(report.pdf, out);
		assert.equal(report.logPath, join(dir, "dist", "cv.log"));
		assert.match(await readFile(report.logPath, "utf8"), /LaTeX2e/);
	});

	test("a file target and the bare shorthand both work", async () => {
		const dir = await scratch("resume");
		assert.equal(run(["build", join(dir, "main.tex"), "--json"]).status, 0);
		assert.equal(run([join(dir, "main.tex"), "--json"]).status, 0);
	});

	test("--quiet prints nothing on success", async () => {
		const dir = await scratch("resume");
		const r = run(["build", dir, "--quiet"]);
		assert.equal(r.status, 0);
		assert.equal(r.stderr.trim(), "");
	});
});

describe("template helper packages", () => {
	test("fullpage, makecell, subfiles and algorithmic build, and a subfile builds on its own", async () => {
		const dir = await scratch("helpers");
		const main = JSON.parse(run(["build", join(dir, "main.tex"), "--json"]).stdout);
		assert.equal(main.ok, true, JSON.stringify(main.diagnostics));
		assert.ok(main.packsLoaded.includes("template-helpers"));
		assert.deepEqual(main.missingFiles, []);
		const sub = JSON.parse(run(["build", join(dir, "sub.tex"), "--json"]).stdout);
		assert.equal(sub.ok, true, JSON.stringify(sub.diagnostics));
	});
});

describe("usage errors", () => {
	test("unknown option, missing path and bad engine exit 2", async () => {
		assert.equal(run(["build", "--nope"]).status, 2);
		assert.equal(run(["build", "does-not-exist.tex"]).status, 2);
		const dir = await scratch("resume");
		const r = run(["build", dir, "--engine", "latex"]);
		assert.equal(r.status, 2);
		assert.match(r.stderr, /wasm or native/);
	});

	test("an unknown command exits 2 and suggests help", () => {
		const r = run(["frobnicate"]);
		assert.equal(r.status, 2);
		assert.match(r.stderr, /glyphtex --help/);
	});

	test("--help and --version exit 0", () => {
		const help = run(["--help"]);
		assert.equal(help.status, 0);
		assert.match(help.stdout, /glyphtex build/);
		assert.match(help.stdout, /--json/);
		assert.match(run(["--version"]).stdout, /^\d+\.\d+\.\d+/);
	});
});

describe("glyphtex doctor", () => {
	test("reports ready with the engine and bundle present", () => {
		const r = run(["doctor", "--json"]);
		assert.equal(r.status, 0, r.stderr);
		const report = JSON.parse(r.stdout);
		assert.equal(report.ok, true);
		const names = report.checks.map((c) => c.name);
		assert.ok(names.includes("WebAssembly engine") && names.includes("TeX bundle"));
		assert.ok(report.checks.every((c) => c.status !== "fail"));
	});

	test("human output ends with a verdict", () => {
		assert.match(run(["doctor"]).stderr, /Ready to build/);
	});
});

describe("glyphtex watch", () => {
	test("rebuilds when a file changes, one JSON line per build", async () => {
		const dir = await scratch("resume");
		const child = spawn(process.execPath, [bin, "watch", dir, "--json"], {
			env: { ...process.env, NO_COLOR: "1" }
		});
		let stdout = "";
		child.stdout.on("data", (d) => {
			stdout += d.toString();
		});
		const lines = () => stdout.split("\n").filter(Boolean);
		const until = async (n, ms = 30_000) => {
			const end = Date.now() + ms;
			while (lines().length < n) {
				if (Date.now() > end)
					throw new Error(`timed out waiting for build ${n}; got ${lines().length}`);
				await new Promise((r) => setTimeout(r, 100));
			}
		};
		try {
			await until(1);
			assert.equal(JSON.parse(lines()[0]).ok, true);
			// Break the document, then fix it: the watcher should report both builds.
			await writeFile(
				join(dir, "main.tex"),
				"\\documentclass{article}\\begin{document}\\oops\\end{document}"
			);
			await until(2);
			assert.equal(JSON.parse(lines()[1]).ok, false);
			await writeFile(
				join(dir, "main.tex"),
				"\\documentclass{article}\\begin{document}Fixed.\\end{document}"
			);
			await until(3);
			assert.equal(JSON.parse(lines()[2]).ok, true);
		} finally {
			child.kill();
		}
	});

	test("does not rebuild for its own PDF output", async () => {
		const dir = await scratch("resume");
		const child = spawn(process.execPath, [bin, "watch", dir, "--json"], {
			env: { ...process.env, NO_COLOR: "1" }
		});
		let stdout = "";
		child.stdout.on("data", (d) => {
			stdout += d.toString();
		});
		try {
			const end = Date.now() + 30_000;
			while (!stdout.includes("\n") && Date.now() < end)
				await new Promise((r) => setTimeout(r, 100));
			// Writing the PDF itself (as the build does) must not loop; wait and count builds.
			await new Promise((r) => setTimeout(r, 2500));
			assert.equal(stdout.split("\n").filter(Boolean).length, 1);
		} finally {
			child.kill();
		}
	});
});
