<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		description?: string;
		/** Right-aligned control beside the heading (Invite, Export). */
		action?: Snippet;
		children: Snippet;
	}

	let { title, description, action, children }: Props = $props();
</script>

<section class="flex flex-col gap-4">
	<div class="flex items-end justify-between gap-4">
		<div class="flex min-w-0 flex-col gap-0.5">
			<h2 class="text-foreground text-base font-medium">{title}</h2>
			{#if description}<p class="text-muted-foreground text-sm">{description}</p>{/if}
		</div>
		{#if action}<div class="shrink-0">{@render action()}</div>{/if}
	</div>
	{@render children()}
</section>
