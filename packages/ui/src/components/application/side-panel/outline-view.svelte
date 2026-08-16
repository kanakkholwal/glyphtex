<script lang="ts">
	import { IconChevronRight, IconList } from "@tabler/icons-svelte";
	import { MediaQuery } from "svelte/reactivity";

	import type { OutlineRow } from "../outline";
	import type { SidePanelStore } from "./store.svelte";

	let { store, ongotoline }: { store: SidePanelStore; ongotoline?: (line: number) => void } =
		$props();

	const reduced = new MediaQuery("prefers-reduced-motion: reduce");
	let listEl = $state<HTMLElement>();

	// One indent step. The disclosure marker is centred in the 16px slot that
	// follows it, which is also where a child's guide line has to land.
	const STEP = 16;
	const marker = (depth: number) => depth * STEP + 6;
	const guide = (depth: number) => depth * STEP + 14;

	// Only past a threshold. The caret moves within one section constantly, and
	// re-centring on every keystroke would make the panel twitch as you type.
	$effect(() => {
		const row = listEl?.children[store.outlineActiveRow] as HTMLElement | undefined;
		const box = listEl?.closest<HTMLElement>("[data-panel-scroll]");
		if (!row || !box) return;
		const offset = row.offsetTop - box.scrollTop - box.clientHeight / 2 + row.clientHeight / 2;
		if (Math.abs(offset) > 40)
			box.scrollBy({ top: offset, behavior: reduced.current ? "auto" : "smooth" });
	});

	// Left/right fold the subtree, so the disclosure buttons can stay out of the
	// tab order: a 60-section thesis would otherwise cost 60 extra tab stops.
	function onRowKey(event: KeyboardEvent, row: OutlineRow) {
		if (!row.hasChildren) return;
		const wants = event.key === "ArrowRight" ? true : event.key === "ArrowLeft" ? false : null;
		if (wants === null || wants !== row.collapsed) return;
		event.preventDefault();
		store.toggleOutlineNode(row.key);
	}
</script>

{#if store.outline.length}
	<ul bind:this={listEl} role="tree" aria-label="Document outline" class="flex flex-col py-1">
		{#each store.outlineRows as row, r (row.key + row.index)}
			{@const on = r === store.outlineActiveRow}
			<li role="none" class="relative h-7">
				<!-- One guide per ancestor level: the line a child hangs off is what
				     makes the nesting readable without counting indents. -->
				{#each Array.from({ length: row.depth }) as _, d (d)}
					<span
						aria-hidden="true"
						class="bg-border/70 absolute inset-y-0 w-px"
						style:left={`${guide(d)}px`}
					></span>
				{/each}

				{#if on}
					<span aria-hidden="true" class="bg-brand absolute inset-y-1 left-0 w-0.5 rounded-full"
					></span>
				{/if}

				<button
					type="button"
					role="treeitem"
					aria-level={row.depth + 1}
					aria-expanded={row.hasChildren ? !row.collapsed : undefined}
					aria-selected={on}
					class="flex h-full w-full items-center rounded-md pr-2 text-left transition-colors {on
						? 'bg-accent text-foreground'
						: 'hover:bg-accent/60 hover:text-foreground ' +
							(row.depth === 0 ? 'text-foreground/80' : 'text-muted-foreground')}"
					style:padding-left={`${row.depth * STEP + 26}px`}
					title={row.item.title}
					onkeydown={(e) => onRowKey(e, row)}
					onclick={() => ongotoline?.(row.item.line)}
				>
					<span
						class="truncate {row.depth === 0
							? 'text-sm font-medium'
							: row.depth === 1
								? 'text-sm'
								: 'text-xs'}">{row.item.title}</span
					>
				</button>

				<!-- Sits over the row rather than inside it: a button cannot nest in a
				     button, and folding must not also navigate. -->
				{#if row.hasChildren}
					<button
						type="button"
						tabindex="-1"
						aria-label={row.collapsed
							? `Expand ${row.item.title}`
							: `Collapse ${row.item.title}`}
						class="text-faint hover:text-foreground absolute top-1/2 grid size-4 -translate-y-1/2 place-items-center rounded"
						style:left={`${marker(row.depth)}px`}
						onclick={() => store.toggleOutlineNode(row.key)}
					>
						<IconChevronRight
							size={13}
							class="transition-transform duration-150 motion-reduce:transition-none {row.collapsed
								? ''
								: 'rotate-90'}"
						/>
					</button>
				{:else}
					<span
						aria-hidden="true"
						class="absolute top-1/2 size-1 -translate-y-1/2 rounded-full {on
							? 'bg-brand'
							: 'bg-faint'}"
						style:left={`${marker(row.depth) + 6}px`}
					></span>
				{/if}
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
