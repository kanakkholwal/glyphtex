<script lang="ts">
	import { Skeleton } from "@glyphtex/ui/skeleton";

	let { count = 3, label = "Loading" }: { count?: number; label?: string } = $props();
</script>

<ul
	class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4"
	role="status"
	aria-busy="true"
	aria-label={label}
>
	{#each { length: count } as _, i (i)}
		<li class="border-border bg-card flex items-center gap-3 rounded-xl border p-3">
			<Skeleton shape="block" class="size-9 shrink-0" />
			<div class="flex min-w-0 flex-1 flex-col gap-2">
				<Skeleton class="h-3.5 w-3/5" />
				<Skeleton class="h-3 w-4/5" />
			</div>
			<Skeleton class="h-8 w-12 shrink-0 rounded-lg" />
		</li>
	{/each}
</ul>
