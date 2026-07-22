<script lang="ts">
	import { CRAFT_OVERLAY_BACKDROP_ANIMATION, cn } from "@glyphtex/ui/utils";
	import { Drawer as DrawerPrimitive } from "vaul-svelte";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DrawerPrimitive.OverlayProps = $props();
</script>

<DrawerPrimitive.Overlay
	bind:ref
	data-slot="drawer-overlay"
	class={cn(CRAFT_OVERLAY_BACKDROP_ANIMATION, "bg-black/10 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50", className)}
	{...restProps}
/>
