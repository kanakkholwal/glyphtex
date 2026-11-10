<script lang="ts">
	import { resolve } from "$app/paths";
	import { Button } from "@glyphtex/ui/button";
	import { Logo } from "@glyphtex/ui/logo";
	import { Eyebrow } from "$lib/site";
	import { IconBook, IconHome } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		/** Brace label above the title, e.g. `{account}`. */
		eyebrow?: string;
		description?: string;
		children: Snippet;
		/** Muted bar under the card for secondary navigation (Back, Skip). */
		footer?: Snippet;
	}

	let { title, eyebrow, description, children, footer }: Props = $props();
</script>

<svelte:head>
	<title>{title} · GlyphTeX</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main id="main" class="bg-canvas flex min-h-dvh flex-col items-center px-4 py-10 sm:py-16">
	<div class="flex w-full max-w-lg flex-col gap-6">
		<a href={resolve('/workspace')} class="self-start" aria-label="GlyphTeX projects">
			<Logo size={20} badge class="text-sm font-semibold" />
		</a>
		<header class="flex flex-col gap-1">
			{#if eyebrow}<Eyebrow label={eyebrow} />{/if}
			<h1 class="pixel text-foreground text-2xl md:text-4xl">{title}</h1>
			{#if description}<p class="text-muted-foreground text-sm">{description}</p>{/if}
		</header>
		<div class="bg-muted rounded-2xl p-1">
			<div class="border-border bg-background flex flex-col gap-5 rounded-xl border p-6 shadow-(--surface-shadow)">
				{@render children()}
			</div>
			<div class="flex flex-wrap items-center gap-2 px-2 py-2">
				{#if footer}{@render footer()}{/if}
				<span class="ml-auto flex items-center gap-1">
					<Button variant="ghost" size="sm" href={resolve('/')}><IconHome /> Home</Button>
					<Button variant="ghost" size="sm" href={resolve('/docs')}><IconBook /> Docs</Button>
				</span>
			</div>
		</div>
	</div>
</main>
