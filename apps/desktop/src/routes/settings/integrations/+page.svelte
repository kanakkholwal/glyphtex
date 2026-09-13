<script lang="ts">
	import { projectHost } from "$lib/project";
	import SettingsHeader from "$lib/settings-header.svelte";
	import SettingsSwitch from "$lib/settings-switch.svelte";
	import { Badge } from "@glyphtex/ui/badge";
	import { Button } from "@glyphtex/ui/button";
	import { SettingsField } from "@glyphtex/ui/settings-field";
	import { SettingsSection } from "@glyphtex/ui/settings-section";
	import { Spinner } from "@glyphtex/ui/spinner";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconCheck } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	// The folder menu entry is a Windows registry key; other platforms get file associations only.
	const supported = typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent);

	// null while checking. Queried from the OS so a revisit never offers Add for an existing entry.
	let registered = $state<boolean | null>(supported ? null : false);
	let busy = $state(false);

	onMount(async () => {
		if (!supported) return;
		try {
			registered = (await projectHost.shellIntegrationRegistered?.()) ?? false;
		} catch (e) {
			console.error("[integrations] shell integration status check failed", e);
			registered = false;
		}
	});

	async function setShellIntegration(add: boolean) {
		if (busy) return;
		busy = true;
		try {
			const msg = add
				? await projectHost.registerShellIntegration?.()
				: await projectHost.unregisterShellIntegration?.();
			registered = add;
			toast.success(
				msg ??
					(add
						? "Added “Open with GlyphTeX” to the folder menu."
						: "Removed “Open with GlyphTeX” from the folder menu.")
			);
		} catch (e) {
			console.error("[integrations] shell integration change failed", e);
			toast.error(
				add
					? "Couldn't add “Open with GlyphTeX” to the folder menu."
					: "Couldn't remove “Open with GlyphTeX” from the folder menu."
			);
		} finally {
			busy = false;
		}
	}

	const description = $derived(
		!supported
			? "Windows only. On this system, .tex and .glyx files open with GlyphTeX through the installer."
			: registered
				? "Right-click any folder and choose “Open with GlyphTeX”."
				: "Adds “Open with GlyphTeX” to the folder right-click menu."
	);
</script>

<SettingsHeader title="Integrations" description="How GlyphTeX connects to your system." />

<SettingsSection label="System">
	<div class="px-5 py-4">
		<SettingsField label="Folder menu" {description} layout="row">
			{#if registered === null}
				<Button variant="outline" disabled>
					<Spinner class="size-4" /> Checking…
				</Button>
			{:else if registered}
				<div class="flex items-center gap-3">
					<span class="inline-flex items-center gap-1 text-body font-medium text-success">
						<IconCheck size={16} aria-hidden="true" /> Added
					</span>
					<Button variant="outline" disabled={busy} onclick={() => setShellIntegration(false)}>
						{busy ? 'Removing…' : 'Remove'}
					</Button>
				</div>
			{:else}
				<Button
					variant="outline"
					disabled={busy || !supported}
					onclick={() => setShellIntegration(true)}
				>
					{#if busy}
						<Spinner class="size-4" /> Adding…
					{:else}
						Add to menu
					{/if}
				</Button>
			{/if}
		</SettingsField>
	</div>
</SettingsSection>

<SettingsSection label="Cloud sync" description="GlyphTeX stays local-first. Sync will always be opt-in.">
	{#snippet action()}
		<Badge variant="secondary">Coming soon</Badge>
	{/snippet}
	<SettingsSwitch
		label="Sync across devices"
		description="End-to-end encrypted. Not available yet."
		checked={false}
		disabled
		onchange={() => {}}
	/>
</SettingsSection>
