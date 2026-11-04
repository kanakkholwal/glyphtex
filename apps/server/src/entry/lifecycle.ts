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
	const parent = process.ppid;
	setInterval(() => {
		try {
			process.kill(parent, 0);
		} catch {
			run("parent exited");
		}
	}, 1_000).unref();
}
