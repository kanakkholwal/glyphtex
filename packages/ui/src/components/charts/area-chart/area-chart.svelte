<script lang="ts">
	import type { ComponentProps } from "svelte";
	import TimeSeriesChart from "../chart/time-series-chart.svelte";
	import { setStack } from "./context";

	let {
		activeIndex = $bindable(null),
		stacked = false,
		roleDescription = "area chart",
		...rest
	}: Omit<ComponentProps<typeof TimeSeriesChart>, "roleDescription"> & {
		/** Stack areas in the order they render; the domain grows to the tallest total. */
		stacked?: boolean;
		/** Announced after the chart's name, e.g. "area chart". */
		roleDescription?: string;
	} = $props();

	let keys = $state<string[]>([]);
	setStack({
		get stacked() {
			return stacked;
		},
		get keys() {
			return keys;
		},
		register(key: string) {
			if (!keys.includes(key)) keys = [...keys, key];
			return () => {
				keys = keys.filter((k) => k !== key);
			};
		}
	});
</script>

<TimeSeriesChart bind:activeIndex {roleDescription} {...rest} />
