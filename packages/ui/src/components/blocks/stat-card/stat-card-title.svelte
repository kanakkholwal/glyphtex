<script lang="ts">
	import type { ComponentProps } from "svelte";
	import CardTitle from "../../ui/card/card-title.svelte";
	import { cn } from "../../../lib/cn.js";
	import { statCardState } from "./context";

	let { class: classProp, ...rest }: ComponentProps<typeof CardTitle> = $props();
	const card = statCardState();
</script>

<CardTitle {...rest} class={cn(card.styles.title(), classProp)} />
