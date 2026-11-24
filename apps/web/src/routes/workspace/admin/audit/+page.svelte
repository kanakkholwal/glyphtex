<script lang="ts">
	import { Skeleton } from "@glyphtex/ui/skeleton";
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from "@glyphtex/ui/table";
	import { onMount } from "svelte";

	import { formatDateTime } from "$lib/admin/format";
	import { type AdminAuditRow, CloudError, cloud } from "$lib/cloud/api";

	let rows = $state<AdminAuditRow[] | null>(null);
	let failed = $state<string | null>(null);

	onMount(async () => {
		try {
			rows = await cloud.admin.audit();
		} catch (e) {
			failed = e instanceof CloudError ? e.message : "Could not load the audit log.";
		}
	});
</script>

<p class="text-muted-foreground mb-4 text-sm">
	The newest 50 organization events across this server. Each organization's own owners see theirs
	in its settings.
</p>

{#if failed}
	<p class="text-destructive-strong text-sm">{failed}</p>
{:else if rows === null}
	<div class="grid gap-2">{#each [0, 1, 2, 3, 4] as i (i)}<Skeleton class="h-10 w-full" />{/each}</div>
{:else}
	<Table>
		<TableHeader>
			<TableRow>
				<TableHead>When</TableHead>
				<TableHead>Organization</TableHead>
				<TableHead>Action</TableHead>
				<TableHead>By</TableHead>
			</TableRow>
		</TableHeader>
		<TableBody>
			{#each rows as row (row.id)}
				<TableRow>
					<TableCell class="text-muted-foreground whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
					<TableCell>{row.organization}</TableCell>
					<TableCell class="font-mono text-xs">{row.action}</TableCell>
					<TableCell>{row.actor ?? "System"}</TableCell>
				</TableRow>
			{:else}
				<TableRow><TableCell colspan={4} class="text-muted-foreground">No events yet.</TableCell></TableRow>
			{/each}
		</TableBody>
	</Table>
{/if}
