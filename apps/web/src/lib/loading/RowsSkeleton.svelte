<script lang="ts">
	import { Skeleton } from "@glyphtex/ui/skeleton";

	interface Props {
		rows?: number;
		/** A round avatar before the text, for people lists. */
		avatar?: boolean;
		/** Announced to screen readers while loading. */
		label?: string;
	}

	let { rows = 3, avatar = false, label = "Loading" }: Props = $props();
</script>

<ul
	class="border-border bg-card divide-border flex flex-col divide-y rounded-xl border"
	role="status"
	aria-busy="true"
	aria-label={label}
>
	{#each { length: rows } as _, i (i)}
		<li class="flex items-center gap-3 p-4">
			{#if avatar}<Skeleton shape="circle" class="size-9 shrink-0" />{/if}
			<div class="flex min-w-0 flex-1 flex-col gap-2">
				<Skeleton class="h-3.5 w-2/5" />
				<Skeleton class="h-3 w-3/5" />
			</div>
			<Skeleton class="h-8 w-20 shrink-0 rounded-lg" />
		</li>
	{/each}
</ul>
