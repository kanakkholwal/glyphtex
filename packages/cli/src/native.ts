import { spawn, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { readFromArchive } from "./extract.js";
import type { BuildReport, ReportDiagnostic } from "./report.js";
import type { Ui } from "./ui.js";

/** Pinned like the desktop app's sidecar: bump deliberately, never track "latest". */
export const TECTONIC_VERSION = "0.16.9";

/** Release asset triples we know exist; other platforms use the WebAssembly engine. */
export function targetTriple(platform: string, arch: string): string | null {
	if (platform === "win32" && arch === "x64") return "x86_64-pc-windows-msvc";
	if (platform === "darwin" && arch === "arm64") return "aarch64-apple-darwin";
	if (platform === "darwin" && arch === "x64") return "x86_64-apple-darwin";
	if (platform === "linux" && arch === "x64") return "x86_64-unknown-linux-gnu";
	return null;
}

export function cacheRoot(env: NodeJS.ProcessEnv = process.env): string {
	if (env.GLYPHTEX_HOME) return env.GLYPHTEX_HOME;
	if (process.platform === "win32") {
		return join(env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "glyphtex");
	}
	return join(env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "glyphtex");
}

const exe = () => (process.platform === "win32" ? "tectonic.exe" : "tectonic");
const installedPath = (env = process.env) =>
	join(cacheRoot(env), "tectonic", TECTONIC_VERSION, exe());

async function exists(path: string) {
	try {
		return (await stat(path)).isFile();
	} catch {
		return false;
	}
}

/** Where a native Tectonic is, in order: GLYPHTEX_TECTONIC_BIN, our cache, then PATH. */
export async function findNative(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
	if (env.GLYPHTEX_TECTONIC_BIN && (await exists(env.GLYPHTEX_TECTONIC_BIN))) {
		return env.GLYPHTEX_TECTONIC_BIN;
	}
	if (await exists(installedPath(env))) return installedPath(env);
	const probe = spawnSync(exe(), ["--version"], { encoding: "utf8" });
	return probe.status === 0 ? exe() : null;
}

export function nativeVersion(bin: string): string | null {
	const out = spawnSync(bin, ["--version"], { encoding: "utf8" });
	return out.status === 0 ? out.stdout.trim().split(/\r?\n/)[0] || null : null;
}

/** Downloads the pinned Tectonic with a live progress bar and caches it for every later build. */
export async function installNative(ui: Ui, env: NodeJS.ProcessEnv = process.env): Promise<string> {
	const triple = targetTriple(process.platform, process.arch);
	if (!triple) {
		throw new Error(
			`There is no prebuilt native engine for ${process.platform}/${process.arch}. The built-in WebAssembly engine works everywhere.`
		);
	}
	const windows = triple.includes("windows");
	const asset = `tectonic-${TECTONIC_VERSION}-${triple}.${windows ? "zip" : "tar.gz"}`;
	const url = `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/${asset}`;
	const dest = installedPath(env);
	await mkdir(join(dest, ".."), { recursive: true });
	const work = await mkdtemp(join(tmpdir(), "glyphtex-"));
	try {
		const res = await fetch(url, { redirect: "follow" });
		if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}) for ${asset}.`);
		const total = Number(res.headers.get("content-length")) || undefined;
		const bar = ui.progress(`Downloading Tectonic ${TECTONIC_VERSION}`, total);
		const archive = join(work, asset);
		const out = createWriteStream(archive);
		let done = 0;
		try {
			for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
				out.write(chunk);
				done += chunk.byteLength;
				bar.tick(done);
			}
			await new Promise<void>((resolve, reject) => {
				out.end((error?: Error | null) => (error ? reject(error) : resolve()));
			});
		} catch (error) {
			bar.fail("Download interrupted");
			throw error;
		}
		bar.done(`Downloaded ${asset}`);

		const task = ui.task("Unpacking");
		const bytes = await readFromArchive(await readFile(archive), asset, exe());
		if (!bytes) {
			task.fail("The download did not contain Tectonic");
			throw new Error(`${exe()} was not inside ${asset}.`);
		}
		await writeFile(dest, bytes);
		if (!windows) await chmod(dest, 0o755);
		task.succeed(`Installed ${dest}`);
		return dest;
	} finally {
		await rm(work, { recursive: true, force: true });
	}
}

const LINE = /^(error|warning|note):\s+(?:(.+?):(\d+):\s+)?(.*)$/;

/** Tectonic's `error: main.tex:12: message` lines, as diagnostics. */
export function parseTectonicOutput(text: string): ReportDiagnostic[] {
	const out: ReportDiagnostic[] = [];
	for (const raw of text.split(/\r?\n/)) {
		const m = LINE.exec(raw.trim());
		if (!m) continue;
		const severity = m[1] === "error" ? "error" : m[1] === "warning" ? "warning" : "info";
		out.push({
			severity,
			file: m[2] ?? null,
			line: m[3] ? Number(m[3]) : null,
			message: (m[4] ?? "").trim()
		});
	}
	return out;
}

/** Compiles with a native Tectonic. It fetches missing packages itself, so coverage is the full TeX Live set. */
export async function buildNative(opts: {
	bin: string;
	root: string;
	entry: string;
	output: string;
	keepLog: boolean;
	synctex: boolean;
}): Promise<BuildReport> {
	const started = Date.now();
	const outdir = await mkdtemp(join(tmpdir(), "glyphtex-out-"));
	try {
		const args = ["-X", "compile", opts.entry, "--outdir", outdir, "--keep-logs"];
		if (opts.synctex) args.push("--synctex");
		const child = spawn(opts.bin, args, { cwd: opts.root });
		let text = "";
		child.stdout.on("data", (d: Buffer) => {
			text += d.toString();
		});
		child.stderr.on("data", (d: Buffer) => {
			text += d.toString();
		});
		const code = await new Promise<number>((resolve, reject) => {
			child.on("error", reject);
			child.on("close", (c) => resolve(c ?? 1));
		});
		const diagnostics = parseTectonicOutput(text);
		const jobname =
			opts.entry
				.replace(/\.[^.]+$/, "")
				.split("/")
				.pop() ?? "main";
		const pdfPath = join(outdir, `${jobname}.pdf`);
		const hasPdf = await exists(pdfPath);
		let bytes = 0;
		let logPath: string | null = null;
		if (hasPdf) {
			await mkdir(join(opts.output, ".."), { recursive: true });
			await copyFile(pdfPath, opts.output);
			bytes = (await stat(opts.output)).size;
		}
		if (opts.keepLog && (await exists(join(outdir, `${jobname}.log`)))) {
			logPath = opts.output.replace(/\.pdf$/i, "") + ".log";
			await copyFile(join(outdir, `${jobname}.log`), logPath);
		}
		const errors = diagnostics.filter((d) => d.severity === "error").length;
		const warnings = diagnostics.filter((d) => d.severity === "warning").length;
		const ok = hasPdf && code === 0 && errors === 0;
		return {
			ok,
			status: !hasPdf ? "failed" : errors ? "errors" : warnings ? "warnings" : "spotless",
			entry: opts.entry,
			pdf: hasPdf ? opts.output : null,
			bytes,
			passes: 0,
			durationMs: Date.now() - started,
			engine: "native",
			diagnostics,
			missingFiles: [],
			unsupported: [],
			packsLoaded: [],
			logPath,
			message: hasPdf
				? null
				: (diagnostics.find((d) => d.severity === "error")?.message ??
					`Tectonic exited with code ${code}.`)
		};
	} finally {
		await rm(outdir, { recursive: true, force: true });
	}
}
