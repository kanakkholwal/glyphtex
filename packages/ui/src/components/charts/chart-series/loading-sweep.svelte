<svelte:options namespace="svg" />

<script lang="ts">
	import { type CurveFactory, area as d3Area } from "d3-shape";
	import { linePath } from "../chart/core.js";
	import { CHART_EASE_CSS, type Playback, prefersReducedMotion, tween } from "../chart/motion.js";
	import { useCartesian } from "../chart/context.js";
	import { cn } from "../../../lib/cn.js";
	import { SWEEP_CYCLE, SWEEP_EXIT, skeletonHeights, sweepStops } from "./core";
	import { seriesLoading } from "./variants";
	import { createLoadingMode, silhouette } from "./loading-mode.svelte";

	let {
		curve,
		withArea = false,
		strokeWidth = 2,
		pointCount = 14,
		class: className
	}: {
		curve: CurveFactory;
		/** Fill the silhouette as an area, for area charts. */
		withArea?: boolean;
		strokeWidth?: number;
		pointCount?: number;
		class?: string;
	} = $props();

	const plot = useCartesian();
	const loading = createLoadingMode(() => plot.phase);
	const uid = $props.id();
	const stops = sweepStops();
	let band = $state<SVGRectElement | null>(null);
	let seed = $state(0);
	const reduced = prefersReducedMotion();
	const looping = $derived(loading.mode === "loop");

	$effect(() => {
		const node = band;
		if (!looping || reduced || !node) return;
		let playback: Playback | null = null;
		let last = -1;
		const cycle = () => {
			playback = tween({
				duration: SWEEP_CYCLE,
				ease: (t) => t,
				onUpdate: (t) => {
					const x = -1 + t * 3;
					node.setAttribute("x", String(x));
					if (x >= 1 && last < 1) seed += 1;
					last = x;
				},
				onComplete: () => {
					last = -1;
					cycle();
				}
			});
		};
		cycle();
		return () => playback?.stop();
	});

	$effect(() => {
		if (loading.mode === "exit" && prefersReducedMotion()) loading.finish();
	});

	const points = $derived(
		silhouette(skeletonHeights(pointCount, seed), plot.innerWidth, plot.innerHeight)
	);
	const areaPath = $derived(
		d3Area<{ x: number; y: number }>()
			.x((p) => p.x)
			.y0(plot.innerHeight)
			.y1((p) => p.y)
			.curve(curve)(points) ?? ""
	);
</script>

{#snippet body()}
	{#if withArea}
		<path d={areaPath} fill="url(#{uid}-area)" stroke="none" />
	{/if}
	<path d={linePath(points, curve)} stroke-width={strokeWidth} stroke="currentColor" />
{/snippet}

{#if loading.mode && plot.innerWidth > 0}
	<g
		data-slot="chart-loading-sweep"
		class={cn(seriesLoading({ style: "sweep" }), className)}
		style:opacity={loading.mode === "exit" ? 0 : 1}
		style:transition="opacity {SWEEP_EXIT}ms {CHART_EASE_CSS}"
		ontransitionend={() => loading.mode === "exit" && loading.finish()}
	>
		<defs>
			{#if withArea}
				<linearGradient id="{uid}-area" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0%" stop-color="currentColor" stop-opacity={0.18} />
					<stop offset="100%" stop-color="currentColor" stop-opacity={0.02} />
				</linearGradient>
			{/if}
			<linearGradient id="{uid}-band" x1="0" x2="1" y1="0" y2="0">
				{#each stops as stop (stop.offset)}
					<stop offset={stop.offset} stop-color="white" stop-opacity={stop.opacity} />
				{/each}
			</linearGradient>
			<pattern
				id="{uid}-pattern"
				width={3}
				height={1}
				x={0}
				y={0}
				patternUnits="objectBoundingBox"
				patternContentUnits="objectBoundingBox"
				patternTransform="rotate(25)"
			>
				<rect bind:this={band} x={-1} y={0} width={1} height={1} fill="url(#{uid}-band)" />
			</pattern>
			<mask id="{uid}-mask" maskUnits="userSpaceOnUse">
				<rect width={plot.innerWidth} height={plot.innerHeight} fill="url(#{uid}-pattern)" />
			</mask>
		</defs>
		{#if reduced}
			{@render body()}
		{:else}
			<g mask="url(#{uid}-mask)">{@render body()}</g>
		{/if}
	</g>
{/if}
