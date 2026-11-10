<script lang="ts">
	import { Text } from "@better-svelte-email/components";
	import type { Snippet } from "svelte";
	import { type EmailBadgeTone, emailBadge } from "../variants";

	/** A short label such as "Security" or "Receipt"; the text carries the meaning, not the tone. */
	let { children, tone = "neutral" }: { children: Snippet; tone?: EmailBadgeTone } = $props();
</script>

<Text class={emailBadge({ tone })}>{@render children()}</Text>
