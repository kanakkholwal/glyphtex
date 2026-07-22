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
			? "We couldn't find the page you were looking for."
			: 'GlyphTeX hit an unexpected error — your documents are safe on disk.'
	);
</script>

<svelte:head><title>{status} · GlyphTeX</title></svelte:head>

<div class="bg-background text-foreground flex h-dvh w-full items-center justify-center px-6">
	<div class="flex w-full max-w-sm flex-col items-center gap-4 text-center">
		<Logo text={false} size={40} class="mb-1" />

		<div class="border-border bg-muted/40 grid size-12 place-items-center rounded-xl border">
			{#if isNotFound}
				<IconFileUnknown size={22} class="text-muted-foreground" />
			{:else if isServer}
				<IconBarrierBlock size={22} class="text-warning" />
			{:else}
				<IconAlertTriangle size={22} class="text-destructive" />
			{/if}
		</div>

		<p class="text-muted-foreground font-mono text-[11px] font-semibold tracking-wider uppercase">
			Error {status}
		</p>

		<h1 class="font-display text-lg tracking-tight">{title}</h1>
		<p class="text-muted-foreground text-sm">{desc}</p>

		{#if !isNotFound}
			<pre
				class="border-border bg-muted/40 text-muted-foreground w-full max-w-xs truncate rounded-md border px-2 py-1.5 text-left font-mono text-[11px]"
				title={message}>{message}</pre>
		{/if}

		<div class="mt-1 flex w-full items-center gap-2">
			<Button variant="outline" size="sm" class="flex-1" onclick={() => history.back()}>
				<IconArrowLeft size={14} />
				Go back
			</Button>
			<Button size="sm" class="flex-1" onclick={() => goto(resolve('/'))}>
				<IconHome size={14} />
				Projects
			</Button>
		</div>

		{#if !isNotFound}
			<Button
				variant="ghost"
				size="xs"
				class="text-muted-foreground gap-1.5"
				onclick={() => location.reload()}
			>
				<IconRefresh size={12} />
				Try reloading
			</Button>
		{/if}
	</div>
</div>
