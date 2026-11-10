<script lang="ts">
	import { Heading } from "@better-svelte-email/components";
	import type { Snippet } from "svelte";
	import { type EmailHeadingAlign, type EmailHeadingSize, emailHeading } from "../variants";

	let {
		children,
		size = "lg",
		align = "left"
	}: { children: Snippet; size?: EmailHeadingSize; align?: EmailHeadingAlign } = $props();
</script>

<Heading as="h1" class={emailHeading({ size, align })}>{@render children()}</Heading>
