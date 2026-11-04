<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { toast } from "@glyphtex/ui/sonner";
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from "@glyphtex/ui/table";
	import { IconDownload, IconLoader2 } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { cloud, type AuditPage, type OrgStats } from "$lib/cloud/api";
	import { formatBytes } from "$lib/storage/quota";
	import { activeOrg } from "./org-state.svelte";
	import SettingsSection from "./SettingsSection.svelte";

	const orgId = $derived(activeOrg.view?.organization.id ?? null);

	let stats = $state<OrgStats | null>(null);
	let events = $state.raw<AuditPage["events"]>([]);
	let next = $state<string | null>(null);
	let loading = $state(true);
	let more = $state(false);
	let exporting = $state(false);

	// Plain-language action names; unknown actions fall back to the raw id.
	const LABELS: Record<string, string> = {
		"org.created": "Created the organization",
		"org.updated": "Updated the organization",
		"member.added": "Added a member",
		"member.removed": "Removed a member",
		"member.role_changed": "Changed a member's role",
		"member.feature_changed": "Changed a member's features",
		"invitation.created": "Sent an invitation",
		"invitation.accepted": "Accepted an invitation",
		"invitation.cancelled": "Cancelled an invitation",
		"policy.updated": "Changed the policy",
		"project.created": "Created a project",
		"project.deleted": "Deleted a project",
		"project.invite_sent": "Shared a project by email",
		"project.invite_revoked": "Revoked a project invite",
		"project.link_created": "Created a share link",
		"project.link_revoked": "Revoked a share link",
		"project.member_role_changed": "Changed project access",
		"project.member_removed": "Removed project access",
		"project.member_left": "Left a project"
	};

	const details = (meta: Record<string, unknown> | null) =>
		meta
			? Object.entries(meta)
					.map(([k, v]) => `${k}: ${v}`)
					.join(", ")
			: "";
	const when = (iso: string) =>
		new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

	async function load() {
		if (!orgId) return;
		try {
			const [s, page] = await Promise.all([cloud.orgs.stats(orgId), cloud.orgs.audit(orgId)]);
			stats = s;
			events = page.events;
			next = page.next;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not load the audit log.");
		} finally {
			loading = false;
		}
	}

	onMount(() => void load());

	async function loadMore() {
		if (!orgId || !next) return;
		more = true;
		try {
			const page = await cloud.orgs.audit(orgId, next);
			events = [...events, ...page.events];
			next = page.next;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not load more.");
		} finally {
			more = false;
		}
	}

	async function exportCsv() {
		if (!orgId) return;
		exporting = true;
		try {
			const csv = await cloud.orgs.auditCsv(orgId);
			const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
			const a = document.createElement("a");
			a.href = url;
			a.download = `glyphtex-audit-${new Date().toISOString().slice(0, 10)}.csv`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not export.");
		} finally {
			exporting = false;
		}
	}

	const tiles = $derived(
		stats
			? [
					{ label: "Members", value: String(stats.members) },
					{ label: "Active in 30 days", value: String(stats.activeMembers30d) },
					{ label: "Projects", value: String(stats.projects) },
					{ label: "Edited this week", value: String(stats.projectsEdited7d) },
					{ label: "Storage", value: formatBytes(stats.storageBytes) }
				]
			: []
	);
</script>

{#if loading}
	<p class="text-muted-foreground flex items-center gap-2 text-sm" role="status">
		<IconLoader2 size={14} class="animate-spin" /> Loading…
	</p>
{:else}
	<div class="flex flex-col gap-10">
		<section aria-label="Usage" class="border-border bg-card grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-5">
			{#each tiles as t (t.label)}
				<div class="bg-background flex flex-col gap-1 p-4">
					<span class="text-muted-foreground text-xs">{t.label}</span>
					<span class="text-foreground text-2xl font-semibold tabular-nums">{t.value}</span>
				</div>
			{/each}
		</section>

		<SettingsSection title="Audit log" description="Who did what in this organization.">
			{#snippet action()}
				<Button variant="outline" size="sm" disabled={exporting} onclick={exportCsv}>
					{#if exporting}<IconLoader2 class="animate-spin" />{:else}<IconDownload />{/if} Export CSV
				</Button>
			{/snippet}
			{#if events.length === 0}
				<p class="border-border bg-card text-muted-foreground rounded-xl border p-4 text-sm">
					Nothing recorded yet.
				</p>
			{:else}
				<Table variant="framed" class="table-fixed">
					<TableHeader>
						<TableRow>
							<TableHead class="w-44">When</TableHead>
							<TableHead class="w-48">Who</TableHead>
							<TableHead>What</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each events as e (e.id)}
							<TableRow>
								<TableCell class="text-muted-foreground whitespace-nowrap tabular-nums">{when(e.createdAt)}</TableCell>
								<TableCell class="max-w-0 truncate">{e.actorName || e.actorEmail || "System"}</TableCell>
								<TableCell class="max-w-0">
									<p class="text-foreground truncate">{LABELS[e.action] ?? e.action}</p>
									{#if e.meta}<p class="text-muted-foreground truncate text-xs">{details(e.meta)}</p>{/if}
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
				{#if next}
					<Button variant="outline" size="sm" class="self-center" disabled={more} onclick={loadMore}>
						{#if more}<IconLoader2 class="animate-spin" />{/if} Load more
					</Button>
				{/if}
			{/if}
		</SettingsSection>
	</div>
{/if}
