<svelte:options namespace="svg" />

<script lang="ts">
	import { type SeriesMarkerAppearance, seriesMarker } from "./variants";

	let {
		color,
		radius,
		appearance
	}: { color: string; radius: number; appearance: SeriesMarkerAppearance } = $props();

	const RING_GAP = 2;
	const RING_WIDTH = 2;
	const styles = $derived(seriesMarker({ appearance }));
	const hollow = $derived(appearance === "hollow");
</script>

<circle
	class={styles.dot()}
	r={radius}
	fill={hollow ? undefined : color}
	stroke={hollow ? color : undefined}
	stroke-width={hollow ? RING_WIDTH : undefined}
/>
<circle
	class={styles.ring()}
	r={radius + RING_GAP + RING_WIDTH / 2}
	stroke={color}
	stroke-width={RING_WIDTH}
/>
