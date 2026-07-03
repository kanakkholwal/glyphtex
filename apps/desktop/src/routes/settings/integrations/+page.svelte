<script lang="ts">
	import { Badge } from '@glyphx/ui/badge';
	import { Button } from '@glyphx/ui/button';
	import { SettingsField } from '@glyphx/ui/settings-field';
	import { SettingsSection } from '@glyphx/ui/settings-section';
	import { Spinner } from '@glyphx/ui/spinner';
	import { toast } from '@glyphx/ui/sonner';
	import { IconCheck, IconCloud } from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import { projectHost } from '$lib/project';

	// Reflect the *actual* OS state, queried on mount, so re-visiting the page
	// never falsely offers "Add" for an entry that's already registered.
	//   null  → still checking
	//   false → not registered (offer Add)
	//   true  → registered (show Added + offer Remove)
	let registered = $state<boolean | null>(null);
	let busy = $state(false);

	onMount(async () => {
		try {
			registered = (await projectHost.shellIntegrationRegistered?.()) ?? false;
		} catch (e) {
			console.error('[integrations] shell integration status check failed', e);
			registered = false;
		}
	});

	async function addShellIntegration() {
		if (busy) return;
		busy = true;
		try {
			const msg = await projectHost.registerShellIntegration?.();
			registered = true;
			toast.success(msg ?? 'Added “Open with GlyphX” to the folder menu.');
		} catch (e) {
			// Plain language for the toast; raw cause to the console (§5).
			console.error('[integrations] register shell integration failed', e);
			toast.error('Could not add “Open with GlyphX” to the folder menu.');
		} finally {
			busy = false;
		}
	}

	async function removeShellIntegration() {
		if (busy) return;
		busy = true;
		try {
			const msg = await projectHost.unregisterShellIntegration?.();
			registered = false;
			toast.success(msg ?? 'Removed “Open with GlyphX” from the folder menu.');
		} catch (e) {
			console.error('[integrations] unregister shell integration failed', e);
			toast.error('Could not remove “Open with GlyphX” from the folder menu.');
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-8">
	<header>
		<h2 class="font-display text-2xl font-semibold tracking-tight">Integrations</h2>
		<p class="text-muted-foreground mt-1.5 text-sm">
			OS integration and (later) cloud sync. The LaTeX engine lives under Engine.
		</p>
	</header>

	<SettingsSection label="System">
		<div class="px-5 py-4">
			<SettingsField
				label="Shell integration"
				description={registered
					? 'Added — right-click any folder and choose “Open with GlyphX”.'
					: 'Add an “Open with GlyphX” entry to the folder right-click menu. (.tex and .glyx files are associated by the installer.)'}
				layout="row"
			>
				{#if registered === null}
					<Button variant="soft" size="xs" disabled>
						<Spinner class="size-3.5" /> Checking…
					</Button>
				{:else if registered}
					<div class="flex items-center gap-2">
						<span class="text-success inline-flex items-center gap-1 text-xs font-medium">
							<IconCheck size={14} /> Added
						</span>
						<Button
							variant="ghost"
							size="xs"
							class="text-muted-foreground hover:text-destructive"
							disabled={busy}
							onclick={removeShellIntegration}
						>
							{busy ? 'Removing…' : 'Remove'}
						</Button>
					</div>
				{:else}
					<Button variant="soft" size="xs" disabled={busy} onclick={addShellIntegration}>
						{#if busy}
							<Spinner class="size-3.5" /> Adding…
						{:else}
							Add to menu
						{/if}
					</Button>
				{/if}
			</SettingsField>
		</div>
	</SettingsSection>

	<SettingsSection label="Cloud sync">
		{#snippet action()}
			<Badge variant="secondary">Coming soon</Badge>
		{/snippet}
		<div class="text-muted-foreground flex items-center gap-3 px-5 py-5 text-sm">
			<IconCloud size={20} class="shrink-0 opacity-70" />
			<p class="leading-relaxed">
				Optional end-to-end encrypted sync across your devices. GlyphX stays local-first — this will
				always be opt-in.
			</p>
		</div>
	</SettingsSection>
</div>
