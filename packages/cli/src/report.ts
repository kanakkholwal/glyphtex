import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Ui } from "./ui.js";
import { formatBytes, formatDuration } from "./ui.js";

export interface ReportDiagnostic {
	severity: "error" | "warning" | "info";
	file: string | null;
	line: number | null;
	message: string;
}

/**
 * The stable result of a build, printed as JSON with `--json`. Agents can rely on these field
 * names: adding fields is allowed, renaming or removing one is a breaking change.
 */
export interface BuildReport {
	/** True only when a PDF exists and TeX reported no errors. */
	ok: boolean;
	status: "spotless" | "warnings" | "errors" | "failed";
	entry: string;
	/** Absolute path of the written PDF, or null when none was produced. */
	pdf: string | null;
	bytes: number;
	passes: number;
	durationMs: number;
	engine: "wasm" | "native";
	diagnostics: ReportDiagnostic[];
	/** Files TeX asked for that the project and the bundle did not have. */
	missingFiles: string[];
	/** Missing packages the engine cannot provide at all (needs a subprocess, for example). */
	unsupported: string[];
	packsLoaded: string[];
	/** Absolute path of the TeX log, when `--log` was given. */
	logPath: string | null;
	message: string | null;
}

export function summarise(diagnostics: readonly ReportDiagnostic[]) {
	return {
		errors: diagnostics.filter((d) => d.severity === "error").length,
		warnings: diagnostics.filter((d) => d.severity === "warning").length
	};
}

async function sourceLine(root: string, file: string, line: number): Promise<string | undefined> {
	try {
		const text = await readFile(join(root, ...file.split("/")), "utf8");
		return text.split(/\r?\n/)[line - 1];
	} catch {
		return undefined;
	}
}

const MAX_SHOWN = 20;

/** Human-readable build result: what happened first, then each problem with its source line. */
export async function printReport(ui: Ui, report: BuildReport, root: string): Promise<void> {
	const { errors, warnings } = summarise(report.diagnostics);
	const shown = report.diagnostics.filter((d) => d.severity !== "info");

	for (const d of shown.slice(0, MAX_SHOWN)) {
		const where = d.file ? `${d.file}${d.line ? `:${d.line}` : ""}` : "";
		const mark = d.severity === "error" ? ui.red("✖") : ui.yellow("!");
		ui.line(`${mark} ${ui.bold(where)}${where ? "  " : ""}${d.message}`, d.severity === "error");
		if (d.file && d.line) {
			const text = await sourceLine(root, d.file, d.line);
			if (text !== undefined) {
				ui.line(
					`    ${ui.dim(String(d.line).padStart(4))} ${ui.dim("│")} ${text.trim()}`,
					d.severity === "error"
				);
			}
		}
	}
	if (shown.length > MAX_SHOWN) {
		ui.line(ui.dim(`  … and ${shown.length - MAX_SHOWN} more. Use --json for all of them.`));
	}

	for (const file of report.missingFiles) {
		const unsupported = report.unsupported.includes(file);
		ui.line(
			`${ui.red("✖")} missing ${ui.bold(file)}${unsupported ? ui.dim("  (not available in this engine)") : ""}`,
			true
		);
	}

	const counts = [
		errors ? ui.red(`${errors} error${errors === 1 ? "" : "s"}`) : "",
		warnings ? ui.yellow(`${warnings} warning${warnings === 1 ? "" : "s"}`) : ""
	]
		.filter(Boolean)
		.join(", ");

	if (report.pdf) {
		const detail = `${formatBytes(report.bytes)}, ${report.passes} pass${report.passes === 1 ? "" : "es"}, ${formatDuration(report.durationMs)}`;
		const line = `${ui.bold(report.pdf)} ${ui.dim(`(${detail})`)}${counts ? `  ${counts}` : ""}`;
		if (report.ok) ui.success(line);
		else ui.error(`${line}  ${ui.dim("written, but TeX reported errors")}`);
	} else {
		ui.error(report.message ?? "The build failed and produced no PDF.");
	}
}
