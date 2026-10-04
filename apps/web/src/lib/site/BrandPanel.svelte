<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";
	import Well from "./Well.svelte";

	// The closing call to action: one line, one sentence of support, the actions.
	let {
		title,
		body,
		icon,
		actions,
		class: className
	}: {
		title: string;
		body?: string;
		icon?: Snippet;
		actions?: Snippet;
		/** Accepted for older call sites. */
		size?: "default" | "hero";
		class?: string;
	} = $props();
</script>

<Well
	class={cn('w-full', className)}
	bodyClass="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
>
	<div class="flex items-start gap-4">
		{#if icon}
			<span
				class="hidden size-10 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground sm:grid [&_svg]:size-5"
				aria-hidden="true"
			>
				{@render icon()}
			</span>
		{/if}
		<div>
			<h2 class="text-lg font-medium text-balance text-foreground">{title}</h2>
			{#if body}
				<p class="mt-1 max-w-md text-sm text-pretty text-muted-foreground">{body}</p>
			{/if}
		</div>
	</div>
	{#if actions}
		<div class="flex flex-wrap gap-2">{@render actions()}</div>
	{/if}
</Well>
