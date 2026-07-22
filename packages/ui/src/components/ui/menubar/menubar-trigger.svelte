<script lang="ts">
	import { Menubar as MenubarPrimitive } from "bits-ui";
	import { cn } from "@glyphtex/ui/utils";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: MenubarPrimitive.TriggerProps = $props();
</script>

<MenubarPrimitive.Trigger
	bind:ref
	data-slot="menubar-trigger"
	class={cn(
		"text-muted-foreground hover:bg-muted/60 hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground flex h-7 cursor-default items-center rounded-md px-2 text-[13px] outline-none transition-colors select-none",
		className,
	)}
	{...restProps}
/>
