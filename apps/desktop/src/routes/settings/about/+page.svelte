<script lang="ts">
	import { updater } from '$lib/updater.svelte';
	import { Badge } from '@glyphx/ui/badge';
	import { Button } from '@glyphx/ui/button';
	import { Logo } from '@glyphx/ui/logo';
	import { SettingsSection } from '@glyphx/ui/settings-section';
	import { Spinner } from '@glyphx/ui/spinner';
	import { onMount } from 'svelte';

	let appVersion = $state('0.1.0');

	onMount(async () => {
		try {
			const { getVersion } = await import('@tauri-apps/api/app');
			appVersion = await getVersion();
		} catch {
			/* non-Tauri / web — keep the fallback */
		}
	});

	// A human line describing the updater state, shown under the action.
	const updateLine = $derived.by(() => {
		switch (updater.status) {
			case 'checking':
				return 'Checking for updates…';
			case 'up-to-date':
				return "You're on the latest version.";
			case 'update-available':
				return `Version ${updater.version} is available — see the prompt to download.`;
			case 'downloading':
				return `Downloading update… ${Math.round(updater.progress * 100)}%`;
			case 'ready':
				return 'Update downloaded — restart to apply.';
			case 'error':
				return updater.error ?? 'Update check failed.';
			default:
				return 'GlyphX checks for updates automatically on launch.';
		}
	});
</script>

<div class="flex flex-col gap-8">
	<header>
		<h2 class="font-display text-2xl font-semibold tracking-tight">About</h2>
		<p class="text-muted-foreground mt-1.5 text-sm">What GlyphX is, and what it promises.</p>
	</header>

	<SettingsSection class="flex flex-col gap-5 p-5">
		<div class="flex items-center gap-4">
			<Logo text={false} badge size={48} />
			<div class="flex flex-col gap-1">
				<div class="flex items-center gap-2">
					<p class="text-foreground text-base font-medium">GlyphX</p>
					<Badge variant="secondary">v{appVersion}</Badge>
				</div>
				<p class="text-muted-foreground text-sm">Local-first LaTeX editor</p>
			</div>
		</div>

		<div class="bg-border/60 h-px"></div>

		<!-- Updates: manual check; an available update surfaces the corner card. -->
		<div class="flex items-center justify-between gap-3">
			<div class="min-w-0">
				<p class="text-foreground text-sm font-medium">Software update</p>
				<p
					class="mt-0.5 text-xs {updater.status === 'error'
						? 'text-destructive'
						: 'text-muted-foreground'}"
				>
					{updateLine}
				</p>
			</div>
			<Button
				variant="soft"
				size="xs"
				class="shrink-0"
				disabled={updater.status === 'checking' || updater.status === 'downloading'}
				onclick={() => updater.checkNow()}
			>
				{#if updater.status === 'checking'}
					<Spinner class="size-3.5" /> Checking…
				{:else}
					Check for updates
				{/if}
			</Button>
		</div>

		<div class="bg-border/60 h-px"></div>

		<div class="text-muted-foreground flex flex-col gap-3 text-sm leading-relaxed">
			<p>
				GlyphX compiles real LaTeX on your machine with Tectonic — nothing is uploaded, and it works
				fully offline. Your documents stay on disk, in plain files you own.
			</p>
			<p>
				Open any folder as a project, just like a normal LaTeX setup: a main file plus whatever you
				<code class="bg-muted rounded px-1 py-0.5 text-[12px]">\input</code> or include.
			</p>
		</div>
	</SettingsSection>
</div>
