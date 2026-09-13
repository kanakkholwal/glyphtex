<script lang="ts">
	import { Checkbox as CheckboxPrimitive } from "bits-ui";
	import { CRAFT_FOCUS_RING, cn, type WithoutChildrenOrChild } from "@glyphtex/ui/utils";
	import { IconCheck, IconMinus } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		indeterminate = $bindable(false),
		class: className,
		...restProps
	}: WithoutChildrenOrChild<CheckboxPrimitive.RootProps> = $props();
</script>

<CheckboxPrimitive.Root
	bind:ref
	data-slot="checkbox"
	class={cn(
		CRAFT_FOCUS_RING,
		'border-placeholder data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary aria-invalid:border-destructive flex size-4 items-center justify-center rounded-[4px] border transition-colors group-has-disabled/field:opacity-50 peer relative shrink-0 after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	bind:checked
	bind:indeterminate
	{...restProps}
>
	{#snippet children({ checked, indeterminate })}
		<div
			data-slot="checkbox-indicator"
			class="[&>svg]:size-3.5 grid place-content-center text-current transition-none"
		>
			{#if checked}
				<IconCheck />
			{:else if indeterminate}
				<IconMinus />
			{/if}
		</div>
	{/snippet}
</CheckboxPrimitive.Root>
