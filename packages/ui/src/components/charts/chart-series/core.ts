import type { Datum } from "../chart/core.js";

/** The pulse clip overhangs the plot so round caps at the edges are not cut. */
export const PULSE_CLIP_PAD = 10;
export const PULSE_CYCLE = 2200;
export const PULSE_PAUSE = 280;
export const SWEEP_CYCLE = 2000;
export const SWEEP_EXIT = 450;
export const MARKER_ENTER = 500;
export const REVEAL_DURATION = 1100;

/** Deterministic hash to [0, 1); a sine hash so server and client renders agree. */
export function hashFract(n: number): number {
	const x = Math.sin(n) * 43_758.5453;
	return x - Math.floor(x);
}

/** Placeholder silhouette heights as a fraction of plot height, never shown as data. */
export function skeletonHeights(count: number, seed = 0): number[] {
	return Array.from(
		{ length: count },
		(_, i) => (20 + Math.floor(hashFract((i + 1) * 12.9898 + seed) * 60)) / 100
	);
}

/** A 7-point loading skeleton, normalised to plot fractions (0 bottom, 1 top). */
export function pulseSkeleton(count = 7): number[] {
	const values = Array.from({ length: count }, (_, i) => 110 + Math.sin(i * 1.15) * 36 + i * 9);
	const top = Math.max(...values) * 1.1;
	return values.map((v) => v / top);
}

/** Pulse clip at progress p: grows left to right to 0.5, then the left edge chases right. */
export function pulseClip(p: number, innerWidth: number): { x: number; width: number } {
	const full = innerWidth + PULSE_CLIP_PAD * 2;
	if (p <= 0.5) return { x: -PULSE_CLIP_PAD, width: (p / 0.5) * full };
	const width = (1 - (p - 0.5) / 0.5) * full;
	return { x: innerWidth + PULSE_CLIP_PAD - width, width };
}

/** Exit durations from the current progress, scaled to a half-cycle. */
export function pulseExitPlan(p: number): { grow: number; shrink: number } {
	const half = PULSE_CYCLE / 2;
	const grow = p < 0.5 ? half * ((0.5 - p) / 0.5) : 0;
	const shrink = half * ((1 - Math.max(p, 0.5)) / 0.5);
	return { grow, shrink: Math.max(shrink, 10) };
}

/** Sin-squared opacity stops for the sweep band's soft edges. */
export function sweepStops(steps = 17): { offset: string; opacity: number }[] {
	return Array.from({ length: steps }, (_, i) => {
		const t = i / (steps - 1);
		return {
			offset: `${(t * 100).toFixed(0)}%`,
			opacity: Number((0.05 + Math.sin(t * Math.PI) ** 2 * 0.85).toFixed(3))
		};
	});
}

/** Highlight band one datum either side of the active index, clamped to the ends. */
export function highlightBounds(
	data: Datum[],
	index: number,
	x: (datum: Datum) => number
): { x: number; width: number } | null {
	const start = data[Math.max(0, index - 1)];
	const end = data[Math.min(data.length - 1, index + 1)];
	if (!start || !end) return null;
	const left = x(start);
	return { x: left, width: Math.max(0, x(end) - left) };
}

export interface SignedSegment {
	positive: boolean;
	points: { x: number; y: number }[];
}

/** Splits a series at each baseline crossing, inserting the interpolated crossing point. */
export function splitAtBaseline(
	points: { x: number; value: number }[],
	baseline: number,
	y: (value: number) => number
): SignedSegment[] {
	const segments: SignedSegment[] = [];
	let current: SignedSegment | null = null;
	points.forEach((point, i) => {
		const positive = point.value >= baseline;
		const prev = points[i - 1];
		if (current && prev && current.positive !== positive) {
			const t = (baseline - prev.value) / (point.value - prev.value);
			const cross = { x: prev.x + t * (point.x - prev.x), y: y(baseline) };
			current.points.push(cross);
			segments.push(current);
			current = { positive, points: [cross] };
		}
		if (!current) current = { positive, points: [] };
		current.points.push({ x: point.x, y: y(point.value) });
	});
	if (current) segments.push(current);
	return segments;
}
