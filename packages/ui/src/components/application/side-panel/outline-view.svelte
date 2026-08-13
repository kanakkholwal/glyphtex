<script lang="ts">
	import { IconList } from '@tabler/icons-svelte';

	import type { SidePanelStore } from './store.svelte';

	let { store, ongotoline }: { store: SidePanelStore; ongotoline?: (line: number) => void } =
		$props();
</script>

{#if store.outline.length}
	<ul class="flex flex-col py-1">
		{#each store.outline as item, i (i)}
			<li>
				<button
					class="text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left transition-colors"
					style:padding-left={`${(item.level - store.outlineBase) * 14 + 10}px`}
					title={item.title}
					onclick={() => ongotoline?.(item.line)}
				>
					<span class="bg-faint size-1 shrink-0 rounded-full"></span>
					<span class="truncate text-sm">{item.title}</span>
				</button>
			</li>
		{/each}
	</ul>
{:else}
	<div class="text-faint flex flex-col items-center gap-2 px-3 py-10 text-center">
		<IconList size={26} class="opacity-50" />
		<p class="text-xs">No sections yet.</p>
		<p class="text-xs leading-relaxed">
			Add <span class="font-mono">\section&#123;…&#125;</span> headings and they appear here.
		</p>
	</div>
{/if}
