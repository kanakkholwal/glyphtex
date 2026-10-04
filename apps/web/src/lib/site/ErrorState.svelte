<script lang="ts">
	import { resolve } from "$app/paths";
	import { REPO_URL } from "$lib/landing/nav-data";
	import { Button } from "@glyphtex/ui/button";
	import {
		IconArrowLeft,
		IconArrowRight,
		IconBook2,
		IconCpu,
		IconFolders,
		IconHome,
		IconNews,
		IconRefresh
	} from "@tabler/icons-svelte";

	let { status, message }: { status: number; message?: string } = $props();

	const notFound = $derived(status === 404);

	const popular = [
		{ title: "Your projects", href: resolve("/workspace"), icon: IconFolders },
		{ title: "Docs", href: resolve("/docs"), icon: IconBook2 },
		{ title: "Blog", href: resolve("/blog"), icon: IconNews },
		{ title: "How the engine works", href: resolve("/engine"), icon: IconCpu }
	];

	function goBack() {
		if (history.length > 1) history.back();
		else location.assign(resolve("/"));
	}
</script>

<div class="flex w-full max-w-2xl flex-col gap-10">
	<div class="flex flex-col items-start">
		<p class="rise mb-4 font-mono text-xs text-muted-foreground tabular-nums">Error {status}</p>
		<h1 class="rise pixel text-4xl text-balance text-foreground sm:text-5xl" style:--i={1}>
			{#if notFound}
				This page has <span class="text-muted-foreground">moved on.</span>
			{:else}
				Something <span class="text-muted-foreground">went wrong.</span>
			{/if}
		</h1>
		<p
			class="rise mt-5 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg"
			style:--i={2}
		>
			{notFound
				? 'The link is mistyped or the page was renamed. Your projects live in this browser and are exactly where you left them.'
				: 'The page failed to load. Nothing is written to your projects when a page fails, so what you saved is intact.'}
		</p>
		<div class="rise mt-8 flex flex-wrap items-center gap-2" style:--i={3}>
			{#if notFound}
				<Button href={resolve('/')} variant="dark">
					<IconHome />
					Home
				</Button>
				<Button variant="outline" onclick={goBack}>
					<IconArrowLeft />
					Go back
				</Button>
			{:else}
				<Button variant="dark" onclick={() => location.reload()}>
					<IconRefresh />
					Try again
				</Button>
				<Button href={resolve('/')} variant="outline">
					<IconHome />
					Home
				</Button>
			{/if}
		</div>

		{#if !notFound && message}
			<details class="group mt-6 w-full max-w-xl">
				<summary
					class="flex min-h-10 w-fit cursor-pointer list-none items-center rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
				>
					<span class="group-open:hidden">Show error details</span>
					<span class="hidden group-open:inline">Hide error details</span>
				</summary>
				<pre
					class="mt-2 overflow-x-auto rounded-lg bg-card px-3 py-2.5 font-mono text-xs text-foreground">{message}</pre>
			</details>
		{/if}
	</div>

	{#if notFound}
		<section class="rise flex flex-col gap-2" style:--i={4} aria-labelledby="error-popular">
			<h2 id="error-popular" class="font-mono text-xs text-muted-foreground">popular pages</h2>
			<ul class="group/list grid grid-cols-1 gap-x-8 sm:grid-cols-2">
				{#each popular as item (item.href)}
					<li>
						<a
							href={item.href}
							class="flex items-center gap-3 border-t border-dashed border-border py-3 text-sm outline-none transition-opacity duration-(--duration-fast) group-hover/list:opacity-50 hover:opacity-100! focus-visible:opacity-100! focus-visible:ring-2 focus-visible:ring-ring"
						>
							<item.icon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							<span class="min-w-0 flex-1 truncate font-medium text-foreground">{item.title}</span>
							<IconArrowRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<p class="text-sm text-muted-foreground">
		Still stuck?
		<a
			href="{REPO_URL}/issues"
			target="_blank"
			rel="noopener noreferrer"
			class="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
		>
			Report it on GitHub
		</a>
	</p>
</div>
