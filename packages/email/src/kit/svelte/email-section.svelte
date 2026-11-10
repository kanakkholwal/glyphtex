<script lang="ts">
	import { Section } from "@better-svelte-email/components";
	import type { Snippet } from "svelte";
	import { type EmailSectionAlign, emailSection } from "../variants";

	/** One card of a `stacked` EmailShell. */
	let { children, align = "left" }: { children: Snippet; align?: EmailSectionAlign } = $props();
</script>

<Section class={emailSection({ align })}>{@render children()}</Section>
