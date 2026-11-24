<svelte:options namespace="svg" />

<script lang="ts">
	import { useCartesian } from "../chart/context.js";

	let {
		d,
		fromX,
		stroke,
		strokeWidth,
		class: className,
		style
	}: {
		d: string;
		/** Plot x where the stroke turns dashed, e.g. the start of an incomplete period. */
		fromX: number;
		stroke: string;
		strokeWidth: number;
		class?: string;
		style?: string;
	} = $props();

	const PAD = 10;
	const plot = useCartesian();
	const uid = $props.id();
	const height = $derived(plot.innerHeight + PAD * 2);
</script>

<g data-slot="chart-dash-tail" class={className} {style}>
	<defs>
		<clipPath id="{uid}-solid">
			<rect x={-PAD} y={-PAD} width={Math.max(0, fromX + PAD)} {height} />
		</clipPath>
		<clipPath id="{uid}-dash">
			<rect x={fromX} y={-PAD} width={Math.max(0, plot.innerWidth - fromX + PAD)} {height} />
		</clipPath>
	</defs>
	<path
		{d}
		clip-path="url(#{uid}-solid)"
		{stroke}
		stroke-width={strokeWidth}
		class="fill-none [stroke-linecap:round]"
	/>
	<path
		data-slot="chart-dash-tail-dashed"
		{d}
		clip-path="url(#{uid}-dash)"
		{stroke}
		stroke-width={strokeWidth}
		class="fill-none [stroke-dasharray:6_4]"
	/>
</g>
