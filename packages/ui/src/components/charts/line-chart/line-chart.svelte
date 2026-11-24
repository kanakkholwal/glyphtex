<script lang="ts">
	import type { ComponentProps } from "svelte";
	import TimeSeriesChart from "../chart/time-series-chart.svelte";

	let {
		activeIndex = $bindable(null),
		roleDescription = "line chart",
		...rest
	}: Omit<ComponentProps<typeof TimeSeriesChart>, "roleDescription"> & {
		/** Announced after the chart's name, e.g. "line chart". */
		roleDescription?: string;
	} = $props();
</script>

<TimeSeriesChart bind:activeIndex {roleDescription} {...rest} />
