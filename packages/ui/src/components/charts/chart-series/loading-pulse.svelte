<svelte:options namespace="svg" />

<script lang="ts">
	import type { CurveFactory } from "d3-shape";
	import { fadeStops, linePath } from "../chart/core.js";
	import { type Playback, prefersReducedMotion, tween } from "../chart/motion.js";
	import { useCartesian } from "../chart/context.js";
	import { cn } from "../../../lib/cn.js";
	import {
		PULSE_CLIP_PAD,
		PULSE_CYCLE,
		PULSE_PAUSE,
		pulseClip,
		pulseExitPlan,
		pulseSkeleton
	} from "./core";
	import { seriesLoading } from "./variants";
	import { createLoadingMode, silhouette } from "./loading-mode.svelte";

	let {
		curve,
		strokeWidth = 2.5,
		class: className
	}: { curve: CurveFactory; strokeWidth?: number; class?: string } = $props();

	const plot = useCartesian();
	const loading = createLoadingMode(() => plot.phase);
	const uid = $props.id();
	let rect = $state<SVGRectElement | null>(null);
	let progress = 0;

	$effect(() => {
		const mode = loading.mode;
		const width = plot.innerWidth;
		const node = rect;
		if (!mode || width <= 0 || !node) return;
		const draw = (p: number) => {
			progress = p;
			const clip = pulseClip(p, width);
			node.setAttribute("x", String(clip.x));
			node.setAttribute("width", String(clip.width));
		};
		if (prefersReducedMotion()) {
			draw(0.5);
			if (mode === "exit") loading.finish();
			return;
		}
		let playback: Playback | null = null;
		let timer: ReturnType<typeof setTimeout> | undefined;
		if (mode === "loop") {
			const cycle = () => {
				playback = tween({
					duration: PULSE_CYCLE,
					onUpdate: draw,
					onComplete: () => {
						timer = setTimeout(cycle, PULSE_PAUSE);
					}
				});
			};
			cycle();
		} else {
			const from = progress;
			const plan = pulseExitPlan(from);
			const shrink = () => {
				const start = Math.max(progress, 0.5);
				playback = tween({
					duration: plan.shrink,
					onUpdate: (t) => draw(start + (1 - start) * t),
					onComplete: () => loading.finish()
				});
			};
			if (plan.grow > 0) {
				playback = tween({
					duration: plan.grow,
					onUpdate: (t) => draw(from + (0.5 - from) * t),
					onComplete: shrink
				});
			} else shrink();
		}
		return () => {
			playback?.stop();
			clearTimeout(timer);
		};
	});

	const d = $derived(
		linePath(silhouette(pulseSkeleton(), plot.innerWidth, plot.innerHeight), curve)
	);
</script>

{#if loading.mode && plot.innerWidth > 0}
	<g data-slot="chart-loading-pulse" class={cn(seriesLoading({ style: "pulse" }), className)}>
		<defs>
			<clipPath id="{uid}-clip">
				<rect
					bind:this={rect}
					x={-PULSE_CLIP_PAD}
					y={-PULSE_CLIP_PAD}
					width={0}
					height={plot.innerHeight + PULSE_CLIP_PAD * 2}
				/>
			</clipPath>
			<linearGradient
				id="{uid}-fade"
				gradientUnits="userSpaceOnUse"
				x1={0}
				x2={plot.innerWidth}
				y1={0}
				y2={0}
			>
				{#each fadeStops(true) as stop (stop.offset)}
					<stop offset={stop.offset} stop-color="currentColor" stop-opacity={stop.opacity} />
				{/each}
			</linearGradient>
		</defs>
		<path
			{d}
			clip-path="url(#{uid}-clip)"
			stroke="url(#{uid}-fade)"
			stroke-width={strokeWidth}
		/>
	</g>
{/if}
