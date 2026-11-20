<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { Alert, AlertDescription, AlertTitle } from "@glyphtex/ui/alert";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
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
	<DialogContent class="sm:max-w-md">
		<div class="flex flex-col gap-5">
		<DialogHeader class="gap-3">
			<span class="bg-tint text-primary grid size-10 place-items-center rounded-lg" aria-hidden="true">
				<IconRefresh size={20} />
			</span>
			<DialogTitle class="text-base">A compiler update is available</DialogTitle>
			<DialogDescription class="text-sm">
				A newer LaTeX compiler is ready ({plan ? size(plan.totalBytes) : ""}). Your documents are not
				touched; only the cached compiler is replaced.
			</DialogDescription>
		</DialogHeader>

		{#if plan}
			<ul
				class="bg-tint divide-border flex flex-col divide-y rounded-xl text-xs"
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
			<Alert variant="destructive">
				<IconAlertTriangle aria-hidden="true" />
				<AlertTitle>The update failed</AlertTitle>
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		{/if}
		</div>

		<DialogFooter>
			<Button variant="ghost" onclick={later} disabled={installing}>Later</Button>
			<Button variant="dark" onclick={start} disabled={installing}>
				{installing ? "Updating…" : error ? "Try again" : "Update now"}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
