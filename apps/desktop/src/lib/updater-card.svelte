<script lang="ts">
	import { Button } from '@glyphx/ui/button';
	import { Spinner } from '@glyphx/ui/spinner';
	import { IconAlertTriangle, IconCircleCheck, IconDownload, IconX } from '@tabler/icons-svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { updater } from './updater.svelte';

	const pct = $derived(Math.round(updater.progress * 100));
</script>

<!-- Non-blocking update card, pinned bottom-right, above all routes. -->
<div class="pointer-events-none fixed right-4 bottom-4 z-50 w-[340px]">
	{#if updater.visible}
		<div
			class="bg-card border-border shadow-craft-lg pointer-events-auto overflow-hidden rounded-xl border"
			transition:fly={{ y: 16, x: 8, duration: 240, easing: cubicOut }}
		>
			<div class="flex items-start gap-3 px-4 py-3">
				<div
					class="grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset {updater.status ===
					'error'
						? 'bg-destructive/10 text-destructive ring-destructive/20'
						: 'bg-brand-subtle text-brand ring-brand/20'}"
				>
					{#if updater.status === 'update-available'}
						<IconDownload size={16} />
					{:else if updater.status === 'downloading'}
						<Spinner class="size-4" />
					{:else if updater.status === 'ready'}
						<IconCircleCheck size={16} />
					{:else}
						<IconAlertTriangle size={16} />
					{/if}
				</div>

				<div class="min-w-0 flex-1">
					<p class="text-foreground text-[12.5px] leading-tight font-semibold">
						{#if updater.status === 'update-available'}
							Update available
						{:else if updater.status === 'downloading'}
							Downloading update
						{:else if updater.status === 'ready'}
							Update ready to install
						{:else}
							Update failed
						{/if}
					</p>
					<p class="text-muted-foreground mt-0.5 text-[11.5px] leading-snug">
						{#if updater.status === 'error'}
							{updater.error ?? 'Could not download the latest version.'}
						{:else}
							GlyphX
							{#if updater.version}<span class="font-mono">v{updater.version}</span>{/if}
							{#if updater.status === 'ready'}
								is ready.
							{:else if updater.status === 'downloading'}
								is downloading…
							{:else}
								is available to download.
							{/if}
						{/if}
					</p>
				</div>

				<button
					type="button"
					class="text-muted-foreground/70 hover:bg-foreground/5 hover:text-foreground -mt-0.5 -mr-1 shrink-0 rounded-md p-1 transition-colors"
					aria-label="Dismiss"
					onclick={() => updater.dismiss()}
				>
					<IconX size={14} />
				</button>
			</div>

			{#if updater.status === 'downloading'}
				<div class="px-4 pb-3.5">
					<div class="bg-muted h-1 overflow-hidden rounded-full">
						<div
							class="bg-brand h-full rounded-full transition-[width] duration-200"
							style="width: {pct}%"
						></div>
					</div>
					<span class="text-muted-foreground mt-1 block text-[10px] font-medium tabular-nums">
						{pct}%
					</span>
				</div>
			{:else}
				<div
					class="border-border/50 bg-muted/30 flex items-center justify-end gap-1.5 border-t px-3 py-2"
				>
					{#if updater.status === 'update-available'}
						<Button size="xs" variant="ghost" onclick={() => updater.dismiss()}>Later</Button>
						<Button size="xs" onclick={() => updater.download()}>
							<IconDownload size={13} /> Download
						</Button>
					{:else if updater.status === 'ready'}
						<Button
							size="xs"
							disabled={updater.installing}
							onclick={() => updater.installAndRelaunch()}
						>
							{#if updater.installing}
								<Spinner class="size-3" /> Installing…
							{:else}
								<IconDownload size={13} /> Restart to update
							{/if}
						</Button>
					{:else if updater.status === 'error'}
						<Button size="xs" variant="outline" onclick={() => updater.checkNow()}>Retry</Button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
