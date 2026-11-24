<svelte:options namespace="svg" />

<script lang="ts">
	import { CHART_EASE_CSS } from "../chart/motion.js";
	import { useActivePoint, useChart, usePlot } from "../chart/context.js";
	import { MARKER_ENTER, REVEAL_DURATION } from "./core";
	import { type SeriesMarkerAppearance, seriesMarker } from "./variants";
	import MarkerShape from "./marker-shape.svelte";

	let {
		dataKey,
		color,
		appearance = "ring",
		radius = 5,
		fadeOnHover = true,
		class: className
	}: {
		dataKey: string;
		color: string;
		appearance?: SeriesMarkerAppearance;
		radius?: number;
		/** Dim and blur the other points while one is active. */
		fadeOnHover?: boolean;
		class?: string;
	} = $props();

	const plot = usePlot();
	const chart = useChart();
	const pointer = useActivePoint();
	const styles = $derived(seriesMarker({ appearance }));
	const extent = $derived(radius + 4);
	const shown = $derived(
		plot.phase === "revealing" || plot.phase === "ready" || plot.phase === "concealing"
	);
	const points = $derived(
		plot.data.flatMap((datum, index) => {
			const value = datum[dataKey];
			if (typeof value !== "number") return [];
			const cx = plot.x(datum);
			const delay =
				plot.innerWidth > 0 ? (Math.max(0, cx - extent) / plot.innerWidth) * REVEAL_DURATION : 0;
			return [{ index, cx, cy: plot.yScale(value), delay }];
		})
	);
	const dim = $derived(
		fadeOnHover &&
			(pointer.active !== null || (chart.highlighted !== null && chart.highlighted !== dataKey))
	);
	const activePoint = $derived(
		pointer.active ? points.find((p) => p.index === pointer.active?.index) : undefined
	);
</script>

{#if !chart.hidden.has(dataKey)}
	<g data-slot="chart-series-markers" data-series={dataKey} class={className}>
		<g
			class={styles.layer()}
			style:opacity={dim ? 0.5 : 1}
			style:filter={dim ? "blur(2px)" : "none"}
		>
			{#each points as p (p.index)}
				<g
					transform="translate({p.cx}, {p.cy})"
					class={[
						"starting:opacity-0 starting:blur-[2px]",
						shown ? "opacity-100 blur-none" : "opacity-0 blur-[2px]",
					]}
					style:transition="opacity {MARKER_ENTER}ms {CHART_EASE_CSS} {p.delay}ms, filter {MARKER_ENTER}ms {CHART_EASE_CSS} {p.delay}ms"
				>
					<MarkerShape {color} {radius} {appearance} />
				</g>
			{/each}
		</g>
		{#if activePoint && fadeOnHover}
			<g
				data-slot="chart-series-marker-active"
				transform="translate({activePoint.cx}, {activePoint.cy}) scale(1.35)"
			>
				<MarkerShape {color} {radius} {appearance} />
			</g>
		{/if}
	</g>
{/if}
