<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { Tabs, TabsContent, TabsList, TabsTrigger } from "@glyphtex/ui/tabs";
	import { onMount } from "svelte";

	import { cloudSession } from "$lib/cloud/session.svelte";
	import AccountSettings from "./AccountSettings.svelte";
	import GeneralSettings from "./GeneralSettings.svelte";
	import StorageSettings from "./StorageSettings.svelte";

	const TABS = ["general", "account", "storage"] as const;
	type Tab = (typeof TABS)[number];

	// The URL owns the tab, so it survives reloads and can be linked to (?tab=storage).
	const tab = $derived<Tab>(TABS.find((t) => t === page.url.searchParams.get("tab")) ?? "general");

	function select(next: string) {
		const url = new URL(page.url);
		url.searchParams.set("tab", next);
		void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	onMount(() => void cloudSession.ensure());
</script>

<Tabs variant="soft" bind:value={() => tab, select}>
	<TabsList aria-label="Settings sections">
		<TabsTrigger value="general">General</TabsTrigger>
		<TabsTrigger value="account">Account</TabsTrigger>
		<TabsTrigger value="storage">Storage</TabsTrigger>
	</TabsList>
	<TabsContent value="general" class="pt-8"><GeneralSettings /></TabsContent>
	<TabsContent value="account" class="pt-8"><AccountSettings /></TabsContent>
	<TabsContent value="storage" class="pt-8"><StorageSettings /></TabsContent>
</Tabs>
