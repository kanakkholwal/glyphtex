<script lang="ts" generics="TData extends RowData, TValue">
	import type { RowData } from "@tanstack/table-core";
	import { button } from "../button/variants.js";
	import DropdownMenu from "../dropdown-menu/dropdown-menu.svelte";
	import DropdownMenuContent from "../dropdown-menu/dropdown-menu-content.svelte";
	import DropdownMenuItem from "../dropdown-menu/dropdown-menu-item.svelte";
	import DropdownMenuSeparator from "../dropdown-menu/dropdown-menu-separator.svelte";
	import DropdownMenuTrigger from "../dropdown-menu/dropdown-menu-trigger.svelte";
	import { cn } from "../../../lib/cn.js";
	import { columnLabel, DATA_TABLE_ICONS, type DataTableColumn } from "./core";
	import { dataTable } from "./variants";
	import { getDataTableStatus } from "./context";
	import Icon from "./data-table-icon.svelte";

	let {
		column,
		title,
		class: classProp
	}: {
		column: DataTableColumn<TData, TValue>;
		/** Defaults to `meta.label`, then the column id. */
		title?: string;
		class?: string;
	} = $props();

	const status = getDataTableStatus();
	const labels = $derived(status().labels);
	const styles = dataTable();
	const label = $derived(title ?? columnLabel(column));
	const canSort = $derived(column.getCanSort());
	const canPin = $derived(column.getCanPin());
	const canHide = $derived(column.getCanHide());
	const sorted = $derived(column.getIsSorted());
	const pinned = $derived(column.getIsPinned());
	const sortIcon = $derived(
		sorted === "asc"
			? DATA_TABLE_ICONS.sortAsc
			: sorted === "desc"
				? DATA_TABLE_ICONS.sortDesc
				: DATA_TABLE_ICONS.unsorted
	);
</script>

<!-- A header that opens a menu to sort, pin or hide its column. -->
{#if !canSort && !canPin && !canHide}
	<span class={cn(styles.sortLabel(), classProp)}>{label}</span>
{:else}
	<DropdownMenu>
		<DropdownMenuTrigger
			class={cn(button({ variant: "ghost", size: "xs" }), styles.sortTrigger(), classProp)}
		>
			<span class={styles.sortLabel()}>{label}</span>
			{#if canSort}
				<Icon d={sortIcon} class={cn(styles.icon(), !sorted && "opacity-50")} />
			{/if}
		</DropdownMenuTrigger>
		<DropdownMenuContent align="start">
			{#if canSort}
				<DropdownMenuItem onSelect={() => column.toggleSorting(false)}>
					{labels.sortAscending}
					<Icon d={DATA_TABLE_ICONS.sortAsc} class={styles.icon()} />
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => column.toggleSorting(true)}>
					{labels.sortDescending}
					<Icon d={DATA_TABLE_ICONS.sortDesc} class={styles.icon()} />
				</DropdownMenuItem>
				{#if sorted}
					<DropdownMenuItem onSelect={() => column.clearSorting()}>{labels.clearSort}</DropdownMenuItem>
				{/if}
			{/if}
			{#if canSort && (canPin || canHide)}
				<DropdownMenuSeparator />
			{/if}
			{#if canPin}
				<DropdownMenuItem onSelect={() => column.pin(pinned ? false : "start")}>
					{pinned ? labels.unpin : labels.pin}
					<Icon d={DATA_TABLE_ICONS.pin} class={styles.icon()} />
				</DropdownMenuItem>
			{/if}
			{#if canHide}
				<DropdownMenuItem onSelect={() => column.toggleVisibility(false)}>
					{labels.hide}
					<Icon d={DATA_TABLE_ICONS.hide} class={styles.icon()} />
				</DropdownMenuItem>
			{/if}
		</DropdownMenuContent>
	</DropdownMenu>
{/if}
