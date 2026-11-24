<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { Button } from "@glyphtex/ui/button";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconLoader2, IconMailCheck } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { cloud } from "$lib/cloud/api";
	import { appUrl, authClient, unwrap } from "$lib/cloud/auth";
	import AuthShell from "$lib/cloud/AuthShell.svelte";
	import { cloudEnabled } from "$lib/cloud/config";
	import { safeNext } from "$lib/cloud/next";
	import { cloudSession } from "$lib/cloud/session.svelte";

	const next = $derived(safeNext(page.url.searchParams.get("next"), "/workspace"));

	let ready = $state(false);
	let busy = $state(false);
	let sentTo = $state<string | undefined>();

	onMount(async () => {
		if (!cloudEnabled) return void goto("/workspace", { replaceState: true });
		await cloudSession.ensure();
		if (!cloudSession.signedIn) {
			return void goto(
				`/workspace/sign-in?next=${encodeURIComponent(page.url.pathname + page.url.search)}`,
				{
					replaceState: true
				}
			);
		}
		// Nothing to verify when the address is confirmed, or when this server cannot send the mail.
		const info = await cloud.info().catch(() => null);
		if (cloudSession.user?.emailVerified || info?.features.emailVerification === false) {
			return void goto(next, { replaceState: true });
		}
		ready = true;
	});

	async function resend() {
		const email = cloudSession.user?.email;
		if (!email) return;
		busy = true;
		try {
			await unwrap(authClient.sendVerificationEmail({ email, callbackURL: appUrl(next) }));
			sentTo = email;
			toast.success(`Verification email sent to ${email}.`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not send the email.");
		} finally {
			busy = false;
		}
	}

	async function recheck() {
		busy = true;
		await cloudSession.refresh();
		busy = false;
		if (cloudSession.user?.emailVerified) void goto(next, { invalidateAll: true });
		else toast.info("Not verified yet. Open the link in the email we sent.");
	}
</script>

<AuthShell
	title="Verify your email"
	description="Confirm your address to share projects, invite people and create organizations. Writing and your own projects keep working."
>
	{#if !ready}
		<div class="flex justify-center py-8" role="status" aria-label="Loading"><IconLoader2 class="animate-spin" /></div>
	{:else}
		<div class="flex flex-col gap-4">
			<p class="bg-tint flex items-start gap-3 rounded-2xl p-4 text-sm">
				<IconMailCheck class="mt-0.5 size-5 shrink-0" />
				<span>
					We sent a link to <strong class="font-medium">{cloudSession.user?.email}</strong>. Open it on
					this device and you are done.
				</span>
			</p>
			<Button variant="dark" disabled={busy} onclick={recheck}>
				{#if busy}<IconLoader2 class="animate-spin" />{/if} I have verified it
			</Button>
			<Button variant="outline" disabled={busy} onclick={resend}>
				{sentTo ? "Send it again" : "Resend the email"}
			</Button>
			<Button variant="ghost" size="sm" class="-ml-2.5 self-start" onclick={() => goto(next)}>
				Not now
			</Button>
		</div>
	{/if}
</AuthShell>
