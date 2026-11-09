<script lang="ts">
	import SignInSkeleton from "$lib/loading/SignInSkeleton.svelte";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { browser } from "$app/environment";
	import { page } from "$app/state";
	import { Button } from "@glyphtex/ui/button";
	import { IconArrowLeft } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import CloudPage from "$lib/cloud/CloudPage.svelte";
	import { publicConfig } from "$lib/cloud/public-config";
	import { cloudEnabled } from "$lib/cloud/config";
	import { safeNext } from "$lib/cloud/next";
	import { cloudSession } from "$lib/cloud/session.svelte";
	import SignInPanel from "$lib/cloud/SignInPanel.svelte";

	// Start the sign-in options request now, in parallel with the session check, so the panel finds it done.
	if (browser && cloudEnabled) void publicConfig().catch(() => {});

	// Account management lives in Settings; this page only signs people in.
	const SETTINGS = "/workspace/settings?tab=account";
	const next = $derived(safeNext(page.url.searchParams.get("next"), SETTINGS));
	const deleted = $derived(page.url.searchParams.get("deleted") === "1");

	onMount(async () => {
		if (!cloudEnabled || deleted) return;
		await cloudSession.refresh();
		if (cloudSession.user) void goto(next, { replaceState: true });
	});
</script>

{#snippet back()}
	<Button variant="ghost" size="sm" href={resolve('/workspace')}>
		<IconArrowLeft /> Back to projects
	</Button>
{/snippet}

{#if !cloudEnabled}
	<CloudPage
		title="Accounts aren't set up here"
		description="This GlyphTeX has no server configured, so documents stay in your browser. Nothing to sign in to."
		footer={back}
	>
		<p class="text-muted-foreground text-sm">
			Everything you create is saved in this browser and compiles on this device.
		</p>
	</CloudPage>
{:else if deleted}
	<CloudPage
		title="Your account is deleted"
		description="Your account, every project you owned and all their files were permanently removed."
		footer={back}
	>
		<p class="text-muted-foreground text-sm">Documents saved only in this browser are untouched.</p>
	</CloudPage>
{:else if cloudSession.status === 'idle' || cloudSession.status === 'loading' || cloudSession.user}
	<CloudPage title="Account">
		<SignInSkeleton />
	</CloudPage>
{:else}
	<CloudPage
		title="Sign in to GlyphTeX"
		description="An account lets you save documents to the server and share them. Documents in this browser keep working without one."
		footer={back}
	>
		<SignInPanel {next} onsignedin={() => void goto(next)} />
	</CloudPage>
{/if}
