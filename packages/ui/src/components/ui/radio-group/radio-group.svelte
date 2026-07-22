<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import { RadioGroup as RadioGroupPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		value = $bindable(""),
		...restProps
	}: RadioGroupPrimitive.RootProps = $props();
</script>

<RadioGroupPrimitive.Root
	bind:ref
	bind:value
	data-slot="radio-group"
	class={cn("grid gap-2 w-full", className)}
	{...restProps}
/>
