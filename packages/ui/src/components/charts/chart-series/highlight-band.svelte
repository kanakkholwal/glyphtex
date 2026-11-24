<svelte:options namespace="svg" />

<script lang="ts">
	import { CHART_SPRING, Spring } from "../chart/motion.js";
	import { useActivePoint, usePlot } from "../chart/context.js";
	import { cn } from "../../../lib/cn.js";
	import { highlightBounds } from "./core";

	let {
		d,
		stroke,
		strokeWidth,
		class: className
	}: {
		/** The series path to re-stroke inside the band. */
		d: string;
		stroke: string;
		strokeWidth: number;
		class?: string;
	} = $props();

	const plot = usePlot();
	const pointer = useActivePoint();
	const uid = $props.id();
	let rect = $state<SVGRectElement | null>(null);
	const left = new Spring(0, CHART_SPRING.highlight, (v) => rect?.setAttribute("x", String(v)));
	const width = new Spring(0, CHART_SPRING.highlight, (v) =>
		rect?.setAttribute("width", String(Math.max(0, v)))
	);
	// A selected range takes over the band while dragging.
	const bounds = $derived(
		plot.phase !== "ready"
			? null
			: plot.selectionX
				? { x: plot.selectionX[0], width: plot.selectionX[1] - plot.selectionX[0] }
				: pointer.active
					? highlightBounds(plot.data, pointer.active.index, plot.x)
					: null
	);
	let shown = false;
	$effect(() => {
		const next = bounds;
		const instant = pointer.instant;
		if (!next || !rect) {
			shown = false;
			return;
		}
		if (!shown || instant) {
			left.jump(next.x);
			width.jump(next.width);
		} else {
			left.set(next.x);
			width.set(next.width);
		}
		shown = true;
	});
	$effect(() => () => {
		left.stop();
		width.stop();
	});
</script>

{#if bounds}
	<g data-slot="chart-highlight" class="pointer-events-none">
		<defs>
			<clipPath id="{uid}-highlight">
				<rect bind:this={rect} y={0} height={plot.innerHeight} />
			</clipPath>
		</defs>
		<path
			{d}
			clip-path="url(#{uid}-highlight)"
			{stroke}
			stroke-width={strokeWidth}
			class={cn(
				"fill-none opacity-100 transition-opacity duration-[400ms] ease-[cubic-bezier(0.42,0,0.58,1)] [stroke-linecap:round] starting:opacity-0",
				className,
			)}
		/>
	</g>
{/if}
