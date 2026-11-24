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

<!-- A context line under the headline; hidden while empty or failed. -->
{#if card.status !== "empty" && card.status !== "error"}
	<p {...rest} data-slot="stat-card-description" class={cn(card.styles.description(), classProp)}>
		{@render children?.()}
	</p>
{/if}
