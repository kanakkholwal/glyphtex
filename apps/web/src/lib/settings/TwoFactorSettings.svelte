<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { Input } from "@glyphtex/ui/input";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconLoader2, IconShieldCheck } from "@tabler/icons-svelte";
	import { renderSVG } from "uqr";

	import { authClient, unwrap } from "$lib/cloud/auth";
	import { cloudSession } from "$lib/cloud/session.svelte";
	import SettingsSection from "./SettingsSection.svelte";

	type Setup = { uri: string; backupCodes: string[] };

	const enabled = $derived(cloudSession.user?.twoFactorEnabled === true);
	let password = $state("");
	let code = $state("");
	let setup = $state<Setup | null>(null);
	let busy = $state(false);

	// The secret is the otpauth query value, shown so people without a camera can type it in.
	const secret = $derived(setup ? (new URL(setup.uri).searchParams.get("secret") ?? "") : "");
	const qr = $derived(setup ? renderSVG(setup.uri, { border: 1 }) : "");

	async function run(task: () => Promise<void>, failure: string) {
		busy = true;
		try {
			await task();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : failure);
		} finally {
			busy = false;
		}
	}

	const start = (event: SubmitEvent) => {
		event.preventDefault();
		void run(async () => {
			const result = await unwrap(authClient.twoFactor.enable({ password }));
			// Only the authenticator-app method is offered, so anything else is a server misconfiguration.
			if (result.method !== "totp") throw new Error("Authenticator setup isn't available.");
			setup = { uri: result.totpURI, backupCodes: result.backupCodes };
			password = "";
		}, "Could not start two-factor setup.");
	};

	const confirm = (event: SubmitEvent) => {
		event.preventDefault();
		void run(async () => {
			await unwrap(authClient.twoFactor.verifyTotp({ code: code.trim() }));
			setup = null;
			code = "";
			await cloudSession.refresh();
			toast.success("Two-factor authentication is on.");
		}, "That code didn't match.");
	};

	const disable = (event: SubmitEvent) => {
		event.preventDefault();
		void run(async () => {
			await unwrap(authClient.twoFactor.disable({ password }));
			password = "";
			await cloudSession.refresh();
			toast.success("Two-factor authentication is off.");
		}, "Could not turn off two-factor authentication.");
	};
</script>

<SettingsSection
	title="Two-factor authentication"
	description="Ask for a code from an authenticator app when you sign in with a password."
>
	<div class="border-border bg-card flex flex-col gap-4 rounded-xl border p-4">
		{#if setup}
			<div class="flex flex-col gap-4 sm:flex-row">
				<!-- Generated locally from the otpauth URI; nothing is sent to a QR service. -->
				<div class="bg-background size-40 shrink-0 rounded-lg p-2" role="img" aria-label="Authenticator QR code">
					{@html qr}
				</div>
				<div class="flex min-w-0 flex-1 flex-col gap-3">
					<p class="text-muted-foreground text-sm">
						Scan this with an authenticator app, or enter the key by hand.
					</p>
					<code class="bg-muted rounded-md px-2 py-1 text-xs break-all">{secret}</code>
					<form class="flex items-end gap-2" onsubmit={confirm}>
						<label class="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium">
							6-digit code
							<Input
								required
								inputmode="numeric"
								autocomplete="one-time-code"
								placeholder="123456"
								bind:value={code}
							/>
						</label>
						<Button type="submit" variant="dark" size="sm" disabled={busy || !code.trim()}>
							{#if busy}<IconLoader2 class="animate-spin" />{/if} Turn on
						</Button>
					</form>
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<p class="text-foreground text-sm font-medium">Backup codes</p>
				<p class="text-muted-foreground text-sm">
					Keep these somewhere safe. Each works once if you lose your device.
				</p>
				<ul class="grid grid-cols-2 gap-1 font-mono text-xs sm:grid-cols-4">
					{#each setup.backupCodes as c (c)}<li class="bg-muted rounded-md px-2 py-1">{c}</li>{/each}
				</ul>
			</div>
		{:else if enabled}
			<div class="flex items-center gap-2 text-sm">
				<IconShieldCheck size={16} class="text-primary" aria-hidden="true" />
				<span class="text-foreground font-medium">On</span>
			</div>
			<form class="flex flex-wrap items-end gap-2" onsubmit={disable}>
				<label class="flex min-w-48 flex-1 flex-col gap-1.5 text-xs font-medium">
					Password
					<Input
						type="password"
						required
						autocomplete="current-password"
						placeholder="Your password"
						bind:value={password}
					/>
				</label>
				<Button type="submit" variant="outline" size="sm" disabled={busy || !password}>
					Turn off
				</Button>
			</form>
		{:else}
			<form class="flex flex-wrap items-end gap-2" onsubmit={start}>
				<label class="flex min-w-48 flex-1 flex-col gap-1.5 text-xs font-medium">
					Password
					<Input
						type="password"
						required
						autocomplete="current-password"
						placeholder="Your password"
						bind:value={password}
					/>
				</label>
				<Button type="submit" variant="outline" size="sm" disabled={busy || !password}>
					{#if busy}<IconLoader2 class="animate-spin" />{/if} Set up
				</Button>
			</form>
		{/if}
	</div>
</SettingsSection>
