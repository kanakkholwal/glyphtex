<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '@glyphtex/ui/dialog';

	import { totalBytes } from '$lib/storage/projects';
	import {
		PER_FILE_BYTES,
		PER_PROJECT_BYTES,
		WARN_AT,
		formatBytes,
		persistencePermission,
		requestPersistence,
		storageStatus,
		type StorageStatus
	} from '$lib/storage/quota';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let status = $state<StorageStatus | undefined>(undefined);
	let documents = $state(0);
	let asking = $state(false);
	let refused = $state<string | undefined>(undefined);

	const pct = $derived(status && status.quota > 0 ? Math.min(100, status.ratio * 100) : 0);
	const low = $derived(Boolean(status && !status.unknown && status.ratio >= WARN_AT));

	async function refresh(): Promise<void> {
		const [s, d] = await Promise.all([storageStatus(), totalBytes().catch(() => 0)]);
		status = s;
		documents = d;
	}

	$effect(() => {
		if (open) void refresh();
	});

	// Runs straight off the click — Firefox only prompts inside a user gesture.
	// A refusal is silent in Chrome, so say what actually happened.
	async function keepData(): Promise<void> {
		asking = true;
		refused = undefined;
		try {
			const granted = await requestPersistence();
			await refresh();
			if (granted) return;
			const permission = await persistencePermission();
			refused =
				permission === 'denied'
					? 'Your browser blocked this permission for this site. Re-allow it in site settings, then try again.'
					: 'The browser declined for now. Chrome grants this once a site is bookmarked or installed, or after you have used it a few times.';
		} finally {
			asking = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>Storage</DialogTitle>
			<DialogDescription>
				Documents are stored in this browser on this device. They are never uploaded.
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 text-sm">
			{#if !status}
				<p class="text-muted-foreground" role="status">Checking…</p>
			{:else if status.unknown}
				<p class="text-muted-foreground">
					This browser will not report how much space is available. Documents still save; you just
					won't see a usage figure here.
				</p>
			{:else}
				<div class="space-y-1.5">
					<div class="flex items-baseline justify-between">
						<span class="text-muted-foreground">Used by this site</span>
						<span class="font-medium">
							{formatBytes(status.usage)}
							<span class="text-muted-foreground font-normal">of {formatBytes(status.quota)}</span>
						</span>
					</div>
					<div
						class="bg-muted h-1.5 w-full overflow-hidden rounded-full"
						role="progressbar"
						aria-valuenow={Math.round(pct)}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label="Browser storage used"
					>
						<div
							class="h-full rounded-full transition-[width] duration-500 {low
								? 'bg-destructive'
								: 'bg-brand'}"
							style:width="{Math.max(pct, 1)}%"
						></div>
					</div>
					{#if low}
						<p class="text-destructive text-xs">
							Nearly full. Delete a document or some images — browsers evict site data when the disk
							runs low.
						</p>
					{/if}
				</div>

				<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
					<dt class="text-muted-foreground">Your documents</dt>
					<dd class="text-right font-medium">{formatBytes(documents)}</dd>
					<dt class="text-muted-foreground">Limit per document</dt>
					<dd class="text-right font-medium">{formatBytes(PER_PROJECT_BYTES)}</dd>
					<dt class="text-muted-foreground">Limit per file</dt>
					<dd class="text-right font-medium">{formatBytes(PER_FILE_BYTES)}</dd>
				</dl>

				<div class="border-border space-y-2 border-t pt-3">
					<div class="flex items-center justify-between gap-3">
						<div>
							<p class="font-medium">
								{status.persisted ? 'Protected from cleanup' : 'Not protected from cleanup'}
							</p>
							<p class="text-muted-foreground text-xs">
								{status.persisted
									? 'The browser will not clear these documents to reclaim space.'
									: 'The browser may clear these documents when storage runs low.'}
							</p>
						</div>
						{#if !status.persisted}
							<Button
								size="sm"
								variant="outline"
								class="shrink-0"
								onclick={keepData}
								disabled={asking}
							>
								{asking ? 'Asking…' : 'Protect'}
							</Button>
						{/if}
					</div>
					{#if refused && !status.persisted}
						<p class="text-warning text-xs" role="status">{refused}</p>
					{/if}
				</div>
			{/if}

			<p class="text-muted-foreground text-xs">
				Clearing site data in your browser deletes every document here. Export anything you want to
				keep.
			</p>
		</div>

		<DialogFooter>
			<Button size="sm" onclick={() => (open = false)}>Done</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
