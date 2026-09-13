<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import { Tabs as TabsPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: TabsPrimitive.ContentProps = $props();
</script>

<!-- CSS on `data-state`, not `transition:`: bits-ui renders panels as siblings, so `out:` never fires. -->
<TabsPrimitive.Content
	bind:ref
	data-slot="tabs-content"
	class={cn(
		'text-sm flex-1 outline-none',
		'data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-200 data-[state=active]:ease-craft',
		className
	)}
	{...restProps}
/>
