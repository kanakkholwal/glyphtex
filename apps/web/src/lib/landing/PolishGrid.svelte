<script lang="ts">
	import { Reveal } from "@glyphtex/ui/reveal";

	// Step 2's capability grid. This used to cycle a highlight through the cards
	// on a 2.2s interval, which re-rasterised body text on a `scale(1.015)` every
	// tick and ran whether or not the section was on screen. The cards now state
	// their own case; motion is limited to the one-shot scroll reveal.

	type Feature = {
		icon: typeof import("@tabler/icons-svelte").IconBolt;
		title: string;
		description: string;
	};

	type Props = {
		features: Feature[];
	};

	let { features }: Props = $props();
</script>

<ul class="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
	{#each features as feature, i (feature.title)}
		{@const Icon = feature.icon}
		<Reveal as="li" variant="up" delay={i * 60} class="h-full">
			<div class="landing-card landing-card-hover flex h-full flex-col gap-4 rounded-2xl p-6">
				<span class="grid size-10 place-items-center rounded-xl bg-surface-strong text-foreground">
					<Icon class="size-5" stroke-width={1.75} />
				</span>
				<div>
					<h3 class="text-md font-semibold tracking-tight text-foreground">
						{feature.title}
					</h3>
					<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
						{feature.description}
					</p>
				</div>
			</div>
		</Reveal>
	{/each}
</ul>
