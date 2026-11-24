<script lang="ts">
	import type { ComponentProps } from "svelte";
	import CardContent from "../../ui/card/card-content.svelte";
	import { cn } from "../../../lib/cn.js";
	import { statCardState } from "./context";

	let { class: classProp, ...rest }: ComponentProps<typeof CardContent> = $props();
	const card = statCardState();
</script>

<CardContent {...rest} class={cn(card.styles.body(), classProp)} />
