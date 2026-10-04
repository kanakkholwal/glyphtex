<script lang="ts">
	import { page } from "$app/state";
	import type { DocMeta } from "$lib/server/content";

	let { groups }: { groups: { category: string; items: DocMeta[] }[] } = $props();
</script>

<nav aria-label="Documentation" class="flex flex-col gap-6">
	{#each groups as group (group.category)}
		<div class="flex flex-col">
			<p class="pb-1.5 pl-3 font-mono text-xs text-muted-foreground">{group.category}</p>
			<ul class="flex flex-col gap-0.5">
				{#each group.items as item (item.slug)}
					{@const active = page.url.pathname === item.url}
					<li>
						<a
							href={item.url}
							aria-current={active ? "page" : undefined}
							class={[
								"flex min-h-9 items-center rounded-md px-3 py-1.5 text-sm outline-none transition-colors duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-ring",
								active
									? "bg-foreground/[0.06] font-medium text-foreground"
									: "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground"
							]}
						>
							{item.title}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</nav>
