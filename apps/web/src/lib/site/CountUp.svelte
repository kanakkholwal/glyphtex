<script lang="ts">
	import { onMount } from "svelte";

	let {
		value,
		suffix = "",
		duration = 1200
	}: {
		value: number;
		/** Appended after the number, e.g. "+" when the value is a floor. */
		suffix?: string;
		duration?: number;
	} = $props();

	const format = new Intl.NumberFormat("en");
	// Null until hydrated, so SSR and no-JS render the real number.
	let counted = $state<number | null>(null);
	const shown = $derived(counted ?? value);

	onMount(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		let frame = 0;
		const start = performance.now();
		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / duration);
			counted = t < 1 ? Math.round(value * (1 - (1 - t) ** 3)) : null;
			if (t < 1) frame = requestAnimationFrame(tick);
		};
		counted = 0;
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});
</script>

<span class="sr-only">{format.format(value)}{suffix}</span>
<span aria-hidden="true">{format.format(shown)}{suffix}</span>
