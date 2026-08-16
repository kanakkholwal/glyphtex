<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import { Collapsible as CollapsiblePrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		open = $bindable(false),
		class: className,
		...restProps
	}: CollapsiblePrimitive.RootProps = $props();
</script>

<CollapsiblePrimitive.Root
	bind:ref
	bind:open
	data-slot="collapsible"
	class={cn(className)}
	{...restProps}
/>
