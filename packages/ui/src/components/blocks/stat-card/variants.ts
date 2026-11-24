import { tv, type VariantProps } from "tailwind-variants";

export const statCard = tv({
	slots: {
		root: "w-full gap-0 overflow-hidden py-0",
		header: "flex items-start justify-between gap-3 px-5 pt-4 pb-1",
		title: "font-medium text-muted-foreground text-sm",
		body: "flex flex-col gap-3 px-5 pb-0",
		headline: "flex flex-col gap-1 tabular-nums",
		label: "text-muted-foreground text-xs",
		description: "text-muted-foreground text-sm leading-relaxed",
		chart: "-mx-4 relative",
		message: "flex flex-col items-start gap-2 pt-1 pb-4 text-muted-foreground text-sm",
		srOnly: "sr-only"
	},
	variants: {
		size: {
			sm: { chart: "h-24" },
			default: { chart: "h-48" },
			lg: { chart: "h-80" }
		},
		/** A bare line needs headroom so its stroke is not clipped; `none` is a figure-only card. */
		chart: {
			area: { chart: "pt-0" },
			line: { chart: "pt-2" },
			none: { body: "pb-5" }
		},
		/** Empty and error replace the chart with a message; loading skeletons the figures. */
		status: {
			loading: {},
			ready: {},
			empty: { chart: "hidden" },
			error: { chart: "hidden" }
		},
		/** Which direction is good news: revenue wants "up", churn or latency want "down". */
		positive: {
			up: {},
			down: {}
		}
	},
	defaultVariants: { size: "default", chart: "area", status: "ready", positive: "up" }
});

export type StatCardSize = NonNullable<VariantProps<typeof statCard>["size"]>;
export type StatCardChartKind = NonNullable<VariantProps<typeof statCard>["chart"]>;
export type StatCardStatus = NonNullable<VariantProps<typeof statCard>["status"]>;
export type StatCardPositive = NonNullable<VariantProps<typeof statCard>["positive"]>;

/** Period-over-period change in percent against the previous row; null when there is none. */
export function periodTrend(
	data: Record<string, unknown>[],
	index: number,
	dataKey: string
): number | null {
	if (index <= 0) return null;
	const current = data[index]?.[dataKey];
	const previous = data[index - 1]?.[dataKey];
	if (typeof current !== "number" || typeof previous !== "number" || previous === 0) return null;
	return ((current - previous) / previous) * 100;
}

export type TrendTone = "success" | "destructive" | "secondary";

/** Badge tone: zero is neutral, and a fall counts as good news when `positive` is "down". */
export function trendTone(trend: number, positive: StatCardPositive): TrendTone {
	if (trend === 0) return "secondary";
	return trend > 0 === (positive === "up") ? "success" : "destructive";
}

/** Arrow path for the badge; flat for no change. */
export function trendPath(trend: number): string {
	if (trend === 0) return "M2.5 6h7M7 3.5 9.5 6 7 8.5";
	return trend > 0 ? "M3 9 9 3M4.5 3H9v4.5" : "M3 3l6 6M9 4.5V9H4.5";
}

/** What a screen reader hears for the badge, e.g. "Increased by 12.5% vs last month". */
export function trendSentence(trend: number, magnitude: string, comparison?: string): string {
	const against = comparison ? ` ${comparison}` : "";
	if (trend === 0) return `No change${against}`;
	return `${trend > 0 ? "Increased" : "Decreased"} by ${magnitude}${against}`;
}

/** Screen-reader summary of the sparkline in the card's own number format. */
export function statSummary(options: {
	data: Record<string, unknown>[];
	dataKey: string;
	xKey: string;
	formatValue: (value: number) => string;
	formatDate: (value: unknown) => string;
}): string {
	const { data, dataKey, xKey, formatValue, formatDate } = options;
	const values = data.map((row) => row[dataKey]).filter((v): v is number => typeof v === "number");
	if (values.length === 0) return "No data.";
	const from = formatDate(data[0]?.[xKey]);
	const to = formatDate(data.at(-1)?.[xKey]);
	return `${values.length} points from ${from} to ${to}. Lowest ${formatValue(
		Math.min(...values)
	)}, highest ${formatValue(Math.max(...values))}, latest ${formatValue(values.at(-1) ?? 0)}.`;
}
