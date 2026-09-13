<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import DialogPortal from "./dialog-portal.svelte";
	import type { Snippet } from "svelte";
	import * as Dialog from ".";
	import {
		CRAFT_OVERLAY_ANIMATION,
		CRAFT_OVERLAY_SURFACE,
		cn,
		type WithoutChildrenOrChild
	} from "@glyphtex/ui/utils";
	import type { ComponentProps } from "svelte";
	import { Button } from "../button";
	import { IconX } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		children,
		showCloseButton = true,
		preventScroll = false,
		...restProps
	}: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DialogPortal>>;
		children: Snippet;
		showCloseButton?: boolean;
	} = $props();
</script>

<DialogPortal {...portalProps}>
	<Dialog.Overlay />
	<DialogPrimitive.Content
		bind:ref
		data-slot="dialog-content"
		{preventScroll}
		class={cn(
			CRAFT_OVERLAY_ANIMATION,
			CRAFT_OVERLAY_SURFACE,
			'grid max-w-[calc(100%-2rem)] gap-4 p-4 text-sm sm:max-w-sm fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none',
			className
		)}
		{...restProps}
	>
		{@render children?.()}
		{#if showCloseButton}
			<DialogPrimitive.Close data-slot="dialog-close">
				{#snippet child({ props })}
					<Button
						variant="ghost"
						size="icon-sm"
						class="absolute top-2 right-2 size-10 text-muted-foreground hover:text-foreground sm:size-8"
						{...props}
					>
						<IconX />
						<span class="sr-only">Close</span>
					</Button>
				{/snippet}
			</DialogPrimitive.Close>
		{/if}
	</DialogPrimitive.Content>
</DialogPortal>
