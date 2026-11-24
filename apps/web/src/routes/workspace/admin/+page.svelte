<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { Skeleton } from "@glyphtex/ui/skeleton";
	import {
		StatCard,
		StatCardChart,
		StatCardContent,
		StatCardDescription,
		StatCardError,
		StatCardHeader,
		StatCardTitle,
		StatCardTrend,
		StatCardValue
	} from "@glyphtex/ui/stat-card";
	import { onMount } from "svelte";

	import { formatBytes, formatNumber, halfTrend } from "$lib/admin/format";
	import { type AdminOverview, type AdminSignupDay, CloudError, cloud } from "$lib/cloud/api";

	let overview = $state<AdminOverview>();
	let signups = $state<AdminSignupDay[]>([]);
	let failed = $state<string | null>(null);

	async function load() {
		failed = null;
		try {
			[overview, signups] = await Promise.all([cloud.admin.overview(), cloud.admin.signups(30)]);
		} catch (error) {
			failed = error instanceof CloudError ? error.message : "Could not load the numbers.";
		}
	}
	onMount(load);

	const series = $derived(signups.map((d) => ({ date: new Date(d.day), signups: d.count })));
	const trend = $derived(halfTrend(signups));
	const status = $derived(failed ? "error" : overview ? "ready" : "loading");
</script>

<div class="grid gap-4 md:grid-cols-2">
	<StatCard
		name="New accounts"
		data={series}
		dataKey="signups"
		value={overview?.users.new30 ?? 0}
		label="Last 30 days"
		{trend}
		comparisonLabel="vs the first half"
		{status}
		formatValue={formatNumber}
	>
		<StatCardHeader>
			<StatCardTitle>New accounts</StatCardTitle>
			<StatCardTrend />
		</StatCardHeader>
		<StatCardContent>
			<StatCardValue />
			<StatCardDescription />
			<StatCardChart />
			<StatCardError>
				{failed}
				<Button size="sm" variant="secondary" onclick={load}>Retry</Button>
			</StatCardError>
		</StatCardContent>
	</StatCard>

	<div class="grid grid-cols-2 gap-4">
		{#each [
			{ name: "Accounts", value: overview?.users.total, note: `${formatNumber(overview?.users.verified ?? 0)} verified` },
			{ name: "Active, 7 days", value: overview?.users.active7, note: `${formatNumber(overview?.users.active30 ?? 0)} in 30 days` },
			{ name: "Organizations", value: overview?.organizations.total, note: `${formatNumber(overview?.organizations.members ?? 0)} seats used` },
			{ name: "Projects", value: overview?.projects.total, note: `${formatNumber(overview?.projects.inOrgs ?? 0)} in organizations` }
		] as tile (tile.name)}
			<div class="bg-tint rounded-2xl p-5">
				<p class="text-muted-foreground text-sm">{tile.name}</p>
				{#if tile.value === undefined}
					<Skeleton class="mt-2 h-8 w-20" />
				{:else}
					<p class="font-display mt-1 text-3xl tabular-nums">{formatNumber(tile.value)}</p>
				{/if}
				<p class="text-muted-foreground mt-1 text-xs">{tile.note}</p>
			</div>
		{/each}
	</div>
</div>

<div class="mt-4 grid gap-4 md:grid-cols-3">
	<div class="bg-tint rounded-2xl p-5">
		<p class="text-muted-foreground text-sm">Storage</p>
		<p class="font-display mt-1 text-3xl tabular-nums">{formatBytes(overview?.storage.bytes ?? 0)}</p>
		<p class="text-muted-foreground mt-1 text-xs">
			{formatNumber(overview?.storage.files ?? 0)} files, {formatBytes(overview?.storage.binaryBytes ?? 0)} of images
		</p>
	</div>
	<div class="bg-tint rounded-2xl p-5">
		<p class="text-muted-foreground text-sm">Sign-in security</p>
		<p class="font-display mt-1 text-3xl tabular-nums">{formatNumber(overview?.users.twoFactor ?? 0)}</p>
		<p class="text-muted-foreground mt-1 text-xs">accounts with two-factor on</p>
	</div>
	<div class="bg-tint rounded-2xl p-5">
		<p class="text-muted-foreground text-sm">Needs attention</p>
		<p class="font-display mt-1 text-3xl tabular-nums">
			{formatNumber((overview?.users.banned ?? 0) + (overview?.organizations.pendingInvites ?? 0))}
		</p>
		<p class="text-muted-foreground mt-1 text-xs">
			{formatNumber(overview?.users.banned ?? 0)} banned, {formatNumber(overview?.organizations.pendingInvites ?? 0)} pending invites
		</p>
	</div>
</div>
