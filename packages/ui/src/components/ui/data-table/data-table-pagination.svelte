<script lang="ts" generics="TData extends RowData">
	import type { RowData } from "@tanstack/table-core";
	import type { HTMLAttributes } from "svelte/elements";
	import Button from "../button/button.svelte";
	import { cn } from "../../../lib/cn.js";
	import Select from "../select/select.svelte";
	import SelectContent from "../select/select-content.svelte";
	import SelectItem from "../select/select-item.svelte";
	import SelectTrigger from "../select/select-trigger.svelte";
	import SelectValue from "../select/select-value.svelte";
	import { DATA_TABLE_ICONS, type DataTableInstance, rangeLabel } from "./core";
	import { dataTable } from "./variants";
	import { getDataTableStatus } from "./context";
	import Icon from "./data-table-icon.svelte";

	let {
		table,
		pageSizes = [10, 20, 50, 100],
		showSelection = true,
		class: classProp,
		...rest
	}: {
		table: DataTableInstance<TData>;
		pageSizes?: readonly number[];
		/** Show "N of M selected" when rows are selectable. */
		showSelection?: boolean;
		class?: string;
	} & Omit<HTMLAttributes<HTMLDivElement>, "class" | "children"> = $props();

	const status = getDataTableStatus();
	const labels = $derived(status().labels);
	const styles = dataTable();
	const pagination = $derived(table.atoms.pagination.get());
	const total = $derived(table.getRowCount());
	const selected = $derived(Object.keys(table.atoms.rowSelection.get()).length);
	const pageCount = $derived(Math.max(1, table.getPageCount()));
	const sizes = $derived(pageSizes.map((size) => ({ value: String(size), label: String(size) })));
	const nav = $derived([
		{
			label: labels.firstPage,
			icon: DATA_TABLE_ICONS.chevronsLeft,
			on: () => table.firstPage(),
			can: table.getCanPreviousPage()
		},
		{
			label: labels.previousPage,
			icon: DATA_TABLE_ICONS.chevronLeft,
			on: () => table.previousPage(),
			can: table.getCanPreviousPage()
		},
		{
			label: labels.nextPage,
			icon: DATA_TABLE_ICONS.chevronRight,
			on: () => table.nextPage(),
			can: table.getCanNextPage()
		},
		{
			label: labels.lastPage,
			icon: DATA_TABLE_ICONS.chevronsRight,
			on: () => table.lastPage(),
			can: table.getCanNextPage()
		}
	]);
</script>

<div {...rest} data-slot="data-table-pagination" class={cn(styles.footer(), classProp)}>
	<span class={styles.selection()}>
		{showSelection && selected > 0
			? `${selected.toLocaleString()} of ${total.toLocaleString()} selected`
			: rangeLabel(pagination.pageIndex, pagination.pageSize, total)}
	</span>
	<div class="flex flex-wrap items-center gap-x-6 gap-y-3">
		<div class={styles.pageSize()}>
			<span>{labels.rowsPerPage}</span>
			<Select
				items={sizes}
				bind:value={() => String(pagination.pageSize), (next) => table.setPageSize(Number(next))}
			>
				<SelectTrigger aria-label={labels.rowsPerPage} class={styles.pageSizeTrigger()}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{#each sizes as size (size.value)}
						<SelectItem value={size.value} label={size.label}>{size.label}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>
		<span class={styles.pageInfo()}>
			Page {Math.min(pagination.pageIndex + 1, pageCount)} of {pageCount.toLocaleString()}
		</span>
		<div class={styles.pageNav()}>
			{#each nav as item (item.label)}
				<Button
					variant="outline"
					size="icon-sm"
					aria-label={item.label}
					disabled={!item.can || status().loading}
					onclick={item.on}
				>
					<Icon d={item.icon} />
				</Button>
			{/each}
		</div>
	</div>
</div>
