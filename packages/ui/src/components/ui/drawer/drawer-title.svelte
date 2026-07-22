<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import { Drawer as DrawerPrimitive } from "vaul-svelte";

	let {
		class: className,
		...restProps
	}: DrawerPrimitive.TitleProps = $props();
</script>

<DrawerPrimitive.Title
	data-slot="drawer-title"
	class={cn("font-heading text-foreground text-base font-medium", className)}
	{...restProps}
/>
