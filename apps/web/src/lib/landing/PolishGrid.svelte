<script lang="ts">
	import { Reveal } from '@glyphtex/ui/reveal';
	import { cn } from '@glyphtex/ui/utils';

	// Step 2's auto-polish grid. A soft "Applied" highlight ticks through the
	// cards one at a time so the section reads as features being applied live,
	// without competing with the rest of the page motion. Pauses on hidden
	// tabs; reduced-motion visitors get the static grid.

	type Feature = {
		icon: typeof import('@tabler/icons-svelte').IconBolt;
		title: string;
		description: string;
	};

	type Props = {
		features: Feature[];
	};

	let { features }: Props = $props();

	// Reduced-motion: skip the cycle entirely (no tick, no live highlight).
	const reducedMotion =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	let applied = $state(reducedMotion ? -1 : 0);

	$effect(() => {
		if (reducedMotion) return;
		const id = setInterval(() => {
			if (document.hidden) return;
			applied = (applied + 1) % features.length;
		}, 2200);
		return () => clearInterval(id);
	});
</script>

<div class="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
	{#each features as feature, i (feature.title)}
		{const Icon = feature.icon}
		{const isApplied = i === applied}
		<Reveal variant="up" delay={i * 70} class="h-full">
			<div
				class={cn(
					'flex h-full flex-col gap-4 rounded-2xl border bg-background/90 p-7 backdrop-blur-md transition-[transform,box-shadow,background-color,border-color] duration-500 ease-out',
					isApplied
						? 'scale-[1.015] border-brand/30 bg-background shadow-craft-md'
						: 'border-hairline/40 shadow-craft-sm'
				)}
			>
				<div class="flex items-center justify-between">
					<Icon
						class={cn(
							'size-5 transition-colors duration-500',
							isApplied ? 'text-brand' : 'text-foreground/70'
						)}
					/>
					<span
						class={cn(
							'inline-flex items-center gap-1 rounded-full bg-success/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-success ring-1 ring-inset ring-success/25 transition-[opacity,transform] duration-500 ease-out',
							isApplied ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
						)}
					>
						<span class="text-success">✓</span>
						Applied
					</span>
				</div>
				<div>
					<div class="text-md font-semibold tracking-tight text-foreground">
						{feature.title}
					</div>
					<div class="mt-2 text-md leading-relaxed text-muted-foreground">
						{feature.description}
					</div>
				</div>
			</div>
		</Reveal>
	{/each}
</div>

<!--
  Live-cursor strip: dots mirror the cycling "applied" index. Reads as a
  progress readout without text, ignored under reduced motion.
-->
{#if !reducedMotion}
	<div aria-hidden="true" class="mt-6 flex items-center justify-center gap-1.5">
		{#each { length: features.length } as _, i (i)}
			<span
				class={cn(
					'size-1.5 rounded-full transition-[transform,background-color] duration-500 ease-out',
					i === applied ? 'scale-125 bg-brand' : 'bg-foreground/20'
				)}
			></span>
		{/each}
	</div>
{/if}
