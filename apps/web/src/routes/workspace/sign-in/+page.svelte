<script lang="ts">
	import SignInSkeleton from "$lib/loading/SignInSkeleton.svelte";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { browser } from "$app/environment";
	import { page } from "$app/state";
	import { Button } from "@glyphtex/ui/button";
	import { IconArrowLeft } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import AuthShell from "$lib/cloud/AuthShell.svelte";
	import CloudPage from "$lib/cloud/CloudPage.svelte";
	import { publicConfig } from "$lib/cloud/public-config";
	import { cloudEnabled } from "$lib/cloud/config";
	import { safeNext } from "$lib/cloud/next";
	import { cloudSession } from "$lib/cloud/session.svelte";
	import SignInPanel from "$lib/cloud/SignInPanel.svelte";

	let { data } = $props();

	// Start the sign-in options request now, in parallel with the session check, so the panel finds it done.
	if (browser && cloudEnabled) void publicConfig().catch(() => {});

	const mode = $derived(page.url.searchParams.get("mode") ?? "signin");
	// A team sign-up carries its intent into the welcome flow, which asks for the organization next.
	const intent = $derived(page.url.searchParams.get("intent") === "team" ? "team" : null);
	const fallback = $derived(
		mode === "signup" ? `/workspace/welcome${intent ? "?intent=team" : ""}` : "/workspace"
	);
	const next = $derived(safeNext(page.url.searchParams.get("next"), fallback));

	const COPY: Record<string, { title: string; description: string }> = {
		signin: {
			title: "Welcome back",
			description: "Sign in to open your saved documents and shared projects."
		},
		signup: {
			title: "Create your account",
			description: "Save documents to the server, share them and work together. Free to start."
		},
		sso: { title: "Single sign-on", description: "Use your organization's identity provider." },
		forgot: { title: "Reset your password", description: "We will email you a link." },
		magic: { title: "Email sign-in", description: "A one-time link, no password." }
	};
	const copy = $derived(
		mode === "signup" && intent
			? {
					title: "Set up your team",
					description:
						"Start with your own account. Next you create the organization and invite your people."
				}
			: (COPY[mode] ?? COPY.signin)
	);
	const deleted = $derived(page.url.searchParams.get("deleted") === "1");

	onMount(async () => {
		if (!cloudEnabled || deleted) return;
		if (data.auth.checked) return;
		await cloudSession.refresh();
		if (cloudSession.user) void goto(next, { replaceState: true });
	});
</script>

{#snippet back()}
	<Button variant="ghost" size="sm" class="-ml-2.5" href={resolve('/workspace')}>
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
{:else if !data.auth.checked && (cloudSession.status === 'idle' || cloudSession.status === 'loading' || cloudSession.user)}
	<CloudPage title="Account">
		<SignInSkeleton />
	</CloudPage>
{:else}
	<AuthShell title={copy.title} description={copy.description} footer={back}>
		<SignInPanel {next} onsignedin={() => void goto(next, { invalidateAll: true })} />
	</AuthShell>
{/if}
