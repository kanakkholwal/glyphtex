<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "../../../lib/cn.js";
	import { useShowcaseCard } from "./context";

	let {
		class: className,
		children,
		...rest
	}: HTMLAttributes<HTMLHeadingElement> & {
		children?: Snippet;
	} = $props();
	const styles = useShowcaseCard();
</script>

<h3 data-slot="showcase-card-title" class={cn(styles().title(), className)} {...rest}>
	{@render children?.()}
</h3>
