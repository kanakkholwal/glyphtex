<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { Tabs, TabsContent, TabsList, TabsTrigger } from "@glyphtex/ui/tabs";
	import { onMount } from "svelte";

	import { cloudSession } from "$lib/cloud/session.svelte";
	import AccountSettings from "./AccountSettings.svelte";
	import GeneralSettings from "./GeneralSettings.svelte";
	import OrgAudit from "./OrgAudit.svelte";
	import OrgLibrary from "./OrgLibrary.svelte";
	import OrgMembers from "./OrgMembers.svelte";
	import OrgSettings from "./OrgSettings.svelte";
	import { activeOrg } from "./org-state.svelte";
	import StorageSettings from "./StorageSettings.svelte";

	const PERSONAL = ["general", "account", "storage"] as const;
	const ORG = ["organization", "members", "library", "audit"] as const;
	type Tab = (typeof PERSONAL)[number] | (typeof ORG)[number];

	const inOrg = $derived(cloudSession.activeOrgId !== null);
	// Audit is for admins and owners; members still see the organization and member list.
	const orgTabs = $derived(
		inOrg ? ORG.filter((t) => t !== "audit" || activeOrg.can("org:read-audit")) : []
	);
	const available = $derived<readonly Tab[]>([...PERSONAL, ...orgTabs]);

	// The URL owns the tab, so it survives reloads and can be linked to (?tab=storage).
	const tab = $derived<Tab>(
		available.find((t) => t === page.url.searchParams.get("tab")) ?? "general"
	);

	function select(next: string) {
		const url = new URL(page.url);
		url.searchParams.set("tab", next);
		void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	onMount(() => void cloudSession.ensure());

	// Fetches the org view whenever the active org changes (switcher or sign-in).
	$effect(() => {
		void cloudSession.activeOrgId;
		void activeOrg.load();
	});
</script>

<Tabs variant="soft" bind:value={() => tab, select}>
	<TabsList aria-label="Settings sections">
		<TabsTrigger value="general">General</TabsTrigger>
		<TabsTrigger value="account">Account</TabsTrigger>
		<TabsTrigger value="storage">Storage</TabsTrigger>
		{#if inOrg}
			<TabsTrigger value="organization">Organization</TabsTrigger>
			<TabsTrigger value="members">Members</TabsTrigger>
			<TabsTrigger value="library">Library</TabsTrigger>
			{#if orgTabs.includes("audit")}<TabsTrigger value="audit">Audit</TabsTrigger>{/if}
		{/if}
	</TabsList>
	<TabsContent value="general" class="pt-8"><GeneralSettings /></TabsContent>
	<TabsContent value="account" class="pt-8"><AccountSettings /></TabsContent>
	<TabsContent value="storage" class="pt-8"><StorageSettings /></TabsContent>
	{#if inOrg}
		<TabsContent value="organization" class="pt-8"><OrgSettings /></TabsContent>
		<TabsContent value="members" class="pt-8">
			{#key cloudSession.activeOrgId}<OrgMembers />{/key}
		</TabsContent>
		<TabsContent value="library" class="pt-8">
			{#key cloudSession.activeOrgId}<OrgLibrary />{/key}
		</TabsContent>
		{#if orgTabs.includes("audit")}
			<TabsContent value="audit" class="pt-8">
				{#key cloudSession.activeOrgId}<OrgAudit />{/key}
			</TabsContent>
		{/if}
	{/if}
</Tabs>
