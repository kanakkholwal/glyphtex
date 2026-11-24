<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "../../../lib/cn.js";
	import { statCardState } from "./context";

	let {
		class: classProp,
		children,
		...rest
	}: HTMLAttributes<HTMLDivElement> & { children?: Snippet } = $props();
	const card = statCardState();
</script>

<!-- Shown only while `status` is "error"; put a retry Button inside. -->
{#if card.status === "error"}
	<div {...rest} data-slot="stat-card-error" role="alert" class={cn(card.styles.message(), classProp)}>
		{@render children?.()}
	</div>
{/if}
