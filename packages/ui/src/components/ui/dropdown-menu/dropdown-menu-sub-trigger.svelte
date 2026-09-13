<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
	import { IconChevronRight } from "@tabler/icons-svelte";
	import { cn } from "@glyphtex/ui/utils";
	import { DROPDOWN_MENU_ROW, dropdownMenuItemSizeVariants, getDropdownMenuSize } from "./context";

	let {
		ref = $bindable(null),
		class: className,
		inset,
		children,
		...restProps
	}: DropdownMenuPrimitive.SubTriggerProps & {
		inset?: boolean;
	} = $props();

	const contentSize = getDropdownMenuSize();
</script>

<DropdownMenuPrimitive.SubTrigger
	bind:ref
	data-slot="dropdown-menu-sub-trigger"
	data-inset={inset}
	class={cn(
		DROPDOWN_MENU_ROW,
		dropdownMenuItemSizeVariants({ size: contentSize() }),
		'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-inset:pl-8',
		className
	)}
	{...restProps}
>
	{@render children?.()}
	<IconChevronRight class="ml-auto" />
</DropdownMenuPrimitive.SubTrigger>
