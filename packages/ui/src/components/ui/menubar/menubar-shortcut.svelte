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
	class={cn(
		"text-muted-foreground/60 ml-auto pl-6 font-mono text-[11px] tracking-wide",
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</span>
