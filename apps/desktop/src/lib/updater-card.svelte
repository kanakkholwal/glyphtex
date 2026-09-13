<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { Spinner } from "@glyphtex/ui/spinner";
	import {
		IconAlertTriangle,
		IconCircleCheck,
		IconDownload,
		IconRefresh,
		IconX
	} from "@tabler/icons-svelte";
	import { cubicOut } from "svelte/easing";
	import { prefersReducedMotion } from "svelte/motion";
	import { fly } from "svelte/transition";
	import UpdateProgress from "./update-progress.svelte";
	import { FAILURE_COPY, updater } from "./updater.svelte";

	const failure = $derived(updater.failedStep ? FAILURE_COPY[updater.failedStep] : null);
	const title = $derived.by(() => {
		switch (updater.status) {
			case "update-available":
				return "Update available";
			case "downloading":
				return "Downloading update";
			case "ready":
				return updater.installing ? "Installing update" : "Update ready";
			default:
				return failure?.title ?? "Update failed";
		}
	});
</script>

<!-- Non-modal and pinned bottom-right; `aria-live` announces each state change. -->
<div class="pointer-events-none fixed right-4 bottom-4 z-50 w-85" aria-live="polite">
	{#if updater.visible}
		<section
			aria-label="Software update"
			class="pointer-events-auto overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
			transition:fly={{ y: 16, duration: prefersReducedMotion.current ? 0 : 200, easing: cubicOut }}
		>
			<div class="flex items-start gap-3 p-4">
				<div
					class="grid size-8 shrink-0 place-items-center rounded-lg {updater.status === 'error'
						? 'bg-destructive/10 text-destructive'
						: 'bg-primary/10 text-primary'}"
					aria-hidden="true"
				>
					{#if updater.status === 'update-available'}
						<IconDownload size={16} />
					{:else if updater.status === 'downloading' || updater.installing}
						<Spinner class="size-4" />
					{:else if updater.status === 'ready'}
						<IconCircleCheck size={16} />
					{:else}
						<IconAlertTriangle size={16} />
					{/if}
				</div>

				<div class="min-w-0 flex-1">
					<h2 class="font-sans text-sm font-medium text-foreground">{title}</h2>
					<p class="mt-0.5 text-sm text-muted-foreground">
						{#if updater.status === 'error'}
							{failure?.body ?? 'Something went wrong while updating.'}
						{:else if updater.status === 'ready'}
							Restart GlyphTeX to finish updating{updater.version ? ` to v${updater.version}` : ''}.
						{:else if updater.version}
							GlyphTeX <span class="font-mono">v{updater.version}</span>
							{updater.status === 'downloading' ? 'is downloading.' : 'is ready to download.'}
						{/if}
					</p>
				</div>

				<Button
					variant="ghost"
					size="icon-sm"
					class="-mt-1 -mr-1 text-muted-foreground"
					aria-label="Dismiss update notice"
					title="Dismiss"
					onclick={() => updater.dismiss()}
				>
					<IconX size={16} />
				</Button>
			</div>

			{#if updater.status === 'downloading'}
				<div class="px-4 pb-4"><UpdateProgress /></div>
			{:else}
				<div class="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
					{#if updater.status === 'update-available'}
						<Button variant="outline" onclick={() => updater.dismiss()}>Later</Button>
						<Button variant="primary" onclick={() => updater.download()}>
							<IconDownload /> Download
						</Button>
					{:else if updater.status === 'ready'}
						<Button
							variant="primary"
							disabled={updater.installing}
							onclick={() => updater.installAndRelaunch()}
						>
							{updater.installing ? 'Installing…' : 'Restart to update'}
						</Button>
					{:else if updater.status === 'error'}
						<Button variant="outline" onclick={() => updater.retry()}>
							<IconRefresh /> Try again
						</Button>
					{/if}
				</div>
			{/if}
		</section>
	{/if}
</div>
