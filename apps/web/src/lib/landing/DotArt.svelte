<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";

	/** A bitmap drawn in dots: `#` solid, `o` ring, `.` faint. Decorative only. */
	let { rows, class: className }: { rows: string[]; class?: string } = $props();

	const STEP = 12;
	const width = $derived(Math.max(...rows.map((r) => r.length)) * STEP);
	const height = $derived(rows.length * STEP);
</script>

<svg
	aria-hidden="true"
	viewBox="0 0 {width} {height}"
	class={cn('text-accent-ink', className)}
>
	{#each rows as row, y (y)}
		{#each [...row] as ch, x (x)}
			{#if ch === '#'}
				<circle cx={x * STEP + 6} cy={y * STEP + 6} r="3.4" fill="currentColor" />
			{:else if ch === 'o'}
				<circle cx={x * STEP + 6} cy={y * STEP + 6} r="3.2" fill="none" stroke="currentColor" stroke-width="1.2" />
			{:else}
				<circle cx={x * STEP + 6} cy={y * STEP + 6} r="1.6" fill="currentColor" opacity="0.22" />
			{/if}
		{/each}
	{/each}
</svg>
