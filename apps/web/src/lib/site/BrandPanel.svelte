<script lang="ts">
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
				class="mb-4 grid size-20 rotate-2 place-items-center rounded-3xl bg-fixed-light text-brand-panel shadow-lg"
			>
				{@render icon()}
			</span>
		{/if}
		<h2
			class={cn(
				'text-balance font-medium text-fixed-light',
				size === 'hero'
					? 'text-heading sm:text-heading-lg md:text-display lg:text-display-xl'
					: 'text-heading sm:text-heading-lg md:text-display'
			)}
		>
			{title}
		</h2>
		{#if body}
			<p class="mt-4 max-w-md text-pretty text-body text-fixed-light/85 md:text-body-lg">{body}</p>
		{/if}
		{#if actions}
			<div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
				{@render actions()}
			</div>
		{/if}
	</div>
</section>
