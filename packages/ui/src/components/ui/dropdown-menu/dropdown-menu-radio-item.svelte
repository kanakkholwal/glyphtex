<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
	import { IconCheck } from "@tabler/icons-svelte";
	import { cn, type WithoutChild } from "@glyphtex/ui/utils";
	import { DROPDOWN_MENU_ROW, dropdownMenuItemSizeVariants, getDropdownMenuSize } from "./context";

	let {
		ref = $bindable(null),
		class: className,
		children: childrenProp,
		...restProps
	}: WithoutChild<DropdownMenuPrimitive.RadioItemProps> = $props();

	const contentSize = getDropdownMenuSize();
</script>

<DropdownMenuPrimitive.RadioItem
	bind:ref
	data-slot="dropdown-menu-radio-item"
	class={cn(
		DROPDOWN_MENU_ROW,
		dropdownMenuItemSizeVariants({ size: contentSize() }),
		'pr-8 data-inset:pl-8',
		className
	)}
	{...restProps}
>
	{#snippet children({ checked })}
		<span
			class="absolute right-2 flex items-center justify-center pointer-events-none"
			data-slot="dropdown-menu-radio-item-indicator"
		>
			{#if checked}
				<IconCheck class="text-primary" />
			{/if}
		</span>
		{@render childrenProp?.({ checked })}
	{/snippet}
</DropdownMenuPrimitive.RadioItem>
