<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from "bits-ui";
	import { CRAFT_FOCUS_RING, cn, type WithoutChildrenOrChild } from "@glyphtex/ui/utils";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithoutChildrenOrChild<RadioGroupPrimitive.ItemProps> = $props();
</script>

<RadioGroupPrimitive.Item
	bind:ref
	data-slot="radio-group-item"
	class={cn(
		CRAFT_FOCUS_RING,
		'border-placeholder data-[state=checked]:bg-primary data-[state=checked]:border-primary aria-invalid:border-destructive flex size-4 rounded-full group/radio-group-item peer relative aspect-square shrink-0 border after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{...restProps}
>
	{#snippet children({ checked })}
		<div data-slot="radio-group-indicator" class="flex size-4 items-center justify-center">
			{#if checked}
				<span
					class="bg-primary-foreground absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
				></span>
			{/if}
		</div>
	{/snippet}
</RadioGroupPrimitive.Item>
