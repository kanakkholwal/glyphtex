<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { Button } from "@glyphtex/ui/button";
	import { Input } from "@glyphtex/ui/input";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconLoader2 } from "@tabler/icons-svelte";

	import { authClient, unwrap } from "$lib/cloud/auth";
	import CloudPage from "$lib/cloud/CloudPage.svelte";

	const token = $derived(page.url.searchParams.get("token") ?? "");
	let password = $state("");
	let confirm = $state("");
	let busy = $state(false);
	let error = $state<string | undefined>(undefined);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (password !== confirm) {
			error = "The passwords don't match.";
			return;
		}
		busy = true;
		error = undefined;
		try {
			await unwrap(authClient.resetPassword({ newPassword: password, token }));
			toast.success("Password changed. Sign in with the new one.");
			void goto(resolve("/workspace/account"));
		} catch (e) {
			error = e instanceof Error ? e.message : "Could not reset the password.";
		} finally {
			busy = false;
		}
	}
</script>

<CloudPage title="Choose a new password">
	{#if !token}
		<p class="text-md">This reset link is incomplete. Request a new one from the sign-in page.</p>
		<Button variant="dark" href={resolve('/workspace/account')}>Go to sign in</Button>
	{:else}
		<form class="flex flex-col gap-3" onsubmit={submit}>
			<label class="flex flex-col gap-1 text-xs font-medium">
				New password
				<Input type="password" required minlength={10} autocomplete="new-password" placeholder="At least 10 characters" bind:value={password} />
			</label>
			<label class="flex flex-col gap-1 text-xs font-medium">
				Repeat it
				<Input type="password" required minlength={10} autocomplete="new-password" placeholder="Repeat the new password" bind:value={confirm} />
			</label>
			{#if error}<p class="text-destructive-strong text-sm" role="alert">{error}</p>{/if}
			<Button type="submit" variant="dark" disabled={busy}>
				{#if busy}<IconLoader2 class="animate-spin" />{/if}
				Change password
			</Button>
		</form>
	{/if}
</CloudPage>
