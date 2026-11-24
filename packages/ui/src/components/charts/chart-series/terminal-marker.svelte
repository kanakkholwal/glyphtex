<svelte:options namespace="svg" />

<script lang="ts">
	import { useChart, usePlot } from "../chart/context.js";
	import { cn } from "../../../lib/cn.js";

	let {
		dataKey,
		color,
		radius = 5,
		class: className
	}: { dataKey: string; color: string; radius?: number; class?: string } = $props();

	const plot = usePlot();
	const chart = useChart();
	const last = $derived(plot.data.at(-1));
	const value = $derived(last?.[dataKey]);
	const visible = $derived(plot.phase === "ready" || plot.phase === "concealing");
</script>

{#if last && typeof value === "number" && !chart.hidden.has(dataKey)}
	<g transform="translate({plot.x(last)}, {plot.yScale(value)})">
		<circle
			data-slot="chart-terminal-marker"
			r={radius}
			stroke={color}
			stroke-width={1.5}
			class={cn(
				"fill-background transition-[opacity,scale] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] [transform-box:fill-box] [transform-origin:center] starting:scale-[0.55] starting:opacity-0",
				visible ? "scale-100 opacity-100" : "scale-[0.55] opacity-0",
				className,
			)}
		/>
	</g>
{/if}
