<script lang="ts">
	import {
		CRAFT_OVERLAY_ANIMATION,
		CRAFT_OVERLAY_SURFACE,
		cn,
		type WithoutChildrenOrChild
	} from "@glyphtex/ui/utils";
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
	import type { ComponentProps } from "svelte";
	import DropdownMenuPortal from "./dropdown-menu-portal.svelte";

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		...restProps
	}: DropdownMenuPrimitive.SubContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>;
	} = $props();
</script>

<!-- Portalled: inside the scrolling root Content a side-opening submenu gets clipped.
     Floating UI anchors it to the SubTrigger wherever it sits in the DOM. -->
<DropdownMenuPortal {...portalProps}>
	<DropdownMenuPrimitive.SubContent
		bind:ref
		data-slot="dropdown-menu-sub-content"
		class={cn(
			CRAFT_OVERLAY_ANIMATION,
			CRAFT_OVERLAY_SURFACE,
			'origin-(--bits-floating-transform-origin) z-50 min-w-24 w-auto p-1',
			className
		)}
		{...restProps}
	/>
</DropdownMenuPortal>
