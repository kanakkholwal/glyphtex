<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import { Drawer as DrawerPrimitive } from "vaul-svelte";

	let {
		class: className,
		...restProps
	}: DrawerPrimitive.DescriptionProps = $props();
</script>

<DrawerPrimitive.Description
	data-slot="drawer-description"
	class={cn("text-muted-foreground text-sm", className)}
	{...restProps}
/>
