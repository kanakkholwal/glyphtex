<script lang="ts">
	import { Switch as SwitchPrimitive } from "bits-ui";
	import { cn, type WithoutChildrenOrChild } from "@glyphtex/ui/utils";

	/**
	 * Switch — a Mac-native toggle. The track turns emerald (`--brand`) when on —
	 * both the Apple green-switch convention and our brand's "active" signal — and
	 * the white knob slides on the shared easing. Use for binary settings instead
	 * of an On/Off button.
	 */
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
		"peer bg-border data-[state=checked]:bg-brand relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full outline-none transition-colors",
		"focus-visible:ring-ring/50 focus-visible:ring-[3px]",
		"disabled:cursor-not-allowed disabled:opacity-50",
		className,
	)}
	{...restProps}
>
	<SwitchPrimitive.Thumb
		data-slot="switch-thumb"
		class={cn(
			"pointer-events-none block size-3.5 translate-x-[2px] rounded-full bg-white shadow-craft-sm transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)]",
			"data-[state=checked]:translate-x-[16px]",
		)}
	/>
</SwitchPrimitive.Root>
