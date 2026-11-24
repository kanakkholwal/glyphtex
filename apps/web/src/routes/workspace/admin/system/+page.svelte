<script lang="ts">
	import { Badge } from "@glyphtex/ui/badge";
	import { Skeleton } from "@glyphtex/ui/skeleton";
	import { onMount } from "svelte";

	import { formatDateTime } from "$lib/admin/format";
	import { type AdminHealth, CloudError, cloud } from "$lib/cloud/api";

	let health = $state<AdminHealth>();
	let failed = $state<string | null>(null);

	onMount(async () => {
		try {
			health = await cloud.admin.health();
		} catch (e) {
			failed = e instanceof CloudError ? e.message : "Could not read the server's health.";
		}
	});

	const services = $derived(
		health
			? [
					{ name: "Database", detail: "Postgres", ...health.checks.database },
					{ name: "Cache", detail: "Redis or Valkey", ...health.checks.cache }
				]
			: []
	);
	const drivers = $derived(
		health
			? [
					["Job queue", health.drivers.queue],
					["File storage", health.drivers.blobs],
					["Outgoing mail", health.drivers.mail],
					["Runtime", health.build.runtime],
					["Version", health.build.version],
					["Commit", health.build.commit?.slice(0, 8) ?? "unknown"],
					[
						"Deployed",
						health.build.deployedAt ? formatDateTime(health.build.deployedAt) : "unknown"
					],
					["Email verification", health.emailVerificationRequired ? "Required" : "Off"]
				]
			: []
	);
</script>

{#if failed}
	<p class="text-destructive-strong text-sm">{failed}</p>
{:else if !health}
	<div class="grid gap-3 md:grid-cols-2"><Skeleton class="h-24" /><Skeleton class="h-24" /></div>
{:else}
	<div class="grid gap-3 md:grid-cols-2">
		{#each services as service (service.name)}
			<div class="bg-tint flex items-center justify-between rounded-2xl p-5">
				<div>
					<p class="font-medium">{service.name}</p>
					<p class="text-muted-foreground text-xs">{service.detail}, answered in {service.ms} ms</p>
					{#if service.error}<p class="text-destructive-strong mt-1 text-xs">{service.error}</p>{/if}
				</div>
				<Badge variant={service.ok ? "success" : "destructive"}>{service.ok ? "Healthy" : "Down"}</Badge>
			</div>
		{/each}
	</div>

	<dl class="bg-tint mt-3 grid gap-x-6 gap-y-3 rounded-2xl p-5 sm:grid-cols-2">
		{#each drivers as [label, value] (label)}
			<div class="flex justify-between gap-4 text-sm">
				<dt class="text-muted-foreground">{label}</dt>
				<dd class="font-mono text-xs">{value}</dd>
			</div>
		{/each}
	</dl>
{/if}
