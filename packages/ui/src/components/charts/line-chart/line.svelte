<svelte:options namespace="svg" />

<script lang="ts">
	import { untrack } from "svelte";
	import {
		type FadeEdges,
		fadeStops,
		interpolatePoints,
		linePath,
		type PathPoint,
		seriesColor,
		seriesPoints,
		seriesVisibleInPhase,
		toDate
	} from "../chart/core.js";
	import { CHART_DURATION, tween } from "../chart/motion.js";
	import { useActivePoint, useChart, usePlot } from "../chart/context.js";
	import DashTail from "../chart-series/dash-tail.svelte";
	import HighlightBand from "../chart-series/highlight-band.svelte";
	import LoadingPulse from "../chart-series/loading-pulse.svelte";
	import LoadingSweep from "../chart-series/loading-sweep.svelte";
	import SeriesMarkers from "../chart-series/series-markers.svelte";
	import TerminalMarker from "../chart-series/terminal-marker.svelte";
	import type { SeriesLoadingStyle, SeriesMarkerAppearance } from "../chart-series/variants.js";
	import { cn } from "../../../lib/cn.js";
	import { LINE_CURVES, type LineCurve, type LineVariant, line } from "./variants";

	let {
		dataKey,
		stroke,
		strokeWidth = 2.5,
		curve = "natural",
		variant = "solid",
		fadeEdges = true,
		showHighlight = true,
		showMarkers = false,
		markerAppearance = "ring",
		terminalMarker = false,
		dashFromIndex,
		loadingStyle = "pulse",
		loading = true,
		class: className
	}: {
		dataKey: string;
		/** Defaults to the series colour from the chart config, `var(--color-<dataKey>)`. */
		stroke?: string;
		strokeWidth?: number;
		curve?: LineCurve;
		variant?: LineVariant;
		/** Fade the stroke into the plot edges. */
		fadeEdges?: FadeEdges;
		/** Brighten the stroke around the active point. */
		showHighlight?: boolean;
		showMarkers?: boolean;
		markerAppearance?: SeriesMarkerAppearance;
		/** Hollow ring on the last datum. */
		terminalMarker?: boolean;
		/** Data index from which the stroke turns dashed, e.g. an incomplete period. */
		dashFromIndex?: number;
		loadingStyle?: SeriesLoadingStyle;
		/** Set false to hide the loading visual while the chart loads. */
		loading?: boolean;
		class?: string;
	} = $props();

	const plot = usePlot();
	const chart = useChart();
	const pointer = useActivePoint();
	const uid = $props.id();
	const gradientId = `${uid}-line`;
	const color = $derived(stroke ?? seriesColor(dataKey));

	$effect(() => {
		const next = { key: dataKey, color };
		return untrack(() => plot.register(next));
	});

	const target = $derived(
		seriesPoints(plot.data, dataKey, plot.x, (v) => plot.yScale(v), plot.xKey)
	);

	// Data, width and x-domain changes morph; y-domain moves are already tweened by the plot.
	const signature = $derived(
		`${plot.innerWidth}|${plot.xScale.domain().map(Number).join(",")}|${plot.data
			.map((d) => `${toDate(d[plot.xKey]).getTime()}:${String(d[dataKey])}`)
			.join(",")}`
	);
	let progress = $state(1);
	let from: PathPoint[] = [];
	let shown: PathPoint[] = [];
	// svelte-ignore state_referenced_locally
	let prevSignature = signature;
	$effect.pre(() => {
		const next = signature;
		return untrack(() => {
			if (prevSignature === next) return;
			prevSignature = next;
			if (plot.phase !== "ready" || !plot.animate) {
				progress = 1;
				return;
			}
			from = shown;
			progress = 0;
			const playback = tween({
				duration: CHART_DURATION.update,
				onUpdate: (p) => {
					progress = p;
				}
			});
			return () => playback.stop();
		});
	});

	const points = $derived(progress >= 1 ? target : interpolatePoints(from, target, progress));
	$effect.pre(() => {
		shown = points;
	});

	const curveFactory = $derived(LINE_CURVES[curve]);
	const d = $derived(linePath(points, curveFactory));
	const isHidden = $derived(chart.hidden.has(dataKey));
	const dimmed = $derived(
		pointer.active !== null ||
			Boolean(plot.selection) ||
			(chart.highlighted !== null && chart.highlighted !== dataKey)
	);
	const drawn = $derived(seriesVisibleInPhase(plot.phase));
	const fade = $derived(fadeEdges !== false);
	const paint = $derived(drawn ? (fade ? `url(#${gradientId})` : color) : "transparent");
	const opacity = $derived(isHidden ? 0 : dimmed ? 0.3 : 1);
	const dashDatum = $derived(
		dashFromIndex !== undefined && dashFromIndex >= 0 && dashFromIndex < plot.data.length - 1
			? plot.data[dashFromIndex]
			: undefined
	);
	const leads = $derived(plot.series[0]?.key === dataKey);
	const lineClass = $derived(cn(line({ curve, variant }), className));
</script>

<g data-slot="chart-line" data-series={dataKey}>
	<g clip-path="url(#{plot.clipId})">
		{#if fade}
			<defs>
				<linearGradient
					id={gradientId}
					gradientUnits="userSpaceOnUse"
					x1={0}
					x2={plot.innerWidth}
					y1={0}
					y2={0}
				>
					{#each fadeStops(fadeEdges) as stop (stop.offset)}
						<stop offset={stop.offset} stop-color={color} stop-opacity={stop.opacity} />
					{/each}
				</linearGradient>
			</defs>
		{/if}
		{#if dashDatum}
			<DashTail
				{d}
				fromX={plot.x(dashDatum)}
				stroke={paint}
				{strokeWidth}
				class={lineClass}
				style="opacity: {opacity}"
			/>
		{:else}
			<path {d} class={lineClass} stroke={paint} stroke-width={strokeWidth} style:opacity={opacity} />
		{/if}
	</g>
	{#if showHighlight && !isHidden}
		<HighlightBand {d} stroke={color} {strokeWidth} />
	{/if}
	{#if showMarkers}
		<SeriesMarkers {dataKey} {color} appearance={markerAppearance} />
	{/if}
	{#if terminalMarker}
		<TerminalMarker {dataKey} {color} />
	{/if}
	{#if loading && leads && loadingStyle === "sweep"}
		<LoadingSweep curve={curveFactory} />
	{/if}
	{#if loading && leads && loadingStyle === "pulse"}
		<LoadingPulse curve={curveFactory} />
	{/if}
</g>
