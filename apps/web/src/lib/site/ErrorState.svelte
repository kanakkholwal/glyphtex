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
		<span
			class="mb-4 w-fit -rotate-2 rounded-md border border-border bg-background px-2.5 py-1 text-caption font-semibold tabular-nums text-foreground"
		>
			{notFound ? 'Error 404' : `Error ${status}`}
		</span>

		<h1 class="text-balance text-heading-lg font-medium text-foreground md:text-display">
			{#if notFound}
				This page has
				<br />
				<span class="text-primary">moved on</span>
			{:else}
				Something
				<br />
				<span class="text-primary">went wrong</span>
			{/if}
		</h1>
		<p class="mt-4 max-w-xl text-pretty text-body text-muted-foreground md:text-body-lg">
			{notFound
				? 'The link is mistyped or the page was renamed. Your projects live in this browser and are exactly where you left them.'
				: 'The page failed to load. Nothing is written to your projects when a page fails, so what you saved is intact.'}
		</p>

		<div class="mt-8 flex flex-wrap items-center gap-2 sm:gap-3">
			{#if notFound}
				<Button href={resolve('/')} variant="primary">
					<IconHome />
					Home
				</Button>
				<Button variant="outline" onclick={goBack}>
					<IconArrowLeft />
					Go back
				</Button>
			{:else}
				<Button variant="primary" onclick={() => location.reload()}>
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
					class="flex min-h-10 w-fit cursor-pointer list-none items-center rounded-md text-body text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
				>
					<span class="group-open:hidden">Show error details</span>
					<span class="hidden group-open:inline">Hide error details</span>
				</summary>
				<pre
					class="mt-2 overflow-x-auto rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-caption text-foreground">{message}</pre>
			</details>
		{/if}
	</div>

	{#if notFound}
		<section class="flex flex-col gap-3" aria-labelledby="error-popular">
			<h2 id="error-popular" class="text-body font-medium text-muted-foreground">Popular pages</h2>
			<ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{#each popular as item (item.href)}
					<li>
						<a
							href={item.href}
							class="group flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card p-2.5 pr-3 outline-none transition-[border-color] duration-200 ease-craft hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring dark:bg-background"
						>
							<span
								class="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground transition-colors duration-200 group-hover:text-primary"
							>
								<item.icon class="size-4" aria-hidden="true" />
							</span>
							<span class="min-w-0 flex-1 truncate text-body font-medium text-foreground">
								{item.title}
							</span>
							<IconArrowRight
								aria-hidden="true"
								class="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-craft group-hover:translate-x-0.5"
							/>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<p class="text-body text-muted-foreground">
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
