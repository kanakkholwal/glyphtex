<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from "@glyphtex/ui/dialog";
	import { Button } from "@glyphtex/ui/button";
	import { IconCpu, IconLoader2, IconAlertTriangle, IconWifiOff } from "@tabler/icons-svelte";
	import { installEngine, type InstallProgress } from "$lib/compile";

	let { open = $bindable(false), ondone }: { open?: boolean; ondone?: () => void } = $props();

	let installing = $state(false);
	let progress = $state<InstallProgress | undefined>(undefined);
	let error = $state<string | undefined>(undefined);

	// total 0 means the server compressed in transit, so no percentage is knowable.
	const measurable = $derived(!!progress && progress.total > 0);
	const pct = $derived(
		progress && measurable ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0
	);

	const mb = (bytes: number) => (bytes / 1048576).toFixed(1);

	/** Rough download size for the pre-install copy; the real one is the engine's. */
	const totalMB = $derived(measurable && progress ? Math.round(progress.total / 1048576) : 12);

	const sizeLabel = $derived.by(() => {
		if (!progress || progress.loaded === 0) return "";
		return measurable
			? `${mb(progress.loaded)} of ${mb(progress.total)} MB`
			: `${mb(progress.loaded)} MB`;
	});

	async function start() {
		installing = true;
		error = undefined;
		progress = undefined;
		try {
			await installEngine((p) => (progress = p));
			open = false;
			ondone?.();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			installing = false;
		}
	}

	// Required install: dismiss paths are disabled on <DialogContent> below, so the
	// dialog only closes when `start()` sets `open = false` on success.
</script>

<Dialog bind:open>
	<DialogContent
		showCloseButton={false}
		interactOutsideBehavior="ignore"
		escapeKeydownBehavior="ignore"
		class="gap-5 p-6 sm:max-w-md"
	>
		<DialogHeader class="gap-3">
			<span
				class="border-border bg-card text-primary grid size-10 place-items-center rounded-lg border"
				aria-hidden="true"
			>
				<IconCpu size={20} />
			</span>
			<DialogTitle class="text-body-lg">Set up the LaTeX compiler</DialogTitle>
			<DialogDescription class="text-body">
				GlyphTeX compiles LaTeX right in your browser with the same engine as the desktop app. It
				downloads once (about {totalMB} MB) and stays cached on this device.
			</DialogDescription>
		</DialogHeader>

		<div class="border-border bg-muted flex items-start gap-3 rounded-xl border p-3">
			<IconWifiOff size={16} class="text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
			<p class="text-muted-foreground text-caption min-w-0 flex-1">
				After this, compiling works <span class="text-foreground font-medium">fully offline</span>.
				Your documents never leave your device.
			</p>
		</div>

		{#if installing}
			<div class="flex flex-col gap-2">
				<div class="text-caption flex items-center gap-2">
					<IconLoader2 size={14} class="text-muted-foreground animate-spin" aria-hidden="true" />
					<span class="text-foreground min-w-0 flex-1 truncate font-medium">
						{progress?.label ?? 'Preparing…'}
					</span>
					<span class="text-muted-foreground shrink-0 tabular-nums">
						{#if measurable}{pct}%{/if}
					</span>
				</div>
				<div
					class="bg-muted h-2 overflow-hidden rounded-full"
					role="progressbar"
					aria-label="Compiler download"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={measurable ? pct : undefined}
					aria-valuetext={measurable ? `${pct}%, ${sizeLabel}` : sizeLabel || 'Preparing'}
				>
					{#if measurable}
						<div
							class="bg-primary h-full rounded-full transition-[width] duration-200"
							style:width="{pct}%"
						></div>
					{:else}
						<!-- Size unknown: a travelling sliver reads as working, not a stalled 0%. -->
						<div class="bg-primary engine-progress-indeterminate h-full w-1/3 rounded-full"></div>
					{/if}
				</div>
				{#if sizeLabel}
					<p class="text-muted-foreground text-caption tabular-nums">{sizeLabel}</p>
				{/if}
			</div>
		{/if}

		{#if error}
			<div
				class="border-destructive/30 bg-destructive/5 flex items-start gap-2 rounded-xl border p-3"
				role="alert"
			>
				<IconAlertTriangle size={16} class="text-destructive mt-0.5 shrink-0" aria-hidden="true" />
				<p class="text-foreground text-caption min-w-0 flex-1">
					<span class="font-medium">Download failed.</span>
					{error}
				</p>
			</div>
		{/if}

		<Button variant="primary" class="w-full sm:ml-auto sm:w-auto" onclick={start} disabled={installing}>
			{#if installing}
				Installing…
			{:else if error}
				Try again
			{:else}
				Download and install
			{/if}
		</Button>
	</DialogContent>
</Dialog>

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
