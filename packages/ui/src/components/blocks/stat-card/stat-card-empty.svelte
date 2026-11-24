<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "../../../lib/cn.js";
	import { statCardState } from "./context";

	let {
		class: classProp,
		children,
		...rest
	}: HTMLAttributes<HTMLParagraphElement> & { children?: Snippet } = $props();
	const card = statCardState();
</script>

<!-- Shown only while `status` is "empty". -->
{#if card.status === "empty"}
	<p {...rest} data-slot="stat-card-empty" class={cn(card.styles.message(), classProp)}>
		{@render children?.()}
	</p>
{/if}
