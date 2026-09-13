<script lang="ts">
	import type { WithoutChildrenOrChild } from "@glyphtex/ui/utils";
	import {
		CRAFT_OVERLAY_ANIMATION,
		CRAFT_OVERLAY_SURFACE,
		cn,
		type WithoutChild
	} from "@glyphtex/ui/utils";
	import { Select as SelectPrimitive } from "bits-ui";
	import type { ComponentProps } from "svelte";
	import SelectPortal from "./select-portal.svelte";
	import SelectScrollDownButton from "./select-scroll-down-button.svelte";
	import SelectScrollUpButton from "./select-scroll-up-button.svelte";

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		portalProps,
		children,
		preventScroll = false,
		...restProps
	}: WithoutChild<SelectPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SelectPortal>>;
	} = $props();
</script>

<SelectPortal {...portalProps}>
	<SelectPrimitive.Content
		bind:ref
		{sideOffset}
		{preventScroll}
		data-slot="select-content"
		class={cn(
			CRAFT_OVERLAY_ANIMATION,
			CRAFT_OVERLAY_SURFACE,
			'relative isolate z-50 min-w-36 max-h-(--bits-select-content-available-height) overflow-x-hidden overflow-y-auto p-1',
			className
		)}
		{...restProps}
	>
		<SelectScrollUpButton />
		<SelectPrimitive.Viewport
			class={cn(
				'h-(--bits-select-anchor-height) w-full min-w-(--bits-select-anchor-width) scroll-my-1'
			)}
		>
			{@render children?.()}
		</SelectPrimitive.Viewport>
		<SelectScrollDownButton />
	</SelectPrimitive.Content>
</SelectPortal>
