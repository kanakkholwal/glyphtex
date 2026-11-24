<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "../../../lib/cn.js";
	import { dataTable } from "./variants";

	let {
		class: classProp,
		children,
		...rest
	}: { class?: string; children?: Snippet } & Omit<
		HTMLAttributes<HTMLDivElement>,
		"class" | "children"
	> = $props();
</script>

<div {...rest} data-slot="data-table-toolbar" class={cn(dataTable().toolbar(), classProp)}>
	{@render children?.()}
</div>
