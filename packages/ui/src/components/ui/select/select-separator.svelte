<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import type { Separator as SeparatorPrimitive } from "bits-ui";
	import { Separator } from "../separator";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: SeparatorPrimitive.RootProps = $props();
</script>

<Separator
	bind:ref
	data-slot="select-separator"
	class={cn("bg-border -mx-1 my-1 h-px pointer-events-none", className)}
	{...restProps}
/>
