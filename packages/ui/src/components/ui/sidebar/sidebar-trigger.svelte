<script lang="ts">
	import { IconLayoutSidebar } from "@tabler/icons-svelte";
	import type { ComponentProps } from "svelte";
	import { Button } from "../button";
	import { useSidebar } from "./context.svelte";

	let {
		ref = $bindable(null),
		class: className,
		onclick,
		...restProps
	}: ComponentProps<typeof Button> & {
		onclick?: (e: MouseEvent) => void;
	} = $props();

	const sidebar = useSidebar();
</script>

<Button
	bind:ref
	data-sidebar="trigger"
	data-slot="sidebar-trigger"
	variant="ghost"
	size="icon-sm"
	class={className}
	type="button"
	onclick={(e) => {
		onclick?.(e);
		sidebar.toggle();
	}}
	{...restProps}
>
	<IconLayoutSidebar />
	<span class="sr-only">Toggle Sidebar</span>
</Button>
