import { readFileSync } from "node:fs";
import { watch as fsWatch } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { formatOptions, type OptionSpec, parseArgs, type Specs } from "./args.js";
import { type BuildOptions, buildWasm, buildWithNative } from "./build.js";
import { runDoctor } from "./doctor.js";
import { cacheRoot, findNative, installNative, TECTONIC_VERSION } from "./native.js";
import { readProject, resolveProject, UsageError } from "./project.js";
import { type BuildReport, printReport } from "./report.js";
import { Ui } from "./ui.js";
import { WasmSession } from "./wasm.js";

const EXIT = { ok: 0, failed: 1, usage: 2, environment: 3 } as const;

const version = (): string => {
	const pkg = JSON.parse(
		readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")
	) as { version: string };
	return pkg.version;
};

const common: Specs = {
	json: {
		type: "boolean",
		description: "Print a machine-readable result on stdout (progress goes to stderr)."
	},
	quiet: { type: "boolean", short: "q", description: "Only print errors." },
	"no-color": { type: "boolean", description: "Plain output with no colour or animation." }
};

const buildSpecs: Specs = {
	output: {
		type: "string",
		short: "o",
		hint: "file",
		description: "Where to write the PDF (default: next to the .tex file)."
	},
	engine: {
		type: "string",
		hint: "wasm|native",
		description: "wasm (default, built in) or native (downloads Tectonic once)."
	},
	log: { type: "boolean", description: "Also write the TeX log next to the PDF." },
	synctex: { type: "boolean", description: "Also write a .synctex file for editor jumping." },
	...common
};

const HELP = `glyphtex ${"{version}"}: compile LaTeX to PDF. No TeX install, no server.

Usage
  glyphtex build [file.tex | folder]    compile once
  glyphtex watch [file.tex | folder]    rebuild when a file changes
  glyphtex doctor                       check this machine and the engine
  glyphtex engine install               download the optional native engine
  glyphtex --version | --help

Exit codes
  0 built cleanly   1 TeX errors or no PDF   2 bad usage   3 the engine could not start

For agents: add --json to get one JSON object on stdout with the PDF path, diagnostics (file, line,
message), missing files and timings. Progress and logs go to stderr, so stdout is always parseable.

Build options
${formatOptions(buildSpecs)}
`;

function makeUi(flags: Record<string, string | boolean>): Ui {
	const json = flags.json === true;
	const plain = flags["no-color"] === true;
	return new Ui({
		quiet: flags.quiet === true,
		...(plain && { color: false, animate: false }),
		// JSON mode keeps stderr readable but never animated, so captured logs stay clean.
		...(json && { animate: false })
	});
}

function pickEngine(value: string | boolean | undefined): "wasm" | "native" {
	if (value === undefined || value === "wasm") return "wasm";
	if (value === "native") return "native";
	throw new UsageError(`--engine must be wasm or native, not "${String(value)}".`);
}

function toOptions(flags: Record<string, string | boolean>): BuildOptions {
	return {
		output: typeof flags.output === "string" ? flags.output : undefined,
		log: flags.log === true,
		synctex: flags.synctex === true
	};
}

function exitFor(report: BuildReport): number {
	return report.ok ? EXIT.ok : EXIT.failed;
}

async function runBuild(args: string[]): Promise<number> {
	const parsed = parseArgs(args, buildSpecs);
	if (parsed.error) return usage(parsed.error);
	const ui = makeUi(parsed.flags);
	const json = parsed.flags.json === true;
	const engine = pickEngine(parsed.flags.engine);
	const project = await resolveProject(parsed.positionals[0]);
	const options = toOptions(parsed.flags);

	let report: BuildReport;
	if (engine === "native") {
		report = await buildWithNative(project, options, ui);
	} else {
		const session = await WasmSession.open(ui);
		report = await buildWasm(session, project, await readProject(project.root), options, ui);
	}
	if (json) process.stdout.write(`${JSON.stringify(report)}\n`);
	else await printReport(ui, report, project.root);
	return exitFor(report);
}

