<script lang="ts">
	import { resolve } from "$app/paths";
	import { Logo } from "@glyphtex/ui/logo";
	import { IconDeviceLaptop, IconShieldLock, IconUsers } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";

	import DotField from "$lib/landing/DotField.svelte";

	interface Props {
		title: string;
		description?: string;
		children: Snippet;
		/** Secondary navigation under the form (Back, Skip). */
		footer?: Snippet;
	}

	let { title, description, children, footer }: Props = $props();

	const points = [
		{
			icon: IconDeviceLaptop,
			title: "Local first",
			text: "Documents open and compile on your device. An account only adds saving and sharing."
		},
		{
			icon: IconUsers,
			title: "Built for teams",
			text: "Roles, single sign-on and SCIM for a department, a lab or a company."
		},
		{
			icon: IconShieldLock,
			title: "Open and self-hostable",
			text: "GPL on the desktop, AGPL on the server. Run it yourself or use ours."
		}
	];
</script>

<svelte:head>
	<title>{title} · GlyphTeX</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main id="main" class="font-public bg-canvas grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
	<section class="flex min-h-dvh flex-col px-6 py-8 sm:px-10">
		<a href={resolve('/workspace')} class="self-start" aria-label="GlyphTeX projects">
			<Logo size={20} badge class="text-sm font-semibold" />
		</a>

		<div class="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-6">
			<header class="flex flex-col gap-2">
				<h1 class="display text-foreground text-4xl">{title}</h1>
				{#if description}
					<p class="text-muted-foreground text-base text-pretty">{description}</p>
				{/if}
			</header>
			{@render children()}
			{#if footer}<div class="flex flex-wrap items-center gap-2">{@render footer()}</div>{/if}
		</div>

		<nav class="text-muted-foreground flex gap-4 text-xs" aria-label="Legal and help">
			<a class="hover:text-foreground" href={resolve('/privacy')}>Privacy</a>
			<a class="hover:text-foreground" href={resolve('/docs')}>Docs</a>
			<a class="hover:text-foreground" href={resolve('/')}>glyphtex.com</a>
		</nav>
	</section>

	<aside
		class="bg-tint relative m-3 hidden overflow-hidden rounded-3xl lg:flex lg:flex-col lg:justify-end"
		aria-label="About GlyphTeX"
	>
		<DotField seed={17} cols={34} rows={30} class="absolute -top-6 -right-8 w-[34rem] max-w-none" />
		<div class="relative flex flex-col gap-8 p-10 xl:p-14">
			<h2 class="display text-foreground max-w-md text-4xl">Write the paper. Own the files.</h2>
			<ul class="flex max-w-md flex-col gap-5">
				{#each points as point (point.title)}
					{@const Icon = point.icon}
					<li class="flex gap-3">
						<span class="bg-background grid size-9 shrink-0 place-items-center rounded-lg">
							<Icon class="size-5" />
						</span>
						<div class="text-sm">
							<p class="text-foreground font-medium">{point.title}</p>
							<p class="text-muted-foreground text-pretty">{point.text}</p>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	</aside>
</main>
