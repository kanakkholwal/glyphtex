<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconFingerprint, IconLoader2, IconTrash } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { authClient, unwrap } from "$lib/cloud/auth";
	import SettingsSection from "./SettingsSection.svelte";

	type Row = { id: string; name?: string | null; createdAt?: Date | string | null };
	let keys = $state<Row[]>([]);
	let loaded = $state(false);
	let busy = $state(false);

	async function load() {
		try {
			keys = (await unwrap(authClient.passkey.listUserPasskeys())) as Row[];
		} catch {
			keys = [];
		} finally {
			loaded = true;
		}
	}

	async function run(task: () => Promise<unknown>, failure: string) {
		busy = true;
		try {
			await task();
			await load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : failure);
		} finally {
			busy = false;
		}
	}

	const add = () =>
		run(
			() => unwrap(authClient.passkey.addPasskey({ name: `Passkey ${keys.length + 1}` })),
			"Could not add the passkey."
		);
	const remove = (id: string) =>
		run(() => unwrap(authClient.passkey.deletePasskey({ id })), "Could not remove the passkey.");

	onMount(load);
</script>

<SettingsSection
	title="Passkeys"
	description="Sign in with your fingerprint, face or a security key instead of a password."
>
	<div class="bg-tint flex flex-col gap-3 rounded-xl p-4">
		{#if loaded && keys.length === 0}
			<p class="text-muted-foreground text-sm">No passkeys yet.</p>
		{/if}
		{#each keys as key (key.id)}
			<div class="flex items-center gap-3">
				<IconFingerprint class="text-muted-foreground size-4 shrink-0" />
				<span class="text-foreground min-w-0 flex-1 truncate text-sm">{key.name || "Passkey"}</span>
				<Button variant="ghost" size="sm" disabled={busy} onclick={() => remove(key.id)} aria-label="Remove passkey">
					<IconTrash />
				</Button>
			</div>
		{/each}
		<Button variant="outline" size="sm" class="self-start" disabled={busy} onclick={add}>
			{#if busy}<IconLoader2 class="animate-spin" />{:else}<IconFingerprint />{/if}
			Add a passkey
		</Button>
	</div>
</SettingsSection>
