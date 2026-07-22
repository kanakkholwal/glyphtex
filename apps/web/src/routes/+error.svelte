<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '@glyphtex/ui/button';
	import { Logo } from '@glyphtex/ui/logo';
	import {
		IconAlertTriangle,
		IconArrowLeft,
		IconArrowRight,
		IconBarrierBlock,
		IconBrandGithub,
		IconFileUnknown,
		IconHome,
		IconPlayerPlay,
		IconRefresh
	} from '@tabler/icons-svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	const repo = 'https://github.com/kanakkholwal/glyphtex';

	const status = $derived(page.status);
	const message = $derived(page.error?.message || 'An unexpected error occurred.');
	const isNotFound = $derived(status === 404);
	const isServer = $derived(status >= 500);

	const title = $derived(
		isNotFound ? 'This page has moved on.' : isServer ? 'Something broke.' : 'Something went wrong.'
	);
	const tagline = $derived(isNotFound ? 'Nothing was lost.' : 'Your work is untouched.');
	const desc = $derived(
		isNotFound
			? 'The link is dead or the page was renamed. Your documents live in this browser and are exactly where you left them.'
			: 'GlyphTeX hit an unexpected error. Nothing writes to your documents on a failed page load, so what you have saved is intact.'
	);
</script>

<svelte:head>
	<title>{status} · GlyphTeX</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div
	class="relative flex min-h-dvh w-full flex-col bg-canvas font-sans text-ink antialiased selection:bg-brand-subtle"
>
	<div
		aria-hidden="true"
		class="landing-bg-grid landing-bg-grid-fade pointer-events-none fixed inset-0 -z-10 opacity-30"
	></div>

	<header class="px-6 pt-8 lg:px-10">
		<Logo href={resolve('/')} size="md" badge text tone="gradient" />
	</header>

	<main class="flex flex-1 items-center px-6 py-16 lg:px-10">
		<div class="mx-auto w-full max-w-2xl">
			<span
				class="border-hairline bg-card/60 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.16em] text-foreground/70 uppercase"
				in:fly={{ y: 8, duration: 500, easing: cubicOut }}
			>
				{#if isNotFound}
					<IconFileUnknown class="size-3.5" />
				{:else if isServer}
					<IconBarrierBlock class="text-warning size-3.5" />
				{:else}
					<IconAlertTriangle class="text-destructive size-3.5" />
				{/if}
				Error {status}
			</span>

			<h1
				class="landing-text-balance mt-6 text-[2.5rem] leading-[1.05] font-bold tracking-[-0.025em] text-foreground sm:text-5xl"
				in:fly={{ y: 12, duration: 600, delay: 80, easing: cubicOut }}
			>
				{title}
				<span
					class="mt-2 block font-serif text-xl font-medium text-foreground/55 italic sm:text-2xl"
					style="line-height: 1.15;"
				>
					{tagline}
				</span>
			</h1>

			<p
				class="landing-text-pretty mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
				in:fly={{ y: 12, duration: 600, delay: 160, easing: cubicOut }}
			>
				{desc}
			</p>

			{#if !isNotFound}
				<!-- The raw message can be long or contain a stack frame, so it scrolls
				     inside its own box rather than stretching the layout. -->
				<pre
					class="border-hairline bg-card/60 text-muted-foreground mt-6 max-w-xl overflow-x-auto rounded-xl border px-3.5 py-3 text-left font-mono text-[12px] leading-relaxed"
					title={message}>{message}</pre>
			{/if}

			<div
				class="mt-8 flex flex-wrap items-center gap-3"
				in:fly={{ y: 12, duration: 600, delay: 240, easing: cubicOut }}
			>
				<Button href={resolve('/workspace')} size="lg" class="group/cta gap-2.5">
					<IconPlayerPlay class="size-4" />
					Go to the workspace
					<IconArrowRight class="size-4 transition-transform group-hover/cta:translate-x-0.5" />
				</Button>
				<Button variant="outline" size="lg" class="gap-2" onclick={() => history.back()}>
					<IconArrowLeft class="size-4" />
					Go back
				</Button>
				{#if !isNotFound}
					<Button
						variant="ghost"
						size="lg"
						class="text-muted-foreground gap-2"
						onclick={() => location.reload()}
					>
						<IconRefresh class="size-4" />
						Try reloading
					</Button>
				{/if}
			</div>

			<div
				class="border-hairline mt-10 flex flex-wrap items-center gap-2 border-t pt-6"
				in:fly={{ y: 8, duration: 500, delay: 320, easing: cubicOut }}
			>
				<Button href={resolve('/')} variant="ghost" size="sm" class="text-muted-foreground gap-1.5">
					<IconHome class="size-4" />
					Home
				</Button>
				<Button
					href="{repo}/issues"
					target="_blank"
					rel="noopener noreferrer"
					variant="ghost"
					size="sm"
					class="text-muted-foreground gap-1.5"
				>
					<IconBrandGithub class="size-4" />
					Report this
				</Button>
			</div>
		</div>
	</main>
</div>
