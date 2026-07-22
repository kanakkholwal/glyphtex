<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import { Dialog as SheetPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: SheetPrimitive.TitleProps = $props();
</script>

<SheetPrimitive.Title
	bind:ref
	data-slot="sheet-title"
	class={cn("font-heading text-foreground text-base font-medium", className)}
	{...restProps}
/>
