<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
	import { IconCheck, IconMinus } from "@tabler/icons-svelte";
	import { cn, type WithoutChildrenOrChild } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";
	import { DROPDOWN_MENU_ROW, dropdownMenuItemSizeVariants, getDropdownMenuSize } from "./context";

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		indeterminate = $bindable(false),
		class: className,
		children: childrenProp,
		...restProps
	}: WithoutChildrenOrChild<DropdownMenuPrimitive.CheckboxItemProps> & {
		children?: Snippet;
	} = $props();

	const contentSize = getDropdownMenuSize();
</script>

<DropdownMenuPrimitive.CheckboxItem
	bind:ref
	bind:checked
	bind:indeterminate
	data-slot="dropdown-menu-checkbox-item"
	class={cn(
		DROPDOWN_MENU_ROW,
		dropdownMenuItemSizeVariants({ size: contentSize() }),
		'pr-8 data-inset:pl-8',
		className
	)}
	{...restProps}
>
	{#snippet children({ checked, indeterminate })}
		<span
			class="absolute right-2 flex items-center justify-center pointer-events-none"
			data-slot="dropdown-menu-checkbox-item-indicator"
		>
			{#if indeterminate}
				<IconMinus class="text-primary" />
			{:else if checked}
				<IconCheck class="text-primary" />
			{/if}
		</span>
		{@render childrenProp?.()}
	{/snippet}
</DropdownMenuPrimitive.CheckboxItem>
