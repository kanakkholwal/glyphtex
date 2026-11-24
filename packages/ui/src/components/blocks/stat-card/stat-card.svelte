<script lang="ts">
	import type { ComponentProps, Snippet } from "svelte";
	import Card from "../../ui/card/card.svelte";
	import type { Datum } from "../../charts/chart/core.js";
	import { cn } from "../../../lib/cn.js";
	import {
		type StatCardChartKind,
		type StatCardPositive,
		type StatCardSize,
		type StatCardStatus,
		statCard
	} from "./variants";
	import { setStatCard } from "./context";

	let {
		name,
		data = [],
		dataKey = "value",
		xKey = "date",
		value,
		label,
		trend,
		comparisonLabel,
		positive = "up",
		chart = "area",
		size = "default",
		color = "var(--chart-1)",
		locale,
		formatValue,
		formatLabel,
		status = "ready",
		activeIndex = $bindable(null),
		onActiveIndexChange,
		class: className,
		children,
		...rest
	}: Omit<ComponentProps<typeof Card>, "children"> & {
		/** What the metric is: the chart's accessible name and the live announcement's lead. */
		name: string;
		/** Rows behind the chart; leave empty with `chart="none"`. */
		data?: Datum[];
		dataKey?: string;
		xKey?: string;
		/** Headline at rest, e.g. the period average. */
		value: number;
		/** Caption under the headline at rest, e.g. "Avg". */
		label: string;
		/** Change over the whole period, in percent. */
		trend: number;
		/** What the trend compares against, read after it, e.g. "vs last month". */
		comparisonLabel?: string;
		/** Which direction is good news; "down" for churn, latency or cost. */
		positive?: StatCardPositive;
		chart?: StatCardChartKind;
		size?: StatCardSize;
		/** Series colour; defaults to the first chart slot. */
		color?: string;
		locale?: string;
		formatValue?: (value: number) => string;
		/** Caption for a hovered row. Defaults to the row's short month. */
		formatLabel?: (date: Date) => string;
		/** "loading" skeletons the figures; "empty" and "error" show StatCardEmpty or StatCardError. */
		status?: StatCardStatus;
		/** Bindable. */
		activeIndex?: number | null;
		onActiveIndexChange?: (index: number | null) => void;
		children?: Snippet;
	} = $props();

	const number = $derived(
		formatValue ?? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format
	);
	const month = $derived(new Intl.DateTimeFormat(locale, { month: "short" }));
	const styles = $derived(statCard({ size, chart, status, positive }));

	setStatCard({
		get name() {
			return name;
		},
		get data() {
			return data;
		},
		get dataKey() {
			return dataKey;
		},
		get xKey() {
			return xKey;
		},
		get value() {
			return value;
		},
		get label() {
			return label;
		},
		get trend() {
			return trend;
		},
		get comparisonLabel() {
			return comparisonLabel;
		},
		get positive() {
			return positive;
		},
		get chart() {
			return chart;
		},
		get color() {
			return color;
		},
		get locale() {
			return locale;
		},
		get status() {
			return status;
		},
		get activeIndex() {
			return activeIndex;
		},
		get number() {
			return number;
		},
		get formatLabel() {
			return formatLabel ?? ((d: Date) => month.format(d));
		},
		get styles() {
			return styles;
		},
		setActive(index) {
			activeIndex = index;
			onActiveIndexChange?.(index);
		}
	});
</script>

<!-- A metric card from parts; hovering StatCardChart drives StatCardValue and StatCardTrend. -->
<Card {...rest} data-slot="stat-card" class={cn(styles.root(), className)}>
	{@render children?.()}
</Card>
