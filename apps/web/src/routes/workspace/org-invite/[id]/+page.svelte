<script lang="ts">
	import RowsSkeleton from "$lib/loading/RowsSkeleton.svelte";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { Button } from "@glyphtex/ui/button";
	import { IconArrowLeft } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { authClient, unwrap } from "$lib/cloud/auth";
	import CloudPage from "$lib/cloud/CloudPage.svelte";
	import { cloudEnabled } from "$lib/cloud/config";
	import { cloudSession } from "$lib/cloud/session.svelte";

	const id = $derived(page.params.id ?? "");
	let phase = $state<"checking" | "signin" | "ready" | "joining" | "error">("checking");
	let error = $state("");
	let invite = $state<{ organizationName: string; inviterEmail: string; role: string } | null>(
		null
	);

	onMount(async () => {
		if (!cloudEnabled) {
			phase = "error";
			error = "This GlyphTeX has no server configured.";
			return;
		}
		await cloudSession.refresh();
		if (!cloudSession.signedIn) {
			phase = "signin";
			return;
		}
		try {
			invite = await unwrap(authClient.organization.getInvitation({ query: { id } }));
			phase = "ready";
		} catch (e) {
			phase = "error";
			error = e instanceof Error ? e.message : "This invitation can't be opened.";
		}
	});

	async function respond(accept: boolean) {
		phase = "joining";
		try {
			if (accept) {
				const joined = await unwrap(authClient.organization.acceptInvitation({ invitationId: id }));
				await cloudSession.refresh();
				await cloudSession.switchTo(joined.member.organizationId);
			} else {
				await unwrap(authClient.organization.rejectInvitation({ invitationId: id }));
			}
			void goto(resolve("/workspace"), { replaceState: true });
		} catch (e) {
			phase = "error";
			error = e instanceof Error ? e.message : "That didn't work.";
		}
	}

	const signInHref = $derived(
		`${resolve("/workspace/account")}?next=${encodeURIComponent(page.url.pathname)}`
	);
</script>

{#snippet back()}
	<Button variant="ghost" size="sm" href={resolve('/workspace')}>
		<IconArrowLeft /> Back to projects
	</Button>
{/snippet}

{#if phase === 'signin'}
	<CloudPage
		title="You've been invited to an organization"
		description="Sign in with the email address the invitation was sent to."
		footer={back}
	>
		<Button variant="dark" class="self-start" href={signInHref}>Sign in to continue</Button>
	</CloudPage>
{:else if phase === 'error'}
	<CloudPage title="Can't open this invitation" description={error} footer={back}>
		<p class="text-muted-foreground text-sm">Ask whoever invited you to send a new one.</p>
	</CloudPage>
{:else if phase === 'ready' && invite}
	<CloudPage
		title={`Join ${invite.organizationName}`}
		description={`${invite.inviterEmail} invited you as ${invite.role === 'admin' ? 'an admin' : `a ${invite.role}`}.`}
		footer={back}
	>
		<p class="text-muted-foreground text-sm">
			You'll see the organization's projects in the workspace switcher. Your personal projects stay
			yours.
		</p>
		<div class="flex gap-2">
			<Button variant="dark" onclick={() => respond(true)}>Join organization</Button>
			<Button variant="ghost" onclick={() => respond(false)}>Decline</Button>
		</div>
	</CloudPage>
{:else}
	<CloudPage title="Organization invitation">
		<RowsSkeleton rows={1} label="Loading the invitation" />
	</CloudPage>
{/if}
