<script lang="ts">
	import { Menubar as MenubarPrimitive } from "bits-ui";
	import { CRAFT_OVERLAY_ANIMATION, cn } from "@glyphtex/ui/utils";

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
			// Unfold from the corner nearest the trigger (macOS-menu feel).
			"origin-(--bits-floating-transform-origin)",
			"ring-foreground/10 text-popover-foreground bg-popover/70 relative z-50 min-w-48 overflow-hidden rounded-xl p-1 shadow-md ring-1 outline-none before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150",
			className,
		)}
		{...restProps}
	/>
</MenubarPrimitive.Portal>
