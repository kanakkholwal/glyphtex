<script lang="ts">
	import { Section } from "@better-svelte-email/components";
	import type { Snippet } from "svelte";
	import { type EmailPanelTone, emailPanel } from "../variants";

	/** A tinted, rounded box that groups a summary: totals, details, a notice. */
	let { children, tone = "muted" }: { children: Snippet; tone?: EmailPanelTone } = $props();
</script>

<Section class={emailPanel({ tone })}>{@render children()}</Section>
