<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconLoader2, IconMail } from "@tabler/icons-svelte";

	import { appUrl, authClient, unwrap } from "$lib/cloud/auth";
	import SettingsSection from "./SettingsSection.svelte";

	let { email }: { email: string } = $props();
	let busy = $state(false);
	let sent = $state(false);

	// A reset link also covers accounts that only ever signed in with a provider or a magic link.
	async function sendLink() {
		busy = true;
		try {
			await unwrap(
				authClient.requestPasswordReset({ email, redirectTo: appUrl("/workspace/sign-in/reset") })
			);
			sent = true;
			toast.success(`Reset link sent to ${email}.`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not send the reset link.");
		} finally {
			busy = false;
		}
	}
</script>

<SettingsSection title="Password" description="Set or change the password you sign in with.">
	<div class="border-border bg-background flex flex-wrap items-center gap-4 rounded-xl border p-4">
		<p class="text-muted-foreground min-w-0 flex-1 text-sm">
			{sent ? `Check ${email} for the link.` : `We'll email a link to ${email} to choose a new password.`}
		</p>
		<Button variant="outline" size="sm" disabled={busy} onclick={sendLink}>
			{#if busy}<IconLoader2 class="animate-spin" />{:else}<IconMail />{/if}
			{sent ? "Send again" : "Email reset link"}
		</Button>
	</div>
</SettingsSection>