const IGNORED_CHANGE =
	/(^|[\\/])(\.git|node_modules|\.glyphtex)([\\/]|$)|\.(pdf|log|aux|synctex|toc|out|fls|fdb_latexmk|bbl|blg|xdv)$/i;

async function runWatch(args: string[]): Promise<number> {
	const parsed = parseArgs(args, buildSpecs);
	if (parsed.error) return usage(parsed.error);
	const ui = makeUi(parsed.flags);
	const json = parsed.flags.json === true;
	if (pickEngine(parsed.flags.engine) === "native") {
		return usage(
			"watch uses the built-in engine, which stays loaded between builds. Drop --engine native."
		);
	}
	const project = await resolveProject(parsed.positionals[0]);
	const options = toOptions(parsed.flags);
	let session = await WasmSession.open(ui);

	const rebuild = async () => {
		if (session.poisoned) session = await WasmSession.open(ui);
		try {
			const report = await buildWasm(
				session,
				project,
				await readProject(project.root),
				options,
				ui
			);
			if (json) process.stdout.write(`${JSON.stringify(report)}\n`);
			else await printReport(ui, report, project.root);
		} catch (error) {
			ui.error(error instanceof Error ? error.message : String(error));
		}
		if (!json) ui.line(ui.dim(`Watching ${project.root} for changes. Press Ctrl+C to stop.`));
	};

	await rebuild();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let running = false;
	let again = false;
	const schedule = () => {
		clearTimeout(timer);
		timer = setTimeout(async () => {
			if (running) {
				again = true;
				return;
			}
			running = true;
			do {
				again = false;
				await rebuild();
			} while (again);
			running = false;
		}, 200);
	};
	const watcher = fsWatch(project.root, { recursive: true }, (_event, name) => {
		if (name && !IGNORED_CHANGE.test(name)) schedule();
	});
	await new Promise<void>((resolve) => {
		process.once("SIGINT", () => {
			watcher.close();
			resolve();
		});
	});
	return EXIT.ok;
}

async function runEngine(args: string[]): Promise<number> {
	const parsed = parseArgs(args, common);
	if (parsed.error) return usage(parsed.error);
	const ui = makeUi(parsed.flags);
	const sub = parsed.positionals[0];
	if (sub === "install") {
		const existing = await findNative();
		if (existing) {
			ui.success(`Tectonic is already available at ${existing}`);
			return EXIT.ok;
		}
		await installNative(ui);
		return EXIT.ok;
	}
	if (sub === "path") {
		const found = await findNative();
		process.stdout.write(`${found ?? ""}\n`);
		return found ? EXIT.ok : EXIT.failed;
	}
	return usage(`Unknown engine command "${sub ?? ""}". Try: glyphtex engine install`);
}

function usage(message: string): number {
	process.stderr.write(`${message}\n\nRun "glyphtex --help" for usage.\n`);
	return EXIT.usage;
}

export async function main(argv: string[]): Promise<number> {
	const [command, ...rest] = argv;
	try {
		if (!command || command === "--help" || command === "-h" || command === "help") {
			process.stdout.write(HELP.replace("{version}", version()));
			return EXIT.ok;
		}
		if (command === "--version" || command === "-v") {
			process.stdout.write(`${version()}\n`);
			return EXIT.ok;
		}
		switch (command) {
			case "build":
				return await runBuild(rest);
			case "watch":
				return await runWatch(rest);
			case "doctor":
				return await runDoctor(rest, makeUi, {
					version: version(),
					tectonic: TECTONIC_VERSION,
					cache: cacheRoot()
				});
			case "engine":
				return await runEngine(rest);
			default: {
				// `glyphtex main.tex` is shorthand for `glyphtex build main.tex`.
				const isPath = await stat(command).then(
					() => true,
					() => false
				);
				if (isPath) return await runBuild(argv);
				return usage(`Unknown command "${command}".`);
			}
		}
	} catch (error) {
		if (error instanceof UsageError) return usage(error.message);
		const ui = new Ui({});
		ui.error(error instanceof Error ? error.message : String(error));
		return EXIT.environment;
	}
}

export type { OptionSpec };
