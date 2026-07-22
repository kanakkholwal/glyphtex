<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "@glyphx/ui/utils";

	let {
		ref = $bindable(null),
		class: className,
		children,
		size = "default",
		tone = "default",
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		size?: "default" | "sm";
		tone?: "default" | "default_soft" | "editorial";
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="card"
	data-size={size}
	data-tone={tone}
	class={cn(
		"text-card-foreground transition-all duration-200",
		tone === "default" && "bg-card border-border/40 shadow-sm",
		tone === "default_soft" && "bg-surface-soft/65 border-hairline shadow-craft-sm",
		tone === "editorial" &&
			"bg-card border-hairline shadow-craft-lg",
		size === "default" && "rounded-2xl p-6 md:p-8",
		size === "sm" && "rounded-xl p-4 md:p-5",
		"group/card flex flex-col gap-4 overflow-hidden",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
