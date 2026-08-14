<script lang="ts">
	import type { ColumnAlign, Patch, TableGrid } from '@glyphtex/ui/tex-doc';
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

	type TexDocModule = typeof import('@glyphtex/ui/tex-doc');

	/**
	 * A `tabular` edited as a grid. The handles live in the table itself rather
	 * than in a floating overlay, so a column control is always exactly as wide as
	 * its column however the browser lays the table out.
	 */
	let {
		grid,
		tex,
		onpatch
	}: {
		grid: TableGrid;
		tex: TexDocModule;
		onpatch: (patch: Patch | null) => void;
	} = $props();

	let menu = $state<{ axis: 'row' | 'column'; index: number; x: number; y: number } | null>(null);

	const ALIGNS: { id: ColumnAlign; label: string; icon: typeof IconAlignLeft }[] = [
		{ id: 'l', label: 'Align left', icon: IconAlignLeft },
		{ id: 'c', label: 'Align centre', icon: IconAlignCenter },
		{ id: 'r', label: 'Align right', icon: IconAlignRight }
	];

	const JUSTIFY: Record<string, string> = { l: 'text-left', c: 'text-center', r: 'text-right' };

	function openMenu(axis: 'row' | 'column', index: number, event: MouseEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		menu = { axis, index, x: rect.left, y: rect.bottom + 4 };
	}

	function run(patch: Patch | null) {
		menu = null;
		onpatch(patch);
	}

	/** Write the cell's text in only while the caret is somewhere else: a live
	 *  edit would otherwise be overwritten by the source it just produced. */
	function cellText(node: HTMLElement, text: string) {
		const sync = (next: string) => {
			if (document.activeElement !== node && node.textContent !== next) node.textContent = next;
		};
		sync(text);
		return { update: sync };
	}

	function commitCell(row: number, column: number, event: FocusEvent) {
		const node = event.currentTarget as HTMLElement;
		onpatch(tex.setTableCell(grid, row, column, node.textContent ?? ''));
	}

	function onCellKeyDown(event: KeyboardEvent) {
		// Enter would put a line break inside a cell, which is not a thing a
		// `tabular` cell can hold. Tab walks to the next one, as in every grid.
		if (event.key === 'Enter') {
			event.preventDefault();
			(event.currentTarget as HTMLElement).blur();
		}
	}

	const HANDLE =
		'text-faint hover:bg-accent hover:text-foreground flex items-center justify-center rounded-sm opacity-0 transition-opacity group-hover/table:opacity-100 group-focus-within/table:opacity-100';
	const ITEM =
		'text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[0.8125rem]';
</script>

<div class="group/table overflow-x-auto px-3 py-2">
	<table class="border-separate border-spacing-0 text-sm">
		<tbody>
			<tr>
				<td class="w-4"></td>
				{#each grid.columns as column, c (c)}
					<td class="p-0">
						<button
							type="button"
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
							class="{HANDLE} h-full w-3.5"
							aria-label="Row {r + 1} actions"
							onclick={(e) => openMenu('row', r, e)}
						>
							<span class="bg-border h-4 w-0.5 rounded-full"></span>
						</button>
					</td>
					{#each row.cells as cell, c (c)}
						<td
							class="border-border min-w-24 border-b px-2.5 py-1.5 {JUSTIFY[grid.columns[c]] ??
								'text-left'} {r === 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}"
						>
							<span
								contenteditable="true"
								role="textbox"
								tabindex="0"
								aria-label="Row {r + 1}, column {c + 1}"
								data-table-cell
								class="focus-visible:bg-accent/60 block rounded-sm outline-none"
								use:cellText={cell.text}
								onblur={(e) => commitCell(r, c, e)}
								onkeydown={onCellKeyDown}
							></span>
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
