#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const force = args.includes("--force") || args.includes("-f");
const entry = args.find((a) => a.startsWith("src/")) ?? "src/entry/node.ts";
const win = process.platform === "win32";

const run = (cmd, argv) => {
	try {
		return execFileSync(cmd, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
	} catch {
		return "";
	}
};

function envPort() {
	if (process.env.PORT) return Number(process.env.PORT);
	if (!existsSync(".env")) return 8787;
	const line = readFileSync(".env", "utf8").match(/^PORT=(\d+)/m);
	return line ? Number(line[1]) : 8787;
}

function listeners(port) {
	if (win) {
		const pids = run("netstat", ["-ano", "-p", "TCP"])
			.split(/\r?\n/)
			.map((l) => l.trim().split(/\s+/))
			.filter((c) => c[3] === "LISTENING" && c[1]?.endsWith(`:${port}`))
			.map((c) => Number(c[4]));
		return [...new Set(pids)].filter((p) => p > 0);
	}
	return run("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"])
		.split("\n")
		.filter(Boolean)
		.map(Number);
}

function describe(pid) {
	if (win) {
		const out = run("powershell", [
			"-NoProfile",
			"-Command",
			`$p = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"; "$($p.ParentProcessId)|$($p.CommandLine)"`
		]).trim();
		const [parent, ...cmd] = out.split("|");
		return { parent: Number(parent) || 0, cmd: cmd.join("|") };
	}
	const [parent, ...cmd] = run("ps", ["-o", "ppid=,command=", "-p", String(pid)])
		.trim()
		.split(/\s+/);
	return { parent: Number(parent) || 0, cmd: cmd.join(" ") };
}

const ours = (cmd) => /src[\\/]entry[\\/]node\.ts/.test(cmd);

function kill(pid) {
	if (win) run("taskkill", ["/F", "/T", "/PID", String(pid)]);
	else {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			// Already gone.
		}
	}
}

function freePort(port) {
	for (const pid of listeners(port)) {
		const { parent, cmd } = describe(pid);
		if (!ours(cmd) && !force) {
			console.error(
				`Port ${port} is held by PID ${pid} (${cmd || "unknown"}).\n` +
					"Run with --force to stop it, or set PORT in .env."
			);
			process.exit(1);
		}
		// A stale `node --watch` parent would otherwise linger with nothing to watch for.
		const watcher = parent ? describe(parent) : null;
		kill(watcher && ours(watcher.cmd) ? parent : pid);
		console.log(`Freed port ${port} (stopped PID ${pid}).`);
	}
	for (let i = 0; i < 20 && listeners(port).length; i++) {
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
	}
}

const port = envPort();
if (entry === "src/entry/node.ts") freePort(port);

const child = spawn(process.execPath, ["--env-file-if-exists=.env", "--watch", entry], {
	stdio: "inherit",
	env: { ...process.env, GLYPHTEX_DEV_LAUNCHER: String(process.pid) }
});
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
	process.on(signal, () => {
		if (win && child.pid) kill(child.pid);
		else child.kill(signal);
	});
}
child.on("exit", (code) => process.exit(code ?? 0));
