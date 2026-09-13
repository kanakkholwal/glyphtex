<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { Button } from "@glyphtex/ui/button";
	import { Logo } from "@glyphtex/ui/logo";
	import { IconArrowLeft, IconFolders, IconRefresh } from "@tabler/icons-svelte";

	const status = $derived(page.status);
	const message = $derived(page.error?.message);
	const notFound = $derived(status === 404);

	const home = () => goto(resolve("/"));
	function goBack() {
		if (history.length > 1) history.back();
		else void home();
	}
</script>

<svelte:head><title>Error {status} · GlyphTeX</title></svelte:head>

<main class="flex h-dvh w-full items-center justify-center overflow-auto bg-background px-8 text-foreground">
	<div class="flex w-full max-w-xl flex-col items-start">
		<Logo size="md" text={false} class="mb-8" />

		<span
			class="mb-4 w-fit -rotate-2 rounded-md border border-border bg-background px-2.5 py-1 text-caption font-semibold text-foreground tabular-nums"
		>
			Error {status}
		</span>

		<h1 class="text-heading-lg font-medium text-balance">
			{#if notFound}
				This view has
				<br />
				<span class="text-primary">moved on</span>
			{:else}
				Something
				<br />
				<span class="text-primary">went wrong</span>
			{/if}
		</h1>
		<p class="mt-4 text-body-lg text-pretty text-muted-foreground">
			{notFound
				? 'That screen no longer exists. Your projects are on disk, exactly where you left them.'
				: 'GlyphTeX hit an unexpected error. Nothing is written to your project when a view fails to load, so your files are intact.'}
		</p>

		<div class="mt-8 flex flex-wrap items-center gap-3">
			{#if notFound}
				<Button variant="primary" size="lg" onclick={home}>
					<IconFolders /> Projects
				</Button>
				<Button variant="outline" size="lg" onclick={goBack}>
					<IconArrowLeft /> Go back
				</Button>
			{:else}
				<Button variant="primary" size="lg" onclick={() => location.reload()}>
					<IconRefresh /> Try again
				</Button>
				<Button variant="outline" size="lg" onclick={home}>
					<IconFolders /> Projects
				</Button>
			{/if}
		</div>

		{#if !notFound && message}
			<details class="group mt-6 w-full">
				<summary
					class="flex min-h-10 w-fit cursor-pointer list-none items-center rounded-md text-body text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
				>
					<span class="group-open:hidden">Show error details</span>
					<span class="hidden group-open:inline">Hide error details</span>
				</summary>
				<!-- Scrolls instead of truncating: this is the text pasted into a bug report. -->
				<pre
					class="mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-caption whitespace-pre-wrap text-foreground select-text">{message}</pre>
			</details>
		{/if}
	</div>
</main>
