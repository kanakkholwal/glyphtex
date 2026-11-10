<script lang="ts">
	import { Text } from "@better-svelte-email/components";
	import type { Snippet } from "svelte";
	import { cn } from "../../lib/cn";
	import { type EmailTextSize, type EmailTextTone, emailText } from "../variants";

	let {
		children,
		tone = "default",
		size = "default",
		class: classProp
	}: {
		children: Snippet;
		tone?: EmailTextTone;
		size?: EmailTextSize;
		class?: string;
	} = $props();
</script>

<Text class={cn(emailText({ tone, size }), classProp)}>{@render children()}</Text>
