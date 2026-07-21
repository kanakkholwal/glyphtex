<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '@glyphx/ui/dialog';
	import { Button } from '@glyphx/ui/button';
	import { IconCpu, IconLoader2, IconAlertTriangle, IconWifiOff } from '@tabler/icons-svelte';
	import { installEngine, type InstallProgress } from '$lib/compile';

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
		class="sm:max-w-md"
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<IconCpu size={18} class="text-primary" />
				Set up the LaTeX compiler
			</DialogTitle>
			<DialogDescription class="leading-relaxed">
				GlyphX compiles LaTeX right in your browser — the same engine the desktop app uses. It
				downloads once (~{totalMB} MB) and is cached on this device.
			</DialogDescription>
		</DialogHeader>

		<div class="border-border bg-muted/40 flex items-start gap-2.5 rounded-lg border p-3">
			<IconWifiOff size={16} class="text-muted-foreground mt-0.5 shrink-0" />
			<p class="text-muted-foreground min-w-0 flex-1 text-xs leading-relaxed">
				After this, compiling works <span class="text-foreground font-medium">fully offline</span>.
				Your documents never leave your device, and there's no package server to wait on.
			</p>
		</div>

		{#if installing}
			<div class="flex flex-col gap-1.5">
				<div class="text-muted-foreground flex items-center gap-2 text-xs">
					<IconLoader2 size={14} class="animate-spin" />
					<span class="min-w-0 flex-1 truncate">{progress?.label ?? 'Preparing…'}</span>
					<span class="shrink-0 tabular-nums">
						{#if measurable}
							{pct}%
						{:else if progress && progress.loaded > 0}
							{mb(progress.loaded)} MB
						{/if}
					</span>
				</div>
				<div class="bg-muted h-1.5 overflow-hidden rounded-full">
					{#if measurable}
						<div class="bg-primary h-full rounded-full transition-all" style="width:{pct}%"></div>
					{:else}
						<!-- Size unknown: a travelling sliver reads as working, not a stalled 0%. -->
						<div class="bg-primary engine-progress-indeterminate h-full w-1/3 rounded-full"></div>
					{/if}
				</div>
			</div>
		{/if}

		{#if error}
			<div
				class="border-destructive/30 bg-destructive/5 flex items-start gap-2 rounded-md border p-2.5"
				role="alert"
			>
				<IconAlertTriangle size={15} class="text-destructive mt-0.5 shrink-0" />
				<p class="text-foreground/90 min-w-0 flex-1 text-xs leading-relaxed">{error}</p>
			</div>
		{/if}

		<div class="flex items-center justify-end">
			<Button size="sm" onclick={start} disabled={installing}>
				{#if installing}
					Installing…
				{:else if error}
					Try again
				{:else}
					Download & install
				{/if}
			</Button>
		</div>
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
