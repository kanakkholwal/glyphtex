<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
	import {
		DROPDOWN_MENU_ROW,
		dropdownMenuItemSizeVariants,
		getDropdownMenuSize,
		type DropdownMenuSize
	} from "./context";

	let {
		ref = $bindable(null),
		class: className,
		inset,
		size,
		variant = "default",
		...restProps
	}: DropdownMenuPrimitive.ItemProps & {
		inset?: boolean;
		size?: DropdownMenuSize;
		variant?: "default" | "destructive";
	} = $props();

	const contentSize = getDropdownMenuSize();
	const resolvedSize = $derived(size ?? contentSize());
</script>

<DropdownMenuPrimitive.Item
	bind:ref
	data-slot="dropdown-menu-item"
	data-inset={inset}
	data-variant={variant}
	class={cn(
		DROPDOWN_MENU_ROW,
		dropdownMenuItemSizeVariants({ size: resolvedSize }),
		'group/dropdown-menu-item data-inset:pl-8',
		'data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive data-[variant=destructive]:[&_svg]:text-destructive!',
		className
	)}
	{...restProps}
/>
