<script lang="ts">
	import { CRAFT_FOCUS_RING, cn, type WithElementRef } from "@glyphtex/ui/utils";
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";

	type InputType = Exclude<HTMLInputTypeAttribute, "file">;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, "type"> &
			({ type: "file"; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		"data-slot": dataSlot = "input",
		...restProps
	}: Props = $props();
</script>

{#if type === 'file'}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			CRAFT_FOCUS_RING,
			'bg-background border-border focus-visible:border-ring aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive disabled:bg-muted h-8 rounded-md border px-2.5 py-1 text-base transition-colors file:h-6 file:text-sm file:font-medium md:text-sm file:text-foreground placeholder:text-placeholder w-full min-w-0 file:inline-flex file:border-0 file:bg-transparent disabled:cursor-not-allowed disabled:opacity-50',
			className
		)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			CRAFT_FOCUS_RING,
			'bg-background border-border focus-visible:border-ring aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive disabled:bg-muted h-8 rounded-md border px-2.5 py-1 text-base transition-colors file:h-6 file:text-sm file:font-medium md:text-sm file:text-foreground placeholder:text-placeholder w-full min-w-0 file:inline-flex file:border-0 file:bg-transparent disabled:cursor-not-allowed disabled:opacity-50',
			'[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
			className
		)}
		{type}
		bind:value
		{...restProps}
	/>
{/if}
