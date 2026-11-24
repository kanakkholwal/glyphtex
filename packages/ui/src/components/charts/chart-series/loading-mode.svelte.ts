import type { ChartPhase } from "../chart/core.js";

/** Loops while loading; once status flips it exits from its current progress, then unmounts. */
export function createLoadingMode(phase: () => ChartPhase) {
	let wasLoading = $state(phase() === "loading");
	let finished = $state(false);
	$effect.pre(() => {
		if (phase() === "loading") {
			wasLoading = true;
			finished = false;
		}
	});
	return {
		get mode(): "loop" | "exit" | null {
			const current = phase();
			if (current === "loading") return "loop";
			const exiting = current === "gridTweenReady" || current === "revealing";
			return exiting && wasLoading && !finished ? "exit" : null;
		},
		finish() {
			wasLoading = false;
			finished = true;
		}
	};
}

export function silhouette(
	values: number[],
	innerWidth: number,
	innerHeight: number
): { key: string; x: number; y: number }[] {
	return values.map((v, i) => ({
		key: String(i),
		x: (i / Math.max(1, values.length - 1)) * innerWidth,
		y: innerHeight * (1 - v)
	}));
}
