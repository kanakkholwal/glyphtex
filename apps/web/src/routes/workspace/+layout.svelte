<script lang="ts">
	import { page } from "$app/state";
	import { Button } from "@glyphtex/ui/button";
	import { onMount } from "svelte";

	import { cloud } from "$lib/cloud/api";
	import { authClient } from "$lib/cloud/auth";
	import { cloudEnabled } from "$lib/cloud/config";
	import { cloudSession } from "$lib/cloud/session.svelte";

	let { children } = $props();

	// Set while an instance admin is viewing as someone else; the bar is the only way back.
	let viewingAs = $state<string | null>(null);
	// Only true when this server can send the verification mail and asks for it.
	let verificationRequired = $state(false);

	onMount(async () => {
		if (!cloudEnabled) return;
		try {
			const { data } = await authClient.getSession();
			if (data?.session && (data.session as { impersonatedBy?: string | null }).impersonatedBy) {
				viewingAs = data.user.email;
			}
			verificationRequired = (await cloud.info()).features.emailVerification;
		} catch {
			// Best effort: without the bars nothing is blocked, the server still enforces its rules.
		}
	});

	const unverified = $derived(
		verificationRequired &&
			cloudSession.user !== null &&
			!cloudSession.user.emailVerified &&
			!page.url.pathname.startsWith("/workspace/verify-email") &&
			!page.url.pathname.startsWith("/workspace/sign-in")
	);

	async function stop() {
		await authClient.admin.stopImpersonating();
		location.assign("/workspace/admin/users");
	}
</script>

<svelte:head>
	<!-- The workspace is per-browser app state, not content. -->
	<meta name="robots" content="noindex, follow" />
</svelte:head>

{#if viewingAs}
	<div
		class="bg-warning text-warning-foreground fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 px-4 py-1.5 text-sm"
		role="status"
	>
		Viewing as {viewingAs}
		<Button size="sm" variant="dark" onclick={stop}>Stop viewing</Button>
	</div>
{:else if unverified}
	<div
		class="bg-tint text-foreground fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 px-4 py-1.5 text-sm"
		role="status"
	>
		Verify your email to share projects and invite people.
		<Button size="sm" variant="dark" href="/workspace/verify-email?next={encodeURIComponent(page.url.pathname)}">
			Verify now
		</Button>
	</div>
{/if}

<!-- The workspace keeps its 12/13/14 type density; app.css reads this through :has(). -->
<div data-density="compact" class="contents">
	{@render children()}
</div>
