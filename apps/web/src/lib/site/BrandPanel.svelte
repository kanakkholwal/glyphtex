<script lang="ts">
	import { revealOnScroll, staggerDelay } from "$lib/motion";
	import { cn } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";

	// Text stays a large headline or centred body copy, away from the panel's light streaks.
	let {
		title,
		body,
		icon,
		actions,
		size = "default",
		class: className
	}: {
		title: string;
		body?: string;
		icon?: Snippet;
		actions?: Snippet;
		/** `hero` is the landing's closing CTA scale. */
		size?: "default" | "hero";
		class?: string;
	} = $props();
</script>

<section
	class={cn(
		'panel-brand relative w-full overflow-hidden rounded-3xl px-6',
		size === 'hero' ? 'py-20 sm:py-24' : 'py-16 sm:py-20',
		className
	)}
>
	<div class="relative mx-auto flex max-w-4xl flex-col items-center text-center">
		{#if icon}
			<span
				class="reveal mb-4 grid size-20 rotate-2 place-items-center rounded-3xl bg-fixed-light text-brand-panel shadow-lg"
				{@attach revealOnScroll}
			>
				{@render icon()}
			</span>
		{/if}
		<h2
			class={cn(
				'reveal text-balance font-medium text-fixed-light',
				size === 'hero'
					? 'text-heading sm:text-heading-lg md:text-display lg:text-display-xl'
					: 'text-heading sm:text-heading-lg md:text-display'
			)}
			style={staggerDelay(1)}
			{@attach revealOnScroll}
		>
			{title}
		</h2>
		{#if body}
			<p
				class="reveal mt-4 max-w-md text-pretty text-body text-fixed-light/85 md:text-body-lg"
				style={staggerDelay(2)}
				{@attach revealOnScroll}
			>
				{body}
			</p>
		{/if}
		{#if actions}
			<div
				class="reveal mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
				style={staggerDelay(3)}
				{@attach revealOnScroll}
			>
				{@render actions()}
			</div>
		{/if}
	</div>
</section>
