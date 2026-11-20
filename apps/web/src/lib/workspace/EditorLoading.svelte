<script lang="ts">
	import { resolve } from "$app/paths";
	import { Button } from "@glyphtex/ui/button";
	import { LoadingScreen } from "@glyphtex/ui/loading-screen";
	import { Logo } from "@glyphtex/ui/logo";
	import { onMount } from "svelte";

	let { onretry }: { onretry: () => void } = $props();

	// A short wait is normal; past this the screen says what is going on and offers a way out.
	const SLOW_MS = 6000;
	let slow = $state(false);

	onMount(() => {
		const timer = setTimeout(() => (slow = true), SLOW_MS);
		return () => clearTimeout(timer);
	});
</script>

{#snippet logo()}
	<Logo size="lg" />
{/snippet}

{#snippet caption()}
	<div class="flex max-w-sm flex-col items-center gap-4 text-center">
		<p class="text-foreground text-sm font-medium">Opening your document</p>
		{#if slow}
			<p class="text-muted-foreground text-xs text-pretty">
				This is taking longer than usual. Your files are stored on this device, so nothing is lost. If you are
				signed in, an unreachable server can slow things down.
			</p>
			<div class="flex gap-2">
				<Button variant="dark" size="sm" onclick={onretry}>Try again</Button>
				<Button variant="secondary" size="sm" href={resolve("/workspace")}>Back to projects</Button>
			</div>
		{:else}
			<p class="text-muted-foreground text-xs">Reading files from this browser.</p>
		{/if}
	</div>
{/snippet}

<LoadingScreen open {logo} {caption} indicator="bar" logoMotion="none" label="Opening document" />
