<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "../../../lib/cn.js";
	import { useShowcaseCard } from "./context";

	let {
		class: className,
		children,
		...rest
	}: HTMLAttributes<HTMLDivElement> & {
		children?: Snippet;
	} = $props();
	const styles = useShowcaseCard();
</script>

<div data-slot="showcase-card-copy" class={cn(styles().copy(), className)} {...rest}>
	{@render children?.()}
</div>
