<script lang="ts">
	import { page } from "$app/state";
	import type { DocMeta } from "$lib/server/content";

	let { groups }: { groups: { category: string; items: DocMeta[] }[] } = $props();
</script>

<nav aria-label="Documentation" class="text-sm">
	{#each groups as group (group.category)}
		<div class="mb-6">
			<p class="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
				{group.category}
			</p>
			<ul class="space-y-0.5">
				{#each group.items as item (item.slug)}
					{@const active = page.url.pathname === item.url}
					<li>
						<a
							href={item.url}
							aria-current={active ? "page" : undefined}
							class={[
								"block rounded-lg px-3 py-1.5 leading-snug transition-colors",
								active
									? "bg-surface-strong font-medium text-foreground"
									: "text-muted-foreground hover:bg-surface-soft hover:text-foreground"
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
