<script lang="ts">
	import { updater } from "./updater.svelte";

	const mb = (bytes: number) => (bytes / 1_048_576).toFixed(1);
	const pct = $derived(updater.progress === null ? null : Math.round(updater.progress * 100));
	const label = $derived(
		updater.totalBytes > 0
			? `${mb(updater.receivedBytes)} of ${mb(updater.totalBytes)} MB`
			: `${mb(updater.receivedBytes)} MB`
	);
</script>

<div class="flex flex-col gap-1.5">
	<div class="flex items-center justify-between gap-3 text-xs text-muted-foreground tabular-nums">
		<span>{label}</span>
		{#if pct !== null}<span class="font-medium text-foreground">{pct}%</span>{/if}
	</div>
	<div
		class="h-1.5 overflow-hidden rounded-full bg-muted"
		role="progressbar"
		aria-label="Update download"
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={pct ?? undefined}
		aria-valuetext={pct === null ? `${label} downloaded` : `${pct}%, ${label}`}
	>
		<!-- Unknown size: a full muted-primary bar instead of a looping animation. -->
		<div
			class="h-full rounded-full transition-[width] duration-200 ease-craft {pct === null
				? 'w-full bg-primary/30'
				: 'bg-primary'}"
			style:width={pct === null ? undefined : `${pct}%`}
		></div>
	</div>
</div>
