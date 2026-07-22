<script lang="ts">
	import { Menubar as MenubarPrimitive } from "bits-ui";
	import { IconCheck } from '@tabler/icons-svelte';
	import { cn, type WithoutChildrenOrChild } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";

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
		"data-highlighted:bg-foreground/10 data-highlighted:text-accent-foreground text-foreground relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-7 text-[13px] outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		className,
	)}
	{...restProps}
>
	{#snippet children({ checked })}
		<span class="pointer-events-none absolute left-2 flex items-center justify-center">
			{#if checked}
				<IconCheck class="text-brand size-3.5" />
			{/if}
		</span>
		{@render childrenProp?.()}
	{/snippet}
</MenubarPrimitive.CheckboxItem>
