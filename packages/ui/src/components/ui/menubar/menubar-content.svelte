<script lang="ts">
	import { Menubar as MenubarPrimitive } from "bits-ui";
	import { CRAFT_OVERLAY_ANIMATION, CRAFT_OVERLAY_SURFACE, cn } from "@glyphtex/ui/utils";

	let {
		ref = $bindable(null),
		class: className,
		align = "start",
		sideOffset = 6,
		alignOffset = -2,
		...restProps
	}: MenubarPrimitive.ContentProps = $props();
</script>

<MenubarPrimitive.Portal>
	<MenubarPrimitive.Content
		bind:ref
		data-slot="menubar-content"
		{align}
		{sideOffset}
		{alignOffset}
		class={cn(
			CRAFT_OVERLAY_ANIMATION,
			CRAFT_OVERLAY_SURFACE,
			// Unfold from the corner nearest the trigger.
			'origin-(--bits-floating-transform-origin)',
			'relative z-50 min-w-48 overflow-hidden p-1 outline-none',
			className
		)}
		{...restProps}
	/>
</MenubarPrimitive.Portal>
