<script lang="ts">
	import {
		CRAFT_FOCUS_RING,
		cn,
		type WithElementRef,
		type WithoutChildren
	} from "@glyphtex/ui/utils";
	import type { HTMLTextareaAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		"data-slot": dataSlot = "textarea",
		...restProps
	}: WithoutChildren<WithElementRef<HTMLTextareaAttributes>> = $props();
</script>

<textarea
	bind:this={ref}
	data-slot={dataSlot}
	class={cn(
		CRAFT_FOCUS_RING,
		'border-border bg-background focus-visible:border-ring aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive disabled:bg-muted rounded-md border px-2.5 py-2 text-base transition-colors md:text-sm placeholder:text-placeholder flex field-sizing-content min-h-16 w-full disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	bind:value
	{...restProps}
></textarea>
