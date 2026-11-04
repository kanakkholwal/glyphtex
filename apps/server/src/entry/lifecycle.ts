const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"] as const;
const FORCE_EXIT_MS = 5_000;

/**
 * Runs `stop` once on Ctrl+C, a closed terminal, or when the parent (pnpm, node --watch) dies,
 * then exits; a hung cleanup is cut off so the port is never left held by an orphan.
 */
export function onShutdown(stop: (reason: string) => Promise<void>) {
	let stopping = false;
	const run = (reason: string) => {
		if (stopping) process.exit(1);
		stopping = true;
		setTimeout(() => process.exit(1), FORCE_EXIT_MS).unref();
		stop(reason).then(
			() => process.exit(0),
			() => process.exit(1)
		);
	};
	for (const signal of SIGNALS) process.on(signal, () => run(signal));

	// Windows never signals a child when its parent is killed, so poll for the parent instead.
	// `scripts/dev.mjs` sits above `node --watch`, which outlives it; watch the launcher too.
	const launcher = Number(process.env.GLYPHTEX_DEV_LAUNCHER) || 0;
	const owners = [process.ppid, launcher].filter((pid) => pid > 0);
	setInterval(() => {
		for (const pid of owners) {
			try {
				process.kill(pid, 0);
			} catch {
				run("parent exited");
				return;
			}
		}
	}, 1_000).unref();
}
