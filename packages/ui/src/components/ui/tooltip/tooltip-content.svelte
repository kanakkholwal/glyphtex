<script lang="ts">
	import type { WithoutChildrenOrChild } from "@glyphtex/ui/utils";
	import { CRAFT_OVERLAY_ANIMATION, cn } from "@glyphtex/ui/utils";
	import { Tooltip as TooltipPrimitive } from "bits-ui";
	import type { ComponentProps } from "svelte";
	import TooltipPortal from "./tooltip-portal.svelte";

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 0,
		side = "top",
		children,
		arrowClasses,
		portalProps,
		...restProps
	}: TooltipPrimitive.ContentProps & {
		arrowClasses?: string;
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof TooltipPortal>>;
	} = $props();
</script>

<TooltipPortal {...portalProps}>
	<TooltipPrimitive.Content
		bind:ref
		data-slot="tooltip-content"
		{sideOffset}
		{side}
		class={cn(
			CRAFT_OVERLAY_ANIMATION,
			'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-[0.98]',
			// Rounded-lg, not the overlay xl: at 28px tall a 14px radius reads as a pill.
			'bg-popover text-popover-foreground border border-border shadow-lg rounded-lg',
			'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm z-50 w-fit max-w-xs origin-(--bits-tooltip-content-transform-origin)',
			className
		)}
		{...restProps}
	>
		{@render children?.()}
		<TooltipPrimitive.Arrow>
			{#snippet child({ props })}
				<div
					class={cn(
						'size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-popover border-border z-50',
						'data-[side=top]:translate-x-1/2 data-[side=top]:translate-y-[calc(-50%+2px)] data-[side=top]:border-r data-[side=top]:border-b',
						'data-[side=bottom]:-translate-x-1/2 data-[side=bottom]:-translate-y-[calc(-50%+1px)] data-[side=bottom]:border-l data-[side=bottom]:border-t',
						'data-[side=right]:translate-x-[calc(50%+2px)] data-[side=right]:translate-y-1/2 data-[side=right]:border-b data-[side=right]:border-l',
						'data-[side=left]:-translate-y-[calc(50%-3px)] data-[side=left]:border-t data-[side=left]:border-r',
						arrowClasses
					)}
					{...props}
				></div>
			{/snippet}
		</TooltipPrimitive.Arrow>
	</TooltipPrimitive.Content>
</TooltipPortal>
