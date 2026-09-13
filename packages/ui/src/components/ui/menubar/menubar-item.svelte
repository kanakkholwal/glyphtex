<script lang="ts">
	import { Menubar as MenubarPrimitive } from "bits-ui";
	import { cn } from "@glyphtex/ui/utils";
	import { DROPDOWN_MENU_ROW } from "../dropdown-menu/context";

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
		DROPDOWN_MENU_ROW,
		"min-h-8 gap-2 px-2 py-1 text-sm text-foreground data-inset:pl-8 [&_svg:not([class*='size-'])]:size-4",
		className
	)}
	{...restProps}
/>
