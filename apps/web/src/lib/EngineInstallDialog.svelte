<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from "@glyphtex/ui/dialog";
	import { Button } from "@glyphtex/ui/button";
	import { IconCpu, IconAlertTriangle, IconWifiOff } from "@tabler/icons-svelte";
	import { installEngine, type InstallProgress } from "$lib/compile";
	import EngineProgress from "./EngineProgress.svelte";

	let {
		open = $bindable(false),
		ondone,
		update = false,
		sizeBytes
	}: {
		open?: boolean;
		ondone?: () => void;
		/** An older compiler is installed: say update, not first-time setup. */
		update?: boolean;
		/** Exact download size when known, from the manifest and pack index. */
		sizeBytes?: number;
	} = $props();

	let installing = $state(false);
	let progress = $state<InstallProgress | undefined>(undefined);
	let error = $state<string | undefined>(undefined);

	/** Exact when the caller knows it, otherwise a rough figure for the pre-install copy. */
	const totalMB = $derived(Math.round((sizeBytes ?? 0) / 1048576) || 12);

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

	// Required install: the setter drops Escape and backdrop closes, so the dialog
	// only closes when `start()` sets `open = false` on success.
</script>

<Dialog
	bind:open={() => open, (next) => {
		if (next) open = true;
	}}
	dismissOnBackdrop={false}
>
	<DialogContent class="sm:max-w-md">
		<DialogHeader class="gap-3">
			<span
				class="border-border bg-card text-primary grid size-10 place-items-center rounded-lg border"
				aria-hidden="true"
			>
				<IconCpu size={20} />
			</span>
			<DialogTitle class="text-base">
				{update ? "Update the LaTeX compiler" : "Set up the LaTeX compiler"}
			</DialogTitle>
			<DialogDescription class="text-md">
				{#if update}
					A newer compiler is available (about {totalMB} MB). It replaces the cached one; your
					documents are not touched.
				{:else}
					GlyphTeX compiles LaTeX right in your browser with the same engine as the desktop app. It
					downloads once (about {totalMB} MB) and stays cached on this device.
				{/if}
			</DialogDescription>
		</DialogHeader>

		<div class="border-border bg-muted flex items-start gap-3 rounded-xl border p-3">
			<IconWifiOff size={16} class="text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
			<p class="text-muted-foreground text-xs min-w-0 flex-1">
				After this, compiling works <span class="text-foreground font-medium">fully offline</span>.
				Your documents never leave your device.
			</p>
		</div>

		{#if installing}
			<EngineProgress {progress} label="Compiler download" />
		{/if}

		{#if error}
			<div
				class="border-destructive/30 bg-destructive/5 flex items-start gap-2 rounded-xl border p-3"
				role="alert"
			>
				<IconAlertTriangle size={16} class="text-destructive-strong mt-0.5 shrink-0" aria-hidden="true" />
				<p class="text-foreground text-xs min-w-0 flex-1">
					<span class="font-medium">Download failed.</span>
					{error}
				</p>
			</div>
		{/if}

		<Button class="w-full sm:ml-auto sm:w-auto" onclick={start} disabled={installing}>
			{#if installing}
				Installing…
			{:else if error}
				Try again
			{:else}
				{update ? "Download and update" : "Download and install"}
			{/if}
		</Button>
	</DialogContent>
</Dialog>
