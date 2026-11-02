<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "../../../lib/cn.js";
	import { useShowcaseCard } from "./context";

	let {
		class: className,
		children,
		...rest
	}: HTMLAttributes<HTMLParagraphElement> & {
		children?: Snippet;
	} = $props();
	const styles = useShowcaseCard();
</script>

<p data-slot="showcase-card-description" class={cn(styles().description(), className)} {...rest}>
	{@render children?.()}
</p>
