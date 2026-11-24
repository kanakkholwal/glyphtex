<svelte:options namespace="svg" />

<script lang="ts">
	import { untrack } from "svelte";
	import { linePath, seriesVisibleInPhase } from "../chart/core.js";
	import { useActivePoint, useChart, usePlot } from "../chart/context.js";
	import { splitAtBaseline } from "../chart-series/core.js";
	import { cn } from "../../../lib/cn.js";
	import { LINE_CURVES, type LineCurve, type ProfitLossEncoding, profitLoss } from "./variants";

	let {
		dataKey,
		baseline = 0,
		curve = "linear",
		strokeWidth = 2.5,
		encoding = "dashed",
		class: className
	}: {
		dataKey: string;
		/** Values at or above this sit on the positive side. */
		baseline?: number;
		curve?: LineCurve;
		strokeWidth?: number;
		/** How the negative side differs beyond colour. */
		encoding?: ProfitLossEncoding;
		class?: string;
	} = $props();

	const plot = usePlot();
	const chart = useChart();
	const pointer = useActivePoint();

	$effect(() => {
		const next = { key: dataKey, color: "var(--chart-positive)" };
		return untrack(() => plot.register(next));
	});

	const segments = $derived(
		splitAtBaseline(
			plot.data.flatMap((datum) => {
				const value = datum[dataKey];
				return typeof value === "number" ? [{ x: plot.x(datum), value }] : [];
			}),
			baseline,
			(v) => plot.yScale(v)
		)
	);
	const activeValue = $derived(pointer.active?.datum[dataKey]);
	const focus = $derived(typeof activeValue === "number" ? activeValue >= baseline : null);
	const drawn = $derived(seriesVisibleInPhase(plot.phase));
	const styles = $derived(profitLoss({ encoding }));
</script>

{#if !chart.hidden.has(dataKey)}
	<g
		data-slot="chart-profit-loss"
		data-series={dataKey}
		clip-path="url(#{plot.clipId})"
		class={className}
	>
		{#each segments as segment, i (`${i}-${segment.positive}`)}
			<path
				data-sign={segment.positive ? "positive" : "negative"}
				d={linePath(
					segment.points.map((p, j) => ({ key: String(j), ...p })),
					LINE_CURVES[curve],
				)}
				class={cn(styles.segment(), segment.positive ? styles.positive() : styles.negative())}
				stroke-width={strokeWidth}
				style:visibility={drawn ? "visible" : "hidden"}
				style:opacity={focus !== null && focus !== segment.positive ? 0.25 : 1}
			/>
		{/each}
	</g>
{/if}
