<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "@glyphtex/ui/utils";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<span
	bind:this={ref}
	data-slot="menubar-shortcut"
	class={cn('text-muted-foreground ml-auto pl-6 font-mono text-xs tracking-wide', className)}
	{...restProps}
>
	{@render children?.()}
</span>
