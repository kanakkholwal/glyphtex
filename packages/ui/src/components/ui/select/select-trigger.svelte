<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { CRAFT_FOCUS_RING, cn, type WithoutChild } from "@glyphtex/ui/utils";
	import { IconSelector } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		class: className,
		children,
		size = "default",
		...restProps
	}: WithoutChild<SelectPrimitive.TriggerProps> & {
		size?: "sm" | "default";
	} = $props();
</script>

<SelectPrimitive.Trigger
	bind:ref
	data-slot="select-trigger"
	data-size={size}
	class={cn(
		CRAFT_FOCUS_RING,
		"border-border bg-background data-placeholder:text-placeholder hover:bg-muted data-[state=open]:border-ring focus-visible:border-ring aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive gap-1.5 rounded-md border py-2 pr-2 pl-2.5 text-sm transition-colors select-none data-[size=default]:h-8 data-[size=sm]:h-7 *:data-[slot=select-value]:flex *:data-[slot=select-value]:gap-1.5 [&_svg:not([class*='size-'])]:size-4 flex w-fit items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
		className
	)}
	{...restProps}
>
	{@render children?.()}
	<IconSelector class="text-muted-foreground size-4 pointer-events-none" />
</SelectPrimitive.Trigger>
