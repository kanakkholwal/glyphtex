<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { Input } from "@glyphtex/ui/input";
	import { Skeleton } from "@glyphtex/ui/skeleton";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconLoader2, IconRestore, IconTrash } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { type VersionSummary, cloud } from "$lib/cloud/api";
	import type { DocumentMeta } from "$lib/documents/store";
	import { log } from "$lib/log";
	import { sync } from "$lib/sync/sync.svelte";

	let { document }: { document: DocumentMeta } = $props();

	const remoteId = $derived(document.remoteId ?? "");
	const canWrite = $derived(document.role === "owner" || document.role === "editor");
	const isOwner = $derived(document.role === "owner");

	let versions = $state<VersionSummary[]>([]);
	let loading = $state(true);
	let failed = $state(false);
	let name = $state("");
	let busy = $state(false);
	let confirming = $state<string | null>(null);

	async function load() {
		try {
			versions = await cloud.versions.list(remoteId);
			failed = false;
		} catch (error) {
			log.error("versions failed to load", error);
			failed = true;
		} finally {
			loading = false;
		}
	}
	onMount(load);

	async function run(task: () => Promise<unknown>, failure: string) {
		busy = true;
		try {
			await task();
			await load();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : failure);
		} finally {
			busy = false;
		}
	}

	const save = () =>
		run(async () => {
			await cloud.versions.create(remoteId, name.trim());
			name = "";
			toast.success("Version saved.");
		}, "Could not save the version.");

	/** Restores on the server, then pulls the restored files into this browser's copy. */
	const restore = (v: VersionSummary) =>
		run(async () => {
			const { restored } = await cloud.versions.restore(remoteId, v.id);
			confirming = null;
			await sync.run(document.id).catch(() => {});
			toast.success(
				restored
					? `Restored ${restored} file${restored === 1 ? "" : "s"}. A copy of the previous state was saved first.`
					: "Everything already matches this version."
			);
		}, "Could not restore the version.");

	const when = (iso: string) =>
		new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
	const label = (v: VersionSummary) => v.name ?? "Automatic copy";
</script>

<div class="flex flex-col gap-4">
	{#if canWrite}
		<form
			class="flex gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				if (name.trim()) void save();
			}}
		>
			<Input placeholder="Name this version, e.g. Submitted draft" maxlength={120} bind:value={name} />
			<Button type="submit" variant="dark" disabled={busy || !name.trim()}>
				{#if busy}<IconLoader2 class="animate-spin" />{/if} Save
			</Button>
		</form>
		<p class="text-muted-foreground text-xs">A version saves every text file. Images are not included. Save your latest edits to the cloud first.</p>
	{/if}

	{#if loading}
		<div class="flex flex-col gap-2" role="status" aria-busy="true">
			<Skeleton class="h-14 w-full rounded-lg" />
			<Skeleton class="h-14 w-full rounded-lg" />
			<span class="sr-only">Loading versions</span>
		</div>
	{:else if failed}
		<p class="text-destructive-strong text-sm" role="alert">Could not load versions.</p>
		<Button variant="outline" size="sm" class="self-start" onclick={load}>Try again</Button>
	{:else if versions.length === 0}
		<p class="text-muted-foreground text-sm">No versions yet. Name one before a big rewrite or a submission.</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each versions as v (v.id)}
				<li class="border-border bg-background flex flex-col gap-2 rounded-xl border p-3">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="text-foreground truncate text-sm font-medium">{label(v)}</p>
							<p class="text-muted-foreground text-xs">
								{when(v.createdAt)}{v.createdByName ? ` · ${v.createdByName}` : ""} · {v.fileCount} files
							</p>
						</div>
						{#if isOwner}
							<Button variant="ghost" size="sm" aria-label="Delete version" disabled={busy} onclick={() => run(() => cloud.versions.remove(remoteId, v.id), "Could not delete the version.")}>
								<IconTrash />
							</Button>
						{/if}
					</div>
					{#if canWrite}
						{#if confirming === v.id}
							<p class="text-muted-foreground text-xs">Replace the current text files with this version? Files made since stay. A copy of now is saved first.</p>
							<div class="flex gap-2">
								<Button variant="dark" size="sm" disabled={busy} onclick={() => restore(v)}>Restore</Button>
								<Button variant="ghost" size="sm" onclick={() => (confirming = null)}>Cancel</Button>
							</div>
						{:else}
							<Button variant="outline" size="sm" class="self-start" onclick={() => (confirming = v.id)}>
								<IconRestore /> Restore
							</Button>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
