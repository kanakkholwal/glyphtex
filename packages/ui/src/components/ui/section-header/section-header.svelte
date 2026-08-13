<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "@glyphtex/ui/utils";

	/**
	 * The one section-heading treatment for the marketing pages. Sizes come from
	 * `.landing-section-title`; nothing should hand-roll `text-3xl sm:text-4xl…`
	 * again. `emphasis` renders the second-line voice run.
	 */
	type Props = {
		eyebrow?: string;
		title: string;
		/** Second line, set in the display-serif voice. No faux italic. */
		emphasis?: string;
		description?: string;
		align?: "left" | "center";
		/** Heading level. The page owns the outline; this component follows it. */
		as?: "h2" | "h3";
		class?: string;
		actions?: Snippet;
	};

	let {
		eyebrow,
		title,
		emphasis,
		description,
		align = "left",
		as: Tag = "h2",
		class: className,
		actions,
	}: Props = $props();
</script>

<div
	data-slot="section-header"
	class={cn(
		"flex flex-col gap-5",
		align === "center" && "items-center text-center mx-auto max-w-3xl",
		className,
	)}
>
	{#if eyebrow}
		<span class="landing-eyebrow">{eyebrow}</span>
	{/if}

	<svelte:element this={Tag} class="landing-section-title">
		{title}
		{#if emphasis}
			<span class="landing-title-em">{emphasis}</span>
		{/if}
	</svelte:element>

	{#if description}
		<p
			class={cn(
				"landing-text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg",
				align === "center" ? "max-w-xl" : "max-w-2xl",
			)}
		>
			{description}
		</p>
	{/if}

	{#if actions}
		<div class={cn("mt-2 flex flex-wrap gap-3", align === "center" && "justify-center")}>
			{@render actions()}
		</div>
	{/if}
</div>
