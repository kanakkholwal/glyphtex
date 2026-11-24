import { type CurveFactory, area as d3Area } from "d3-shape";
import { type Datum, type PathPoint, toDate } from "../chart/core.js";

export interface Band {
	top: PathPoint[];
	bottom: PathPoint[];
}

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/** Sum of the stacked series below `key` at one datum; unstacked areas sit on zero. */
export function stackBase(datum: Datum, below: string[]): number {
	return below.reduce((sum, key) => sum + num(datum[key]), 0);
}

/** Top and bottom edges of one area; points without a value are skipped on both edges. */
export function bandPoints(options: {
	data: Datum[];
	key: string;
	below: string[];
	xKey: string;
	x: (datum: Datum) => number;
	y: (value: number) => number;
	floor: number;
}): Band {
	const { data, key, below, xKey, x, y, floor } = options;
	const top: PathPoint[] = [];
	const bottom: PathPoint[] = [];
	data.forEach((datum, index) => {
		const value = datum[key];
		if (typeof value !== "number" || !Number.isFinite(value)) return;
		const id = String(toDate(datum[xKey]).getTime() || index);
		const base = stackBase(datum, below);
		const px = x(datum);
		top.push({ key: id, x: px, y: y(base + value) });
		bottom.push({ key: id, x: px, y: below.length ? y(base) : floor });
	});
	return { top, bottom };
}

/** Highest stacked top across the data, so the domain can make room for it. */
export function stackMax(data: Datum[], key: string, below: string[]): number {
	return data.reduce((max, datum) => Math.max(max, stackBase(datum, below) + num(datum[key])), 0);
}

export function areaPath(band: Band, curve: CurveFactory): string {
	if (band.top.length === 0) return "";
	const rows = band.top.map((point, i) => ({
		x: point.x,
		y1: point.y,
		y0: band.bottom[i]?.y ?? point.y
	}));
	return (
		d3Area<{ x: number; y0: number; y1: number }>()
			.x((row) => row.x)
			.y0((row) => row.y0)
			.y1((row) => row.y1)
			.curve(curve)(rows) ?? ""
	);
}

export function bandSignature(data: Datum[], keys: string[], xKey: string, width: number) {
	return `${width}|${data
		.map((d) => `${toDate(d[xKey]).getTime()}:${keys.map((k) => String(d[k])).join("/")}`)
		.join(",")}`;
}
