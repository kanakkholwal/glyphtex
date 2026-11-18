import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { buildNative, findNative, installNative } from "./native.js";
import { type LoadedFile, type Project, usedPackages } from "./project.js";
import type { BuildReport, ReportDiagnostic } from "./report.js";
import type { Ui } from "./ui.js";
import type { WasmSession } from "./wasm.js";

export interface BuildOptions {
	/** Absolute path of the PDF to write; defaults next to the entry file. */
	output?: string;
	log: boolean;
	synctex: boolean;
}

const MAX_ROUNDS = 3;
// TeX probes for many optional files (rerunfilecheck.cfg.aux and the like) that are not problems.
// Only package, class and style files matter to someone deciding what to install or report.
const REPORTABLE_MISSING = /^[\w-]+\.(sty|cls|bst|bbx|cbx|lbx)$/i;
const TEXT_SOURCE = /\.(tex|ltx|sty|cls|def|cfg)$/i;
const decoder = new TextDecoder();

export const defaultOutput = (project: Project) =>
	join(project.root, project.entry.replace(/\.(tex|ltx)$/i, "") + ".pdf");

function toDiagnostics(
	list: ReadonlyArray<{
		severity: string;
		file: string | null;
		line: number | null;
		message: string;
	}>,
	entry: string
): ReportDiagnostic[] {
	return list.map((d) => ({
		severity: d.severity === "error" ? "error" : d.severity === "warning" ? "warning" : "info",
		// A line with no file is in the document being compiled: TeX only names files it opened itself.
		file: d.file ?? (d.line === null ? null : entry),
		line: d.line,
		message: d.message
	}));
}

/**
 * One build with the WebAssembly engine. Packages the document names are loaded first; if TeX
 * still reports missing files, the packs that provide them are loaded and it runs again.
 */
export async function buildWasm(
	session: WasmSession,
	project: Project,
	files: readonly LoadedFile[],
	options: BuildOptions,
	ui: Ui
): Promise<BuildReport> {
	const started = Date.now();
	const output = resolve(options.output ?? defaultOutput(project));
	session.sync(files);

	const sources = files.filter((f) => TEXT_SOURCE.test(f.path)).map((f) => decoder.decode(f.data));
	await session.loadPacks(session.packsFor(usedPackages(sources)), ui);

	const task = ui.task(`Compiling ${project.entry}`);
	let result = session.compile({ entry: project.entry, synctex: options.synctex });
	let unsupported: string[] = [];
	for (let round = 0; round < MAX_ROUNDS && result.missingFiles.length > 0; round++) {
		const need = session.resolve(result.missingFiles);
		unsupported = need.unsupported;
		if (need.packs.length === 0) break;
		task.update(`Loading ${need.packs.map((p) => p.id).join(", ")}`);
		await session.loadPacks(need.packs, ui);
		task.update(`Compiling ${project.entry}`);
		result = session.compile({ entry: project.entry, synctex: options.synctex });
	}

	const pdf = result.status === "failed" ? undefined : session.pdf();
	const diagnostics = toDiagnostics(result.diagnostics, project.entry);
	const errors = diagnostics.filter((d) => d.severity === "error").length;
	let logPath: string | null = null;

	if (pdf) {
		await mkdir(dirname(output), { recursive: true });
		await writeFile(output, pdf);
	}
	if (options.log) {
		const log = session.log();
		if (log) {
			logPath = output.replace(/\.pdf$/i, "") + ".log";
			await writeFile(logPath, log);
		}
	}

	const ok =
		Boolean(pdf) && result.status !== "errors" && result.status !== "failed" && errors === 0;
	if (ok) task.succeed(`Compiled ${project.entry}`);
	else task.fail(`Compiled ${project.entry}`);

	return {
		ok,
		status: result.status,
		entry: project.entry,
		pdf: pdf ? output : null,
		bytes: pdf?.byteLength ?? 0,
		passes: result.passesRun,
		durationMs: Date.now() - started,
		engine: "wasm",
		diagnostics,
		missingFiles: ok ? [] : result.missingFiles.filter((f) => REPORTABLE_MISSING.test(f)),
		unsupported,
		packsLoaded: [...session.packsLoaded],
		logPath,
		message: result.message
	};
}

/** One build with a native Tectonic, downloading it first (with a progress bar) if it is not installed. */
export async function buildWithNative(
	project: Project,
	options: BuildOptions,
	ui: Ui
): Promise<BuildReport> {
	const bin = (await findNative()) ?? (await installNative(ui));
	ui.info(
		"Tectonic fetches the packages it needs the first time, so the first build is slower. Later builds are cached."
	);
	const task = ui.task(`Compiling ${project.entry} with Tectonic`);
	const report = await buildNative({
		bin,
		root: project.root,
		entry: project.entry,
		output: resolve(options.output ?? defaultOutput(project)),
		keepLog: options.log,
		synctex: options.synctex
	});
	if (report.ok) task.succeed(`Compiled ${project.entry}`);
	else task.fail(`Compiled ${project.entry}`);
	return report;
}
