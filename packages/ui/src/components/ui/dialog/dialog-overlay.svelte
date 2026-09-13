<script lang="ts">
	import { CRAFT_OVERLAY_BACKDROP_ANIMATION, CRAFT_SCRIM, cn } from "@glyphtex/ui/utils";
	import { Dialog as DialogPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DialogPrimitive.OverlayProps = $props();
</script>

<DialogPrimitive.Overlay
	bind:ref
	data-slot="dialog-overlay"
	class={cn(
		CRAFT_OVERLAY_BACKDROP_ANIMATION,
		CRAFT_SCRIM,
		'fixed inset-0 isolate z-50',
		className
	)}
	{...restProps}
/>
