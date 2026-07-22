<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '@glyphtex/ui/button';
	import { Logo } from '@glyphtex/ui/logo';
	import {
		IconAlertTriangle,
		IconArrowLeft,
		IconBarrierBlock,
		IconFileUnknown,
		IconHome,
		IconRefresh
	} from '@tabler/icons-svelte';

	const status = $derived(page.status);
	const message = $derived(page.error?.message || 'An unexpected error occurred.');
	const isNotFound = $derived(status === 404);
	const isServer = $derived(status >= 500);

	const title = $derived(
		isNotFound ? 'Page not found' : isServer ? 'Something broke' : 'Something went wrong'
	);
	const desc = $derived(
		isNotFound
			? 'That view no longer exists. Your projects are on disk, exactly where you left them.'
			: 'GlyphTeX hit an unexpected error. Nothing writes to your project on a failed load, so your files are intact.'
	);
</script>

<svelte:head><title>{status} · GlyphTeX</title></svelte:head>

<div class="flex h-dvh w-full items-center justify-center bg-background px-6 text-foreground">
	<div class="flex w-full max-w-md flex-col items-center gap-5 text-center">
		<Logo size="lg" badge text tone="gradient" />

		<span
			class="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
		>
			{#if isNotFound}
				<IconFileUnknown class="size-3.5" />
			{:else if isServer}
				<IconBarrierBlock class="size-3.5 text-warning" />
			{:else}
				<IconAlertTriangle class="size-3.5 text-destructive" />
			{/if}
			Error {status}
		</span>

		<div class="flex flex-col gap-2">
			<h1 class="font-display text-xl tracking-tight">{title}</h1>
			<p class="text-sm leading-relaxed text-balance text-muted-foreground">{desc}</p>
		</div>

		{#if !isNotFound}
			<!-- Scrolls rather than truncating: this is the text someone pastes into a
			     bug report, so it has to be readable and selectable in full. -->
			<pre
				class="max-h-32 w-full overflow-auto rounded-lg border border-border bg-muted/40 px-3 py-2 text-left font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{message}</pre>
		{/if}

		<div class="flex w-full items-center gap-2">
			<Button variant="outline" size="sm" class="flex-1 gap-1.5" onclick={() => history.back()}>
				<IconArrowLeft class="size-3.5" />
				Go back
			</Button>
			<Button size="sm" class="flex-1 gap-1.5" onclick={() => goto(resolve('/'))}>
				<IconHome class="size-3.5" />
				Projects
			</Button>
		</div>

		{#if !isNotFound}
			<Button
				variant="ghost"
				size="xs"
				class="gap-1.5 text-muted-foreground"
				onclick={() => location.reload()}
			>
				<IconRefresh class="size-3" />
				Try reloading
			</Button>
		{/if}
	</div>
</div>
