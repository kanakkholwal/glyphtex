<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "@glyphtex/ui/utils";

	// Hairline and radius, no shadow at rest. `panel` is the public-page card (canvas-toned in dark).
	let {
		ref = $bindable(null),
		class: className,
		children,
		size = "default",
		tone = "default",
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		size?: "default" | "sm";
		tone?: "default" | "default_soft" | "editorial" | "panel" | "framed";
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="card"
	data-size={size}
	data-tone={tone}
	class={cn(
		'group/card flex flex-col gap-4 overflow-hidden border border-border text-card-foreground',
		tone === 'default_soft' ? 'bg-muted' : 'bg-card',
		(tone === 'panel' || tone === 'editorial') && 'dark:bg-background',
		// baby-ui's inset-rim: a soft ring just inside the hairline, same idea as Dialog/Sheet.
		// --muted and --card share a hex in light mode, so dark mode borrows --background instead.
		tone === 'framed' &&
			'shadow-[inset_0_0_0_4px_var(--muted)] dark:shadow-[inset_0_0_0_4px_var(--background)]',
		size === 'default' && 'rounded-2xl p-6 md:p-8',
		size === 'sm' && 'rounded-xl p-4 md:p-5',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
