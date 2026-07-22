<script lang="ts">
	import { Menubar as MenubarPrimitive } from "bits-ui";
	import { cn } from "@glyphtex/ui/utils";

	let {
		ref = $bindable(null),
		class: className,
		inset,
		...restProps
	}: MenubarPrimitive.ItemProps & { inset?: boolean } = $props();
</script>

<MenubarPrimitive.Item
	bind:ref
	data-slot="menubar-item"
	data-inset={inset}
	class={cn(
		"data-highlighted:bg-foreground/10 data-highlighted:text-accent-foreground text-foreground relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-40 data-inset:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		className,
	)}
	{...restProps}
/>
