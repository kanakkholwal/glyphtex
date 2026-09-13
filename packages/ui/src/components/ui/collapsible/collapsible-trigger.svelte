<script lang="ts">
	import { CRAFT_FOCUS_RING, cn } from "@glyphtex/ui/utils";
	import { Collapsible as CollapsiblePrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: CollapsiblePrimitive.TriggerProps = $props();
</script>

<CollapsiblePrimitive.Trigger
	bind:ref
	data-slot="collapsible-trigger"
	class={cn(
		CRAFT_FOCUS_RING, 'rounded-md',
		className
	)}
	{...restProps}
/>
