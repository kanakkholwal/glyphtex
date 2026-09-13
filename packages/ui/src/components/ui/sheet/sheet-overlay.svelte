<script lang="ts">
	import { CRAFT_OVERLAY_BACKDROP_ANIMATION, CRAFT_SCRIM, cn } from "@glyphtex/ui/utils";
	import { Dialog as SheetPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: SheetPrimitive.OverlayProps = $props();
</script>

<SheetPrimitive.Overlay
	bind:ref
	data-slot="sheet-overlay"
	class={cn(CRAFT_OVERLAY_BACKDROP_ANIMATION, CRAFT_SCRIM, 'fixed inset-0 z-50', className)}
	{...restProps}
/>
