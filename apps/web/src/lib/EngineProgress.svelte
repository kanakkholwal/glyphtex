<script lang="ts">
	import { IconLoader2 } from "@tabler/icons-svelte";
	import type { InstallProgress } from "$lib/compile";

	let { progress, label }: { progress: InstallProgress | undefined; label: string } = $props();

	// total 0 means no size is known, so no percentage can be shown.
	const measurable = $derived(!!progress && progress.total > 0);
	const pct = $derived(
		progress && measurable ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0
	);
	const mb = (bytes: number) => (bytes / 1048576).toFixed(1);
	const sizeLabel = $derived.by(() => {
		if (!progress || progress.loaded === 0) return "";
		return measurable
			? `${mb(Math.min(progress.loaded, progress.total))} of ${mb(progress.total)} MB`
			: `${mb(progress.loaded)} MB`;
	});
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-2 text-xs">
		<IconLoader2 size={14} class="text-muted-foreground animate-spin" aria-hidden="true" />
		<span class="text-foreground min-w-0 flex-1 truncate font-medium">
			{progress?.label ?? "Preparing…"}
		</span>
		<span class="text-muted-foreground shrink-0 tabular-nums">
			{#if measurable}{pct}%{/if}
		</span>
	</div>
	<div
		class="bg-muted h-2 overflow-hidden rounded-full"
		role="progressbar"
		aria-label={label}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={measurable ? pct : undefined}
		aria-valuetext={measurable ? `${pct}%, ${sizeLabel}` : sizeLabel || "Preparing"}
	>
		{#if measurable}
			<div
				class="bg-primary h-full rounded-full transition-[width] duration-(--duration-base)"
				style:width="{pct}%"
			></div>
		{:else}
			<!-- Size unknown: a travelling sliver reads as working, not a stalled 0%. -->
			<div class="bg-primary engine-progress-indeterminate h-full w-1/3 rounded-full"></div>
		{/if}
	</div>
	{#if sizeLabel}
		<p class="text-muted-foreground text-xs tabular-nums">{sizeLabel}</p>
	{/if}
</div>

<style>
	.engine-progress-indeterminate {
		animation: engine-progress-slide 1.4s ease-in-out infinite;
	}

	@keyframes engine-progress-slide {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(300%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.engine-progress-indeterminate {
			animation: none;
			width: 50%;
		}
	}
</style>
