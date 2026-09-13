<script lang="ts">
	import { Menubar as MenubarPrimitive } from "bits-ui";
	import { IconCheck } from "@tabler/icons-svelte";
	import { cn, type WithoutChildrenOrChild } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";
	import { DROPDOWN_MENU_ROW } from "../dropdown-menu/context";

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		class: className,
		children: childrenProp,
		...restProps
	}: WithoutChildrenOrChild<MenubarPrimitive.CheckboxItemProps> & {
		children?: Snippet;
	} = $props();
</script>

<MenubarPrimitive.CheckboxItem
	bind:ref
	bind:checked
	data-slot="menubar-checkbox-item"
	class={cn(
		DROPDOWN_MENU_ROW,
		"min-h-8 gap-2 py-1 pr-2 pl-8 text-sm text-foreground [&_svg:not([class*='size-'])]:size-4",
		className
	)}
	{...restProps}
>
	{#snippet children({ checked })}
		<span class="pointer-events-none absolute left-2 flex items-center justify-center">
			{#if checked}
				<IconCheck class="text-primary size-4" />
			{/if}
		</span>
		{@render childrenProp?.()}
	{/snippet}
</MenubarPrimitive.CheckboxItem>
