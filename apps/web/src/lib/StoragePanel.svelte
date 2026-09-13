<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import {
		Sheet,
		SheetContent,
		SheetDescription,
		SheetFooter,
		SheetHeader,
		SheetTitle
	} from "@glyphtex/ui/sheet";
	import { IconAlertTriangle, IconShieldCheck, IconShieldOff } from "@tabler/icons-svelte";
	import { MediaQuery } from "svelte/reactivity";

	import { totalBytes } from "$lib/storage/projects";
	import {
		PER_FILE_BYTES,
		PER_PROJECT_BYTES,
		WARN_AT,
		formatBytes,
		persistencePermission,
		requestPersistence,
		storageStatus,
		type StorageStatus
	} from "$lib/storage/quota";

	let { open = $bindable(false) }: { open?: boolean } = $props();

	// A side task: right sheet from `md`, bottom sheet on phones.
	const wide = new MediaQuery("min-width: 768px");

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

	// Runs straight off the click: Firefox only prompts inside a user gesture.
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
				permission === "denied"
					? "Your browser blocked this permission for this site. Re-allow it in site settings, then try again."
					: "The browser declined for now. Chrome grants this once a site is bookmarked or installed, or after you have used it a few times.";
		} finally {
			asking = false;
		}
	}
</script>

<Sheet bind:open>
	<SheetContent
		side={wide.current ? 'right' : 'bottom'}
		class="max-h-[90dvh] gap-0 overflow-y-auto data-[side=bottom]:rounded-t-2xl data-[side=right]:sm:max-w-md"
	>
		<SheetHeader class="gap-1 p-6 pr-14">
			<SheetTitle class="text-body-lg">Storage</SheetTitle>
			<SheetDescription class="text-body text-muted-foreground">
				Documents are stored in this browser on this device. They are never uploaded.
			</SheetDescription>
		</SheetHeader>

		<div class="text-body flex flex-col gap-6 px-6 pb-2">
			{#if !status}
				<p class="text-muted-foreground" role="status">Checking…</p>
			{:else if status.unknown}
				<p class="text-muted-foreground">
					This browser does not report how much space is available. Documents still save; you just
					won't see a usage figure here.
				</p>
			{:else}
				<section class="flex flex-col gap-2" aria-labelledby="storage-usage">
					<div class="flex items-baseline justify-between gap-3">
						<h3 id="storage-usage" class="text-muted-foreground text-body font-normal">
							Used by this site
						</h3>
						<span class="font-medium tabular-nums">
							{formatBytes(status.usage)}
							<span class="text-muted-foreground font-normal">of {formatBytes(status.quota)}</span>
						</span>
					</div>
					<div
						class="bg-muted h-2 w-full overflow-hidden rounded-full"
						role="progressbar"
						aria-valuenow={Math.round(pct)}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label="Browser storage used"
					>
						<div
							class="h-full rounded-full transition-[width] duration-500 {low
								? 'bg-destructive'
								: 'bg-primary'}"
							style:width="{Math.max(pct, 1)}%"
						></div>
					</div>
					{#if low}
						<p class="text-destructive text-caption flex items-start gap-1.5">
							<IconAlertTriangle size={14} class="mt-px shrink-0" aria-hidden="true" />
							<span>
								<span class="font-medium">Nearly full.</span> Delete a document or some images: browsers
								evict site data when the disk runs low.
							</span>
						</p>
					{/if}
				</section>

				<dl class="border-border divide-border divide-y rounded-xl border">
					<div class="flex items-center justify-between gap-3 px-4 py-3">
						<dt class="text-muted-foreground">Your documents</dt>
						<dd class="font-medium tabular-nums">{formatBytes(documents)}</dd>
					</div>
					<div class="flex items-center justify-between gap-3 px-4 py-3">
						<dt class="text-muted-foreground">Limit per document</dt>
						<dd class="font-medium tabular-nums">{formatBytes(PER_PROJECT_BYTES)}</dd>
					</div>
					<div class="flex items-center justify-between gap-3 px-4 py-3">
						<dt class="text-muted-foreground">Limit per file</dt>
						<dd class="font-medium tabular-nums">{formatBytes(PER_FILE_BYTES)}</dd>
					</div>
				</dl>

				<section class="flex flex-col gap-3">
					<div class="flex items-start gap-3">
						{#if status.persisted}
							<IconShieldCheck size={20} class="text-success mt-0.5 shrink-0" aria-hidden="true" />
						{:else}
							<IconShieldOff
								size={20}
								class="text-muted-foreground mt-0.5 shrink-0"
								aria-hidden="true"
							/>
						{/if}
						<div class="min-w-0 flex-1">
							<h3 class="text-body font-medium">
								{status.persisted ? 'Protected from cleanup' : 'Not protected from cleanup'}
							</h3>
							<p class="text-muted-foreground text-caption mt-0.5">
								{status.persisted
									? 'The browser will not clear these documents to reclaim space.'
									: 'The browser may clear these documents when storage runs low.'}
							</p>
						</div>
					</div>
					{#if !status.persisted}
						<Button variant="outline" class="self-start" onclick={keepData} disabled={asking}>
							{asking ? 'Asking…' : 'Protect my documents'}
						</Button>
					{/if}
					{#if refused && !status.persisted}
						<p class="text-warning text-caption" role="status">{refused}</p>
					{/if}
				</section>
			{/if}

			<p class="text-muted-foreground text-caption">
				Clearing site data in your browser deletes every document here. Export anything you want to
				keep.
			</p>
		</div>

		<SheetFooter class="p-6">
			<Button onclick={() => (open = false)}>Done</Button>
		</SheetFooter>
	</SheetContent>
</Sheet>
