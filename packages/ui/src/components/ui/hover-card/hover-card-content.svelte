<script lang="ts">
	import {
		CRAFT_OVERLAY_ANIMATION,
		CRAFT_OVERLAY_SURFACE,
		cn,
		type WithoutChildrenOrChild
	} from "@glyphtex/ui/utils";
	import { LinkPreview as HoverCardPrimitive } from "bits-ui";
	import type { ComponentProps } from "svelte";
	import HoverCardPortal from "./hover-card-portal.svelte";

	let {
		ref = $bindable(null),
		class: className,
		align = "center",
		sideOffset = 4,
		portalProps,
		...restProps
	}: HoverCardPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof HoverCardPortal>>;
	} = $props();
</script>

<HoverCardPortal {...portalProps}>
	<HoverCardPrimitive.Content
		bind:ref
		data-slot="hover-card-content"
		{align}
		{sideOffset}
		class={cn(
			CRAFT_OVERLAY_ANIMATION,
			CRAFT_OVERLAY_SURFACE,
			'z-50 w-64 origin-(--bits-floating-transform-origin) p-4 text-sm outline-hidden',
			className
		)}
		{...restProps}
	/>
</HoverCardPortal>
