<script lang="ts">
	import type { ComponentProps } from "svelte";
	import CardHeader from "../../ui/card/card-header.svelte";
	import { cn } from "../../../lib/cn.js";
	import { statCardState } from "./context";

	let { class: classProp, ...rest }: ComponentProps<typeof CardHeader> = $props();
	const card = statCardState();
</script>

<CardHeader {...rest} class={cn(card.styles.header(), classProp)} />
