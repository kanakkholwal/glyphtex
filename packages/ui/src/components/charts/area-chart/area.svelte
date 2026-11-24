<svelte:options namespace="svg" />

<script lang="ts">
	import { untrack } from "svelte";
	import {
		type FadeEdges,
		fadeStops,
		interpolatePoints,
		linePath,
		seriesColor,
		seriesVisibleInPhase
	} from "../chart/core.js";
	import { CHART_DURATION, tween } from "../chart/motion.js";
	import { useActivePoint, useChart, usePlot } from "../chart/context.js";
	import { useExtentRegistry } from "../chart/time-series-chart.svelte";
	import HighlightBand from "../chart-series/highlight-band.svelte";
	import LoadingPulse from "../chart-series/loading-pulse.svelte";
	import LoadingSweep from "../chart-series/loading-sweep.svelte";
	import SeriesMarkers from "../chart-series/series-markers.svelte";
	import type { SeriesLoadingStyle } from "../chart-series/variants.js";
	import { cn } from "../../../lib/cn.js";
	import { LINE_CURVES, type LineCurve } from "../line-chart/variants.js";
	import { areaPath, type Band, bandPoints, bandSignature, stackMax } from "./geometry";
	import { type AreaVariant, area } from "./variants";
	import { useStack } from "./context";

	let {
		dataKey,
		color: colorProp,
		variant = "gradient",
		curve = "natural",
		line = true,
		strokeWidth = 2,
		fillOpacity = 0.4,
		fadeEdges = false,
		showHighlight = true,
		showMarkers = false,
		loadingStyle = "pulse",
		loading = true,
		class: className
	}: {
		dataKey: string;
		/** Defaults to the series colour from the chart config, `var(--color-<dataKey>)`. */
		color?: string;
		variant?: AreaVariant;
		curve?: LineCurve;
		/** Stroke the top edge. */
		line?: boolean;
		strokeWidth?: number;
		/** Top opacity of the gradient and solid fills. */
		fillOpacity?: number;
		/** Fade the area into the plot edges. */
		fadeEdges?: FadeEdges;
		showHighlight?: boolean;
		/** Point markers; ignored when stacked since they mark raw values. */
		showMarkers?: boolean;
		loadingStyle?: SeriesLoadingStyle;
		/** Set false to hide the loading visual while the chart loads. */
		loading?: boolean;
		class?: string;
	} = $props();

	const plot = usePlot();
	const chart = useChart();
	const pointer = useActivePoint();
	const stack = useStack();
	const registerExtent = useExtentRegistry();
	const uid = $props.id();
	const color = $derived(colorProp ?? seriesColor(dataKey));

	$effect(() => {
		const next = { key: dataKey, color };
		return untrack(() => plot.register(next));
	});
	$effect(() => {
		const key = dataKey;
		return untrack(() => stack.register(key));
	});

	const below = $derived.by(() => {
		if (!stack.stacked) return [];
		const visible = stack.keys.filter((k) => !chart.hidden.has(k));
		return visible.slice(0, Math.max(0, visible.indexOf(dataKey)));
	});
	const top = $derived(
		stack.stacked && !chart.hidden.has(dataKey) ? stackMax(plot.data, dataKey, below) : 0
	);
	$effect(() => {
		const value = top;
		if (!value) return;
		return untrack(() => registerExtent(`${uid}-stack`, { y: [0, value] }));
	});

	const floor = $derived.by(() => {
		const [d0, d1] = plot.yScale.domain() as [number, number];
		return plot.yScale(Math.min(Math.max(0, d0), d1));
	});
	const target = $derived(
		bandPoints({
			data: plot.data,
			key: dataKey,
			below,
			xKey: plot.xKey,
			x: plot.x,
			y: (v) => plot.yScale(v),
			floor
		})
	);
	const signature = $derived(
		`${bandSignature(plot.data, [dataKey, ...below], plot.xKey, plot.innerWidth)}|${plot.xScale
			.domain()
			.map(Number)
			.join(",")}`
	);

	// Top and bottom edges morph together over 500ms when data, width or stacking change.
	let progress = $state(1);
	let from: Band = { top: [], bottom: [] };
	let shown: Band = { top: [], bottom: [] };
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
	const band = $derived<Band>(
		progress >= 1
			? target
			: {
					top: interpolatePoints(from.top, target.top, progress),
					bottom: interpolatePoints(from.bottom, target.bottom, progress)
				}
	);
	$effect.pre(() => {
		shown = band;
	});

	const curveFactory = $derived(LINE_CURVES[curve]);
	const fillPath = $derived(areaPath(band, curveFactory));
	const topPath = $derived(linePath(band.top, curveFactory));
	const isHidden = $derived(chart.hidden.has(dataKey));
	const dimmed = $derived(
		pointer.active !== null ||
			Boolean(plot.selection) ||
			(chart.highlighted !== null && chart.highlighted !== dataKey)
	);
	const drawn = $derived(seriesVisibleInPhase(plot.phase));
	const styles = $derived(area({ variant }));
	const fade = $derived(fadeEdges !== false);
	const leads = $derived(plot.series[0]?.key === dataKey);
	const fill = $derived(
		variant === "pattern"
			? `url(#${uid}-pattern)`
			: variant === "gradient"
				? `url(#${uid}-fill)`
				: color
	);
