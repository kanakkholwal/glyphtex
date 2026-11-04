<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { Button } from "@glyphtex/ui/button";
	import { Logo } from "@glyphtex/ui/logo";
	import { onMount } from "svelte";

	import { cloudSession } from "$lib/cloud/session.svelte";
	import { findByRemote } from "$lib/storage/projects";
	import { cloneRemote } from "$lib/sync/engine";

	// Server projects open as linked copies in this browser: the editor only ever edits local data.
	let error = $state("");

	onMount(async () => {
		const remoteId = page.params.id ?? "";
		try {
			await cloudSession.ensure();
			const localId = await cloneRemote(remoteId, await findByRemote(remoteId));
			const share = page.url.searchParams.get("share") === "1" ? "?share=1" : "";
			void goto(
				`${resolve(`/workspace/projects/${localId}` as `/workspace/projects/${string}`)}${share}`,
				{
					replaceState: true
				}
			);
		} catch (e) {
			error = e instanceof Error ? e.message : "Could not open this project.";
		}
	});
</script>

<main id="main" class="bg-canvas flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
	<Logo size={28} />
	{#if error}
		<p class="text-foreground text-sm font-medium">Can't open this project</p>
		<p class="text-muted-foreground max-w-sm text-center text-sm">{error}</p>
		<Button variant="outline" size="sm" href={resolve('/workspace')}>Back to projects</Button>
	{:else}
		<p class="text-muted-foreground text-sm" role="status">Getting the latest version…</p>
	{/if}
</main>
