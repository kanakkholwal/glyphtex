import { access, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs, type Specs } from "./args.js";
import { findNative, nativeVersion, targetTriple } from "./native.js";
import { formatBytes, type Ui } from "./ui.js";

type Status = "ok" | "warn" | "fail";
interface Check {
	name: string;
	status: Status;
	detail: string;
	/** What to do about it, for warn and fail. */
	fix?: string;
}

const specs: Specs = {
	json: { type: "boolean", description: "Print the checks as JSON." },
	quiet: { type: "boolean", short: "q", description: "Only print failures." },
	"no-color": { type: "boolean", description: "Plain output." }
};

async function sizeOf(specifier: string): Promise<number | null> {
	try {
		const path = fileURLToPath(import.meta.resolve(specifier));
		await access(path);
		return (await stat(path)).size;
	} catch {
		return null;
	}
}

/** Checks everything a build depends on, so a failure comes with a reason and a fix instead of a stack trace. */
export async function runDoctor(
	args: string[],
	makeUi: (flags: Record<string, string | boolean>) => Ui,
	info: { version: string; tectonic: string; cache: string }
): Promise<number> {
	const parsed = parseArgs(args, specs);
	if (parsed.error) {
		process.stderr.write(`${parsed.error}\n`);
		return 2;
	}
	const ui = makeUi(parsed.flags);
	const checks: Check[] = [];

	const major = Number(process.versions.node.split(".")[0]);
	checks.push(
		major >= 20
			? { name: "Node.js", status: "ok", detail: `v${process.versions.node}` }
			: {
					name: "Node.js",
					status: "fail",
					detail: `v${process.versions.node}`,
					fix: "Install Node.js 20.6 or newer."
				}
	);

	const wasm = await sizeOf("glyphtex-engine/wasm");
	checks.push(
		wasm
			? { name: "WebAssembly engine", status: "ok", detail: formatBytes(wasm) }
			: {
					name: "WebAssembly engine",
					status: "fail",
					detail: "missing",
					fix: "Reinstall: npm install -g glyphtex"
				}
	);
	const bundle = await sizeOf("glyphtex-engine/bundle");
	checks.push(
		bundle
			? { name: "TeX bundle", status: "ok", detail: formatBytes(bundle) }
			: {
					name: "TeX bundle",
					status: "fail",
					detail: "missing",
					fix: "Reinstall: npm install -g glyphtex"
				}
	);

	const bin = await findNative();
	const triple = targetTriple(process.platform, process.arch);
	checks.push(
		bin
			? {
					name: "Native engine (optional)",
					status: "ok",
					detail: `${nativeVersion(bin) ?? "Tectonic"} at ${bin}`
				}
			: {
					name: "Native engine (optional)",
					status: "warn",
					detail: triple ? "not installed" : `no prebuilt for ${process.platform}/${process.arch}`,
					fix: triple ? "Optional: glyphtex engine install" : "Use the built-in engine."
				}
	);
	checks.push({ name: "Cache folder", status: "ok", detail: info.cache });

	const failed = checks.some((c) => c.status === "fail");
	if (parsed.flags.json === true) {
		process.stdout.write(
			`${JSON.stringify({ ok: !failed, version: info.version, platform: `${process.platform}/${process.arch}`, checks })}\n`
		);
		return failed ? 1 : 0;
	}

	ui.line(
		`${ui.bold(`glyphtex ${info.version}`)} ${ui.dim(`on ${process.platform}/${process.arch}`)}`,
		true
	);
	for (const c of checks) {
		const mark =
			c.status === "ok" ? ui.green("✔") : c.status === "warn" ? ui.yellow("!") : ui.red("✖");
		ui.line(`${mark} ${c.name.padEnd(26)} ${ui.dim(c.detail)}`, c.status === "fail");
		if (c.fix && c.status !== "ok") ui.line(`    ${ui.dim(c.fix)}`, c.status === "fail");
	}
	ui.line("", true);
	ui.line(failed ? ui.red("Problems found.") : ui.green("Ready to build."), true);
	return failed ? 1 : 0;
}
