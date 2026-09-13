<script lang="ts">
	import { page } from "$app/state";
	import type { DocMeta } from "$lib/server/content";

	let { groups }: { groups: { category: string; items: DocMeta[] }[] } = $props();
</script>

<nav aria-label="Documentation" class="flex flex-col gap-6">
	{#each groups as group (group.category)}
		<div class="flex flex-col">
			<p class="pb-1 pl-3 text-caption font-medium text-muted-foreground">{group.category}</p>
			<ul class="flex flex-col gap-0.5">
				{#each group.items as item (item.slug)}
					{@const active = page.url.pathname === item.url}
					<li>
						<a
							href={item.url}
							aria-current={active ? "page" : undefined}
							class={[
								"flex min-h-10 items-center rounded-lg px-3 py-1.5 text-body outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
								active
									? "bg-muted font-medium text-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground"
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
