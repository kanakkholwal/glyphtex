<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import LocalCompile from "$lib/illustrations/LocalCompile.svelte";
	import { REPO_URL } from "$lib/landing/nav-data";
	import { revealOnScroll, staggerDelay } from "$lib/motion";
	import { CountUp, TiltedChip } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { Skeleton } from "@glyphtex/ui/skeleton";
	import { IconArrowRight, IconBrandGithub } from "@tabler/icons-svelte";

	let {
		counts,
		stars
	}: {
		counts: { commands: number; packages: number; guides: number };
		stars: Promise<number | null>;
	} = $props();

	// Floors to a round number so the "+" is true; the exact count moves as data is added.
	const floorTo = (n: number, step: number) => Math.floor(n / step) * step;
</script>

{#snippet stat(label: string, value: number, suffix = "")}
	<div class="flex flex-col gap-0.5">
		<dt class="order-2 text-caption text-muted-foreground">{label}</dt>
		<dd class="order-1 font-display text-heading-sm font-medium tabular-nums text-foreground">
			<CountUp {value} {suffix} />
		</dd>
	</div>
{/snippet}

<div class="grid min-h-[60vh] grid-cols-1 gap-10 lg:min-h-[calc(100svh-14rem)] lg:grid-cols-2 lg:gap-6">
	<div class="flex h-full flex-col justify-center py-8 lg:py-0">
		<div class="reveal" {@attach revealOnScroll}>
			<TiltedChip>
				<span class="text-primary">Free</span> and open source, GPLv3
			</TiltedChip>
		</div>

		<h1
			class="reveal mt-4 text-heading-sm font-medium text-foreground sm:text-heading-lg md:text-display lg:text-display-xl"
			style={staggerDelay(1)}
			{@attach revealOnScroll}
		>
			Write <span class="text-primary">LaTeX</span>
			<br />
			<span class="text-primary">on your machine</span>
		</h1>

		<p
			class="reveal mt-4 max-w-lg text-pretty text-body text-muted-foreground md:text-body-lg"
			style={staggerDelay(2)}
			{@attach revealOnScroll}
		>
			A LaTeX editor that compiles in your browser tab. Your projects stay on your device, keep
			working offline, and carry their full history in Git. No account.
		</p>

		<div class="reveal mt-8 flex flex-wrap gap-2 sm:gap-4" style={staggerDelay(3)} {@attach revealOnScroll}>
			<Button
				href={resolve('/workspace')}
				variant="primary"
				onclick={() => track('cta_clicked', { target: 'workspace', location: 'hero' })}
			>
				Open the workspace
				<IconArrowRight />
			</Button>
			<Button
				href={REPO_URL}
				target="_blank"
				rel="noopener noreferrer"
				onclick={() => track('outbound_clicked', { destination: 'github', location: 'hero' })}
			>
				Star on GitHub
				<IconBrandGithub />
			</Button>
		</div>

		<dl
			class="reveal mt-10 grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-6 sm:grid-cols-4"
			style={staggerDelay(4)}
			{@attach revealOnScroll}
		>
			{#await stars}
				<div class="flex flex-col gap-0.5">
					<Skeleton class="h-8 w-16" />
					<span class="text-caption text-muted-foreground">GitHub stars</span>
				</div>
			{:then value}
				{#if value !== null}
					{@render stat('GitHub stars', value)}
				{/if}
			{/await}
			{@render stat('LaTeX commands documented', floorTo(counts.commands, 50), '+')}
			{@render stat('Packages it completes', counts.packages)}
			{@render stat('Guides and articles', counts.guides)}
		</dl>
	</div>

	<div
		class="reveal flex min-h-0 items-center justify-center pb-8 lg:py-12"
		style={staggerDelay(1)}
		{@attach revealOnScroll}
	>
		<LocalCompile class="max-h-[min(34rem,calc(100svh-14rem))] max-w-xl" />
	</div>
</div>
