<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from "@glyphtex/ui/table";
	import { IconAlertTriangle, IconShieldCheck, IconShieldOff } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { listProjects, type StoredProject } from "$lib/storage/projects";
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
	import SettingsSection from "./SettingsSection.svelte";

	let status = $state<StorageStatus | undefined>(undefined);
	let projects = $state.raw<StoredProject[]>([]);
	let asking = $state(false);
	let refused = $state<string | undefined>(undefined);

	const documents = $derived(projects.reduce((n, p) => n + p.bytes, 0));
	const largest = $derived(projects.toSorted((a, b) => b.bytes - a.bytes).slice(0, 8));
	const pct = $derived(status && status.quota > 0 ? Math.min(100, status.ratio * 100) : 0);
	const low = $derived(Boolean(status && !status.unknown && status.ratio >= WARN_AT));
	// Documents are one part of the origin's usage; the engine cache is most of the rest.
	const docPct = $derived(
		status && status.quota > 0 ? Math.min(pct, (documents / status.quota) * 100) : 0
	);

	async function refresh(): Promise<void> {
		const [s, list] = await Promise.all([storageStatus(), listProjects().catch(() => [])]);
		status = s;
		projects = list;
	}

	onMount(() => void refresh());

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

<div class="flex flex-col gap-10">
	<section
		class="border-border bg-background flex flex-col rounded-xl border"
		aria-labelledby="usage-title"
	>
		<div class="flex flex-col gap-4 p-5">
			<div class="flex flex-col gap-0.5">
				<h2 id="usage-title" class="text-foreground text-base font-medium">Browser storage</h2>
				<p class="text-muted-foreground text-sm">Everything this site keeps in your browser.</p>
			</div>
			{#if !status}
				<p class="text-muted-foreground text-sm" role="status">Checking…</p>
			{:else if status.unknown}
				<p class="text-muted-foreground text-sm">This browser doesn't report how much space is used.</p>
			{:else}
				<p class="flex items-baseline gap-2">
					<span class="text-foreground text-2xl font-semibold tabular-nums">{formatBytes(status.usage)}</span>
					<span class="text-muted-foreground text-sm tabular-nums">of {formatBytes(status.quota)}</span>
					<span class="bg-muted text-muted-foreground ml-auto rounded-md px-1.5 py-0.5 text-xs tabular-nums">
						{Math.round(pct)}%
					</span>
				</p>
				<div
					class="bg-muted flex h-2 overflow-hidden rounded-full"
					role="progressbar"
					aria-label="Browser storage used"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(pct)}
				>
					<div class="h-full {low ? 'bg-warning' : 'bg-primary'}" style:width={`${docPct}%`}></div>
					<div class="bg-muted-foreground h-full" style:width={`${Math.max(0, pct - docPct)}%`}></div>
				</div>
				<dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
					<div class="flex flex-col">
						<dt class="text-muted-foreground flex items-center gap-1.5">
							<span class="size-2 rounded-sm {low ? 'bg-warning' : 'bg-primary'}" aria-hidden="true"></span>Documents
						</dt>
						<dd class="text-foreground tabular-nums">{formatBytes(documents)}</dd>
					</div>
					<div class="flex flex-col">
						<dt class="text-muted-foreground flex items-center gap-1.5">
							<span class="bg-muted-foreground size-2 rounded-sm" aria-hidden="true"></span>Engine and cache
						</dt>
						<dd class="text-foreground tabular-nums">{formatBytes(Math.max(0, status.usage - documents))}</dd>
					</div>
					<div class="flex flex-col">
						<dt class="text-muted-foreground">Per document</dt>
						<dd class="text-foreground tabular-nums">up to {formatBytes(PER_PROJECT_BYTES)}</dd>
					</div>
					<div class="flex flex-col">
						<dt class="text-muted-foreground">Per file</dt>
						<dd class="text-foreground tabular-nums">up to {formatBytes(PER_FILE_BYTES)}</dd>
					</div>
				</dl>
				{#if low}
					<p class="text-destructive-strong flex items-start gap-1.5 text-sm">
						<IconAlertTriangle size={16} class="mt-px shrink-0" aria-hidden="true" />
						<span><span class="font-medium">Nearly full.</span> Delete a document or some images: browsers start clearing data when space runs out.</span>
					</p>
				{/if}
			{/if}
		</div>
		{#if status}
			<div class="border-border flex flex-wrap items-center gap-3 border-t px-5 py-3">
				{#if status.persisted}
					<IconShieldCheck size={18} class="text-success-strong shrink-0" aria-hidden="true" />
				{:else}
					<IconShieldOff size={18} class="text-muted-foreground shrink-0" aria-hidden="true" />
				{/if}
				<p class="text-muted-foreground min-w-0 flex-1 text-sm">
					{status.persisted
						? 'Protected: the browser will not clear these documents to reclaim space.'
						: 'Not protected: the browser may clear these documents when storage runs low.'}
				</p>
				{#if !status.persisted}
					<Button variant="outline" size="sm" onclick={keepData} disabled={asking}>
						{asking ? 'Asking…' : 'Protect my documents'}
					</Button>
				{/if}
			</div>
			{#if refused && !status.persisted}
				<p class="border-border text-foreground flex items-start gap-2 border-t px-5 py-3 text-sm" role="status">
					<IconAlertTriangle size={16} class="text-warning-strong mt-px shrink-0" aria-hidden="true" />
					<span><span class="font-medium">Not protected yet.</span> {refused}</span>
				</p>
			{/if}
		{/if}
	</section>

	{#if largest.length > 0}
		<SettingsSection title="Largest documents" description="Images and PDFs take most of the space.">
			<Table variant="framed">
				<TableHeader>
					<TableRow>
						<TableHead>Document</TableHead>
						<TableHead>Files</TableHead>
						<TableHead class="text-right">Size</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each largest as p (p.id)}
						<TableRow>
							<TableCell class="max-w-0 truncate font-medium">{p.name}</TableCell>
							<TableCell class="text-muted-foreground tabular-nums">{p.paths.length}</TableCell>
							<TableCell class="text-right tabular-nums">{formatBytes(p.bytes)}</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</SettingsSection>
	{/if}

	<p class="text-muted-foreground text-sm">
		Clearing site data in your browser deletes every document here. Export anything you want to keep.
	</p>
</div>
