<script lang="ts">
	import { Switch as SwitchPrimitive } from "bits-ui";
	import { CRAFT_FOCUS_RING, cn, type WithoutChildrenOrChild } from "@glyphtex/ui/utils";

	// The off track is `--placeholder`, not the hairline, so its boundary clears 3:1.
	let {
		ref = $bindable(null),
		checked = $bindable(false),
		class: className,
		...restProps
	}: WithoutChildrenOrChild<SwitchPrimitive.RootProps> = $props();
</script>

<SwitchPrimitive.Root
	bind:ref
	bind:checked
	data-slot="switch"
	class={cn(
		CRAFT_FOCUS_RING,
		'peer bg-placeholder data-[state=checked]:bg-primary relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full transition-colors',
		'disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{...restProps}
>
	<SwitchPrimitive.Thumb
		data-slot="switch-thumb"
		class={cn(
			'pointer-events-none block size-3.5 translate-x-[2px] rounded-full bg-fixed-light shadow-xs transition-transform duration-200 ease-craft',
			'data-[state=checked]:translate-x-[16px]'
		)}
	/>
</SwitchPrimitive.Root>
