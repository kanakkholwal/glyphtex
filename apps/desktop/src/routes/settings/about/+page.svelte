<script lang="ts">
	import UpdateProgress from "$lib/update-progress.svelte";
	import { FAILURE_COPY, updater } from "$lib/updater.svelte";
	import SettingsHeader from "$lib/settings-header.svelte";
	import { Badge } from "@glyphtex/ui/badge";
	import { Button } from "@glyphtex/ui/button";
	import { Logo } from "@glyphtex/ui/logo";
	import { SettingsField } from "@glyphtex/ui/settings-field";
	import { SettingsSection } from "@glyphtex/ui/settings-section";
	import { Spinner } from "@glyphtex/ui/spinner";
	import { IconAlertTriangle, IconRefresh } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	let appVersion = $state<string | null>(null);

	onMount(async () => {
		try {
			const { getVersion } = await import("@tauri-apps/api/app");
			appVersion = await getVersion();
		} catch {
			/* Outside Tauri there is no version to report. */
		}
	});

	const updateLine = $derived.by(() => {
		switch (updater.status) {
			case "checking":
				return "Checking for updates…";
			case "unavailable":
				return "Updates are turned off in development builds.";
			case "up-to-date":
				return "You're on the latest version.";
			case "update-available":
				return `Version ${updater.version} is available.`;
			case "downloading":
				return `Downloading version ${updater.version}.`;
			case "ready":
				return "Update downloaded. Restart GlyphTeX to apply it.";
			case "error":
				return updater.failedStep
					? FAILURE_COPY[updater.failedStep].body
					: "Something went wrong while updating.";
			default:
				return "GlyphTeX checks for updates when it starts.";
		}
	});
	const busy = $derived(updater.status === "checking" || updater.status === "downloading");
</script>

<SettingsHeader title="About" description="Version, updates and what GlyphTeX promises." />

<SettingsSection>
	<div class="flex items-center gap-4 px-5 py-4">
		<Logo text={false} badge size={40} />
		<div class="flex min-w-0 flex-col gap-0.5">
			<div class="flex items-center gap-2">
				<p class="text-body font-medium text-foreground">GlyphTeX</p>
				{#if appVersion}<Badge variant="secondary">v{appVersion}</Badge>{/if}
			</div>
			<p class="text-body text-muted-foreground">Local-first LaTeX editor</p>
		</div>
	</div>
</SettingsSection>

<SettingsSection label="Software update" divided>
	<div class="flex flex-col gap-3 px-5 py-4">
		<SettingsField label="Status" description={updateLine} layout="row">
			{#if updater.status === 'update-available'}
				<Button variant="primary" onclick={() => updater.download()}>Download</Button>
			{:else if updater.status === 'ready'}
				<Button
					variant="primary"
					disabled={updater.installing}
					onclick={() => updater.installAndRelaunch()}
				>
					{updater.installing ? 'Installing…' : 'Restart to update'}
				</Button>
			{:else if updater.status === 'error'}
				<Button variant="outline" onclick={() => updater.retry()}>
					<IconRefresh /> Try again
				</Button>
			{:else}
				<Button
					variant="outline"
					disabled={busy || updater.status === 'unavailable'}
					onclick={() => updater.checkNow()}
				>
					{#if updater.status === 'checking'}
						<Spinner class="size-4" /> Checking…
					{:else}
						Check for updates
					{/if}
				</Button>
			{/if}
		</SettingsField>

		{#if updater.status === 'downloading'}
			<UpdateProgress />
		{:else if updater.status === 'error'}
			<p class="flex items-center gap-1.5 text-body text-destructive">
				<IconAlertTriangle size={16} aria-hidden="true" />
				{updater.failedStep ? FAILURE_COPY[updater.failedStep].title : 'Update failed'}
			</p>
			{#if updater.error}
				<details class="group">
					<summary
						class="w-fit cursor-pointer list-none rounded-md text-body text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
					>
						<span class="group-open:hidden">Show details</span>
						<span class="hidden group-open:inline">Hide details</span>
					</summary>
					<pre
						class="mt-2 max-h-40 overflow-auto rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs whitespace-pre-wrap text-foreground">{updater.error}</pre>
				</details>
			{/if}
		{/if}
	</div>
</SettingsSection>

<SettingsSection label="Our promise" padded>
	<div class="flex flex-col gap-3 text-body text-muted-foreground">
		<p>
			GlyphTeX compiles real LaTeX on your machine with Tectonic. Nothing is uploaded, and it works
			fully offline. Your documents stay on disk, in plain files you own.
		</p>
		<p>
			Open any folder as a project, like a normal LaTeX setup: a main file plus whatever you
			<code class="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs text-foreground">\input</code> or
			include.
		</p>
	</div>
</SettingsSection>
