<script lang="ts">
	import { Button } from "@better-svelte-email/components";
	import type { Snippet } from "svelte";
	import {
		EMAIL_BUTTON_PADDING,
		type EmailButtonShape,
		type EmailButtonSize,
		type EmailButtonVariant,
		type EmailButtonWidth,
		emailButton
	} from "../variants";

	let {
		href,
		children,
		variant = "primary",
		size = "default",
		shape = "rounded",
		width = "auto"
	}: {
		href: string;
		children: Snippet;
		variant?: EmailButtonVariant;
		size?: EmailButtonSize;
		shape?: EmailButtonShape;
		width?: EmailButtonWidth;
	} = $props();

	// A link-style button has no box, so no Outlook spacer either.
	const pad = $derived(variant === "link" ? { x: 0, y: 0 } : EMAIL_BUTTON_PADDING[size]);
</script>

<Button {href} pX={pad.x} pY={pad.y} class={emailButton({ variant, size, shape, width })}>{@render children()}</Button>
