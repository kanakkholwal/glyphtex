<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAnchorAttributes } from "svelte/elements";
	import { cn } from "../../../lib/cn.js";
	import { useShowcaseCard } from "./context";

	let {
		class: className,
		children,
		...rest
	}: HTMLAnchorAttributes & {
		children?: Snippet;
	} = $props();
	const styles = useShowcaseCard();
</script>

<a data-slot="showcase-card-link" class={cn(styles().link(), className)} {...rest}>
	{@render children?.()}
</a>
