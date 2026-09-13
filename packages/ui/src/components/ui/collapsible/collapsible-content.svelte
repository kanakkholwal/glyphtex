<script lang="ts">
	import { Collapsible as CollapsiblePrimitive } from "bits-ui";
	import { cn } from "@glyphtex/ui/utils";
	import { cubicOut } from "svelte/easing";
	import { prefersReducedMotion } from "svelte/motion";
	import { slide } from "svelte/transition";

	// `hiddenUntilFound` must be off: it overrides `forceMount`, which keeps the `child`
	// snippet alive so `{#if open}` owns the slide. Svelte `slide` bypasses the CSS motion guard.
	let {
		ref = $bindable(null),
		class: className,
		duration = 240,
		easing = cubicOut,
		children,
		...restProps
	}: CollapsiblePrimitive.ContentProps & {
		duration?: number;
		easing?: (t: number) => number;
	} = $props();
</script>

<CollapsiblePrimitive.Content
	bind:ref
	forceMount
	hiddenUntilFound={false}
	data-slot="collapsible-content"
	{...restProps}
>
	{#snippet child({ props, open })}
		{#if open}
			<div
				{...props}
				transition:slide={{
					duration: prefersReducedMotion.current ? 0 : duration,
					easing,
					axis: 'y'
				}}
				class={cn('overflow-hidden', className)}
			>
				{@render children?.()}
			</div>
		{/if}
	{/snippet}
</CollapsiblePrimitive.Content>
