<script lang="ts">
	import type { ColumnAlign, Inline, Patch, TableGrid } from '@glyphtex/ui/tex-doc';
	import {
		IconAlignCenter,
		IconAlignLeft,
		IconAlignRight,
		IconArrowBarToDown,
		IconArrowBarToLeft,
		IconArrowBarToRight,
		IconArrowBarToUp,
		IconPlus,
		IconTrash
	} from '@tabler/icons-svelte';

	import BlockEditor from './block-editor.svelte';

	type TexDocModule = typeof import('@glyphtex/ui/tex-doc');

	/**
	 * A `tabular` edited as a grid. The handles live in the table itself rather
	 * than in a floating overlay, so a column control is always exactly as wide as
	 * its column however the browser lays the table out.
	 *
	 * A cell is a full inline editor, not a text box: `\textbf{…}` in a header has
	 * to read as bold here, and the format bar has to work inside it.
	 */
	let {
		grid,
		tex,
		align = 'left',
		onpatch,
		onatom
	}: {
		grid: TableGrid;
		tex: TexDocModule;
		/** How the float places the table on the page, mirrored here. */
		align?: 'left' | 'center' | 'right';
		onpatch: (patch: Patch | null) => void;
		onatom?: (el: HTMLElement) => void;
	} = $props();

	let menu = $state<{ axis: 'row' | 'column'; index: number; x: number; y: number } | null>(null);

	const ALIGNS: { id: ColumnAlign; label: string; icon: typeof IconAlignLeft }[] = [
		{ id: 'l', label: 'Align left', icon: IconAlignLeft },
		{ id: 'c', label: 'Align centre', icon: IconAlignCenter },
		{ id: 'r', label: 'Align right', icon: IconAlignRight }
	];

	const JUSTIFY: Record<string, string> = { l: 'text-left', c: 'text-center', r: 'text-right' };
	const PLACE: Record<string, string> = {
		left: 'justify-start',
		center: 'justify-center',
		right: 'justify-end'
	};

	// Parsing is cheap per cell but a long table reparses on every keystroke in the
	// document, so the results are kept.
	const parsed = new Map<string, Inline[]>();
	function runsOf(text: string): Inline[] {
		let runs = parsed.get(text);
		if (!runs) {
			runs = tex.parseInlineFragment(text);
			parsed.set(text, runs);
		}
		return runs;
	}

	function openMenu(axis: 'row' | 'column', index: number, event: MouseEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		menu = { axis, index, x: rect.left, y: rect.bottom + 4 };
	}

	function run(patch: Patch | null) {
		menu = null;
		onpatch(patch);
	}

	function commitCell(row: number, column: number, runs: Inline[]) {
		onpatch(tex.setTableCell(grid, row, column, tex.printInlines(runs)));
	}

	const HANDLE =
		'text-faint hover:bg-accent hover:text-foreground flex items-center justify-center rounded-sm opacity-0 transition-opacity group-hover/table:opacity-100 group-focus-within/table:opacity-100';
	const ITEM =
		'text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[0.8125rem]';
</script>

