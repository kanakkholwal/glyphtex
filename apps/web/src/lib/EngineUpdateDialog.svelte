<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from "@glyphtex/ui/dialog";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconAlertTriangle, IconRefresh } from "@tabler/icons-svelte";

	import { track } from "$lib/analytics";
	import type { InstallProgress } from "$lib/compile";
	import { engineUpdates } from "$lib/tex/update.svelte";
	import EngineProgress from "./EngineProgress.svelte";

	let installing = $state(false);
	let progress = $state<InstallProgress | undefined>(undefined);
	let error = $state<string | undefined>(undefined);

	const plan = $derived(engineUpdates.available);
	const size = (bytes: number) =>
		bytes >= 1048576
			? `${(bytes / 1048576).toFixed(1)} MB`
			: `${Math.max(1, Math.round(bytes / 1024))} KB`;

	async function start() {
		installing = true;
		error = undefined;
		progress = undefined;
		try {
			await engineUpdates.apply((p) => (progress = p));
			track("engine_update_applied");
			toast.success("The compiler is up to date.");
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			installing = false;
		}
	}

	function later() {
		track("engine_update_postponed");
		engineUpdates.dismiss();
	}
</script>

<!-- Optional: closing it (Escape, backdrop, Later) postpones this exact update. -->
<Dialog
	bind:open={
		() => engineUpdates.visible,
		(next) => {
			if (!next && !installing) later();
		}
	}
	dismissOnBackdrop={!installing}
>
	<DialogContent class="gap-5 p-6 sm:max-w-md">
		<DialogHeader class="gap-3">
			<span
				class="border-border bg-card text-primary grid size-10 place-items-center rounded-lg border"
				aria-hidden="true"
			>
				<IconRefresh size={20} />
			</span>
			<DialogTitle class="text-base">A compiler update is available</DialogTitle>
			<DialogDescription class="text-md">
				A newer LaTeX compiler is ready ({plan ? size(plan.totalBytes) : ""}). Your documents are not
				touched; only the cached compiler is replaced.
			</DialogDescription>
		</DialogHeader>

		{#if plan}
			<ul
				class="border-border bg-muted divide-border flex flex-col divide-y rounded-xl border text-xs"
			>
				{#if plan.coreChanged}
					<li class="flex items-center gap-3 px-3 py-2">
						<span class="text-foreground min-w-0 flex-1 truncate font-medium">Compiler engine</span>
						<span class="text-muted-foreground tabular-nums">{size(plan.coreBytes)}</span>
					</li>
				{/if}
				{#each plan.packs as pack (pack.id)}
					<li class="flex items-center gap-3 px-3 py-2">
						<span class="text-foreground min-w-0 flex-1 truncate font-medium">{pack.label}</span>
						<span class="text-muted-foreground tabular-nums">{size(pack.bytes)}</span>
					</li>
				{/each}
			</ul>
		{/if}

		{#if installing}
			<EngineProgress {progress} label="Compiler update" />
		{/if}

		{#if error}
			<div
				class="border-destructive/30 bg-destructive/5 flex items-start gap-2 rounded-xl border p-3"
				role="alert"
			>
				<IconAlertTriangle
					size={16}
					class="text-destructive-strong mt-0.5 shrink-0"
					aria-hidden="true"
				/>
				<p class="text-foreground min-w-0 flex-1 text-xs">
					<span class="font-medium">The update failed.</span>
					{error}
				</p>
			</div>
		{/if}

		<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			<Button variant="ghost" onclick={later} disabled={installing}>Later</Button>
			<Button variant="dark" onclick={start} disabled={installing}>
				{installing ? "Updating…" : error ? "Try again" : "Update now"}
			</Button>
		</div>
	</DialogContent>
</Dialog>
