<script lang="ts">
	import type { ComponentProps, Snippet } from "svelte";
	import Card from "../card/card.svelte";
	import { cn } from "../../../lib/cn.js";
	import { type ShowcaseCardSize, type ShowcaseCardVariant, showcaseCard } from "./variants";
	import { setShowcaseCard } from "./context";

	let {
		variant = "solid",
		size = "default",
		class: className,
		children,
		...rest
	}: Omit<ComponentProps<typeof Card>, "variant"> & {
		variant?: ShowcaseCardVariant;
		size?: ShowcaseCardSize;
		children?: Snippet;
	} = $props();

	const styles = $derived(showcaseCard({ variant, size }));
	setShowcaseCard(() => styles);
</script>

<Card
	variant="framed"
	data-slot="showcase-card"
	data-variant={variant}
	data-size={size}
	class={cn(styles.root(), className)}
	{...rest}
>
	{@render children?.()}
</Card>
