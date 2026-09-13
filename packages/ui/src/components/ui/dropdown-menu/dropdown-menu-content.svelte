<script lang="ts">
	import {
		CRAFT_OVERLAY_ANIMATION,
		CRAFT_OVERLAY_SURFACE,
		cn,
		type WithoutChildrenOrChild
	} from "@glyphtex/ui/utils";
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
	import type { ComponentProps } from "svelte";
	import {
		dropdownMenuContentSizeVariants,
		setDropdownMenuSize,
		type DropdownMenuSize
	} from "./context";
	import DropdownMenuPortal from "./dropdown-menu-portal.svelte";

	let {
		ref = $bindable(null),
		sideOffset = 4,
		align = "start",
		size = "default",
		portalProps,
		class: className,
		preventScroll = false,
		...restProps
	}: DropdownMenuPrimitive.ContentProps & {
		size?: DropdownMenuSize;
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>;
	} = $props();

	setDropdownMenuSize(() => size);
</script>

<DropdownMenuPortal {...portalProps}>
	<DropdownMenuPrimitive.Content
		bind:ref
		data-slot="dropdown-menu-content"
		data-size={size}
		{sideOffset}
		{align}
		{preventScroll}
		class={cn(
			CRAFT_OVERLAY_ANIMATION,
			CRAFT_OVERLAY_SURFACE,
			// Unfold from the corner nearest the trigger instead of the centre.
			'origin-(--bits-floating-transform-origin)',
			'z-50 w-(--bits-dropdown-menu-anchor-width) max-h-(--bits-dropdown-menu-content-available-height) overflow-x-hidden overflow-y-auto outline-none data-[state=closed]:overflow-hidden',
			dropdownMenuContentSizeVariants({ size }),
			className
		)}
		{...restProps}
	/>
</DropdownMenuPortal>
