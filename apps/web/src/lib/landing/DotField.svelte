<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";

	/** A sparse field of dots in a diagonal band, seeded so server and client render the same dots. */
	let {
		cols = 28,
		rows = 22,
		seed = 1,
		flip = false,
		class: className
	}: { cols?: number; rows?: number; seed?: number; flip?: boolean; class?: string } = $props();

	const STEP = 12;

	function rng(start: number) {
		let a = start;
		return () => {
			a += 0x6d2b79f5;
			let t = a;
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	const dots = $derived.by(() => {
		const rand = rng(seed);
		const out: { x: number; y: number; kind: "fill" | "ring" | "faint" }[] = [];
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const along = (c / cols + r / rows) / 2;
				const band = Math.abs(c / cols - r / rows);
				const reach = 0.3 * (1 - Math.abs(along - 0.5) * 1.5);
				if (band > reach) continue;
				const roll = rand();
				const x = flip ? (cols - 1 - c) * STEP : c * STEP;
				if (roll < 0.08) out.push({ x, y: r * STEP, kind: "fill" });
				else if (roll < 0.22) out.push({ x, y: r * STEP, kind: "ring" });
				else if (roll < 0.6) out.push({ x, y: r * STEP, kind: "faint" });
			}
		}
		return out;
	});
</script>

<svg
	aria-hidden="true"
	viewBox="0 0 {cols * STEP} {rows * STEP}"
	class={cn('pointer-events-none text-accent-ink', className)}
>
	{#each dots as d (d.x + '-' + d.y)}
		{#if d.kind === 'fill'}
			<circle cx={d.x + 4} cy={d.y + 4} r="2.6" fill="currentColor" opacity="0.7" />
		{:else if d.kind === 'ring'}
			<circle cx={d.x + 4} cy={d.y + 4} r="2.4" fill="none" stroke="currentColor" stroke-width="1" opacity="0.45" />
		{:else}
			<circle cx={d.x + 4} cy={d.y + 4} r="1.6" fill="currentColor" opacity="0.18" />
		{/if}
	{/each}
</svg>
