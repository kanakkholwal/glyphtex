<script lang="ts">
	import {
		CRAFT_OVERLAY_ANIMATION,
		CRAFT_OVERLAY_SURFACE,
		cn,
		type WithoutChildrenOrChild
	} from "@glyphtex/ui/utils";
	import { Popover as PopoverPrimitive } from "bits-ui";
	import type { ComponentProps } from "svelte";

	type PortalProps = WithoutChildrenOrChild<ComponentProps<typeof PopoverPrimitive.Portal>>;

	let {
		ref = $bindable(null),
		class: className,
		align = "center",
		sideOffset = 6,
		portalProps,
		preventScroll = false,
		...restProps
	}: PopoverPrimitive.ContentProps & {
		portalProps?: PortalProps;
	} = $props();
</script>

<PopoverPrimitive.Portal {...portalProps}>
	<PopoverPrimitive.Content
		bind:ref
		data-slot="popover-content"
		{align}
		{sideOffset}
		{preventScroll}
		class={cn(
			CRAFT_OVERLAY_ANIMATION,
			CRAFT_OVERLAY_SURFACE,
			'z-50 w-72 origin-(--bits-floating-transform-origin) p-4 outline-none',
			className
		)}
		{...restProps}
	/>
</PopoverPrimitive.Portal>