<div class="group/table flex overflow-x-auto px-3 py-2 {PLACE[align]}">
	<table class="border-separate border-spacing-0 text-sm">
		<tbody>
			<tr>
				<td class="w-4"></td>
				{#each grid.columns as column, c (c)}
					<td class="p-0">
						<button
							type="button"
							tabindex="-1"
							class="{HANDLE} h-3.5 w-full"
							aria-label="Column {c + 1} actions"
							onclick={(e) => openMenu('column', c, e)}
						>
							<span class="bg-border h-0.5 w-6 rounded-full"></span>
						</button>
					</td>
				{/each}
				<td class="p-0 pl-1">
					<button
						type="button"
						tabindex="-1"
						class="{HANDLE} size-3.5"
						aria-label="Add column"
						title="Add column"
						onclick={() => onpatch(tex.insertTableColumn(grid, grid.columns.length))}
					>
						<IconPlus size={12} />
					</button>
				</td>
			</tr>

			{#each grid.rows as row, r (r)}
				<tr>
					<td class="p-0 pr-1">
						<button
							type="button"
							tabindex="-1"
							class="{HANDLE} h-full w-3.5"
							aria-label="Row {r + 1} actions"
							onclick={(e) => openMenu('row', r, e)}
						>
							<span class="bg-border h-4 w-0.5 rounded-full"></span>
						</button>
					</td>
					{#each row.cells as cell, c (c)}
						{@const rules = tex.cellRules(grid, r, c)}
						<!-- The borders come from the model, so the grid on screen shows the
						     lines the compiled table will have, and no others. -->
						<td
							class="border-border min-w-24 px-2.5 py-1.5 {JUSTIFY[grid.columns[c]] ??
								'text-left'} {r === 0
								? 'text-foreground font-medium'
								: 'text-muted-foreground'} {rules.top ? 'border-t' : ''} {rules.bottom
								? 'border-b'
								: ''} {rules.left ? 'border-l' : ''} {rules.right ? 'border-r' : ''}"
						>
							<BlockEditor
								runs={runsOf(cell.text)}
								tag="span"
								commitOn="blur"
								class="focus-visible:bg-accent/60 block rounded-sm"
								label="Row {r + 1}, column {c + 1}"
								oninput={(runs) => commitCell(r, c, runs)}
								onatom={(el) => onatom?.(el)}
							/>
						</td>
					{/each}
					<td></td>
				</tr>
			{/each}

			<tr>
				<td></td>
				<td class="p-0 pt-1" colspan={grid.columns.length}>
					<button
						type="button"
						tabindex="-1"
						class="{HANDLE} h-3.5 w-full"
						aria-label="Add row"
						title="Add row"
						onclick={() => onpatch(tex.insertTableRow(grid, grid.rows.length))}
					>
						<IconPlus size={12} />
					</button>
				</td>
				<td></td>
			</tr>
		</tbody>
	</table>
</div>

{#if menu}
	{@const m = menu}
	<div class="fixed inset-0 z-40" role="presentation" onpointerdown={() => (menu = null)}></div>
	<div
		class="border-border bg-popover fixed z-50 w-44 rounded-lg border p-1 shadow-lg"
		style:left="{Math.min(m.x, window.innerWidth - 188)}px"
		style:top="{m.y}px"
		role="menu"
		aria-label={m.axis === 'row' ? 'Row actions' : 'Column actions'}
	>
		{#if m.axis === 'column'}
			{#each ALIGNS as align (align.id)}
				{@const Icon = align.icon}
				<button
					type="button"
					role="menuitemradio"
					class={ITEM}
					aria-checked={grid.columns[m.index] === align.id}
					onclick={() => run(tex.setTableColumnAlign(grid, m.index, align.id))}
				>
					<Icon size={14} class="shrink-0" />
					{align.label}
					{#if grid.columns[m.index] === align.id}
						<span class="bg-brand ml-auto size-1.5 rounded-full"></span>
					{/if}
				</button>
			{/each}
			<div class="bg-border/70 my-1 h-px"></div>
			<button
				type="button"
				role="menuitem"
				class={ITEM}
				onclick={() => run(tex.insertTableColumn(grid, m.index))}
			>
				<IconArrowBarToLeft size={14} class="shrink-0" />
				Insert left
			</button>
			<button
				type="button"
				role="menuitem"
				class={ITEM}
				onclick={() => run(tex.insertTableColumn(grid, m.index + 1))}
			>
				<IconArrowBarToRight size={14} class="shrink-0" />
				Insert right
			</button>
			<button
				type="button"
				role="menuitem"
				class="{ITEM} hover:text-destructive"
				disabled={grid.columns.length < 2}
				onclick={() => run(tex.deleteTableColumn(grid, m.index))}
			>
				<IconTrash size={14} class="shrink-0" />
				Delete column
			</button>
		{:else}
			<button
				type="button"
				role="menuitem"
				class={ITEM}
				onclick={() => run(tex.insertTableRow(grid, m.index))}
			>
				<IconArrowBarToUp size={14} class="shrink-0" />
				Insert above
			</button>
			<button
				type="button"
				role="menuitem"
				class={ITEM}
				onclick={() => run(tex.insertTableRow(grid, m.index + 1))}
			>
				<IconArrowBarToDown size={14} class="shrink-0" />
				Insert below
			</button>
			<button
				type="button"
				role="menuitem"
				class="{ITEM} hover:text-destructive"
				disabled={grid.rows.length < 2}
				onclick={() => run(tex.deleteTableRow(grid, m.index))}
			>
				<IconTrash size={14} class="shrink-0" />
				Delete row
			</button>
		{/if}
	</div>
{/if}
