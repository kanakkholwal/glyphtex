<script lang="ts">
	import { Section, Text } from "@better-svelte-email/components";
	import type { Snippet } from "svelte";
	import { type EmailCalloutTone, emailCallout } from "../variants";

	let {
		children,
		title,
		tone = "neutral"
	}: {
		children: Snippet;
		/** Bold first line, e.g. "Didn't request this?". */
		title?: string;
		tone?: EmailCalloutTone;
	} = $props();

	const s = $derived(emailCallout({ tone }));
</script>

<Section class={s.root()}>
	{#if title}<Text class={s.title()}>{title}</Text>{/if}
	{@render children()}
</Section>