</script>

<g data-slot="chart-area" data-series={dataKey} data-variant={variant}>
	<g
		clip-path="url(#{plot.clipId})"
		class={cn(styles.layer(), className)}
		style:opacity={isHidden ? 0 : dimmed ? 0.6 : 1}
		mask={fade ? `url(#${uid}-fade)` : undefined}
	>
		<defs>
			<linearGradient id="{uid}-fill" x1="0%" x2="0%" y1="0%" y2="100%">
				<stop offset="0%" stop-color={color} stop-opacity={fillOpacity} />
				<stop offset="100%" stop-color={color} stop-opacity={0} />
			</linearGradient>
			<pattern
				id="{uid}-pattern"
				width={6}
				height={6}
				patternUnits="userSpaceOnUse"
				patternTransform="rotate(45)"
			>
				<rect width={6} height={6} fill={color} fill-opacity={fillOpacity * 0.35} />
				<line x1={0} x2={0} y1={0} y2={6} stroke={color} stroke-width={1.5} />
			</pattern>
			{#if fade}
				<linearGradient
					id="{uid}-fade-g"
					gradientUnits="userSpaceOnUse"
					x1={0}
					x2={plot.innerWidth}
					y1={0}
					y2={0}
				>
					{#each fadeStops(fadeEdges) as stop (stop.offset)}
						<stop offset={stop.offset} stop-color="white" stop-opacity={stop.opacity} />
					{/each}
				</linearGradient>
				<mask id="{uid}-fade">
					<rect
						x={-8}
						y={-8}
						width={plot.innerWidth + 16}
						height={plot.innerHeight + 16}
						fill="url(#{uid}-fade-g)"
					/>
				</mask>
			{/if}
		</defs>
		<path d={fillPath} class={styles.fill()} fill={drawn ? fill : "transparent"} />
		{#if line}
			<path
				d={topPath}
				class={styles.stroke()}
				stroke={drawn ? color : "transparent"}
				stroke-width={strokeWidth}
			/>
		{/if}
	</g>
	{#if showHighlight && line && !isHidden}
		<HighlightBand d={topPath} stroke={color} {strokeWidth} />
	{/if}
	{#if showMarkers && !stack.stacked}
		<SeriesMarkers {dataKey} {color} />
	{/if}
	{#if loading && leads && loadingStyle === "sweep"}
		<LoadingSweep curve={curveFactory} withArea />
	{/if}
	{#if loading && leads && loadingStyle === "pulse"}
		<LoadingPulse curve={curveFactory} />
	{/if}
</g>
