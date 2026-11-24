<script lang="ts" generics="TData extends RowData">
	import type { RowData } from "@tanstack/table-core";
	import { button } from "../button/variants.js";
	import DropdownMenu from "../dropdown-menu/dropdown-menu.svelte";
	import DropdownMenuCheckboxItem from "../dropdown-menu/dropdown-menu-checkbox-item.svelte";
	import DropdownMenuContent from "../dropdown-menu/dropdown-menu-content.svelte";
	import DropdownMenuLabel from "../dropdown-menu/dropdown-menu-label.svelte";
	import DropdownMenuTrigger from "../dropdown-menu/dropdown-menu-trigger.svelte";
	import { cn } from "../../../lib/cn.js";
	import { columnLabel, DATA_TABLE_ICONS, type DataTableInstance } from "./core";
	import { dataTable } from "./variants";
	import { getDataTableStatus } from "./context";
	import Icon from "./data-table-icon.svelte";

	let { table, class: classProp }: { table: DataTableInstance<TData>; class?: string } = $props();

	const status = getDataTableStatus();
	const styles = dataTable();
	const columns = $derived(table.getAllLeafColumns().filter((column) => column.getCanHide()));
</script>

<!-- A menu of every hideable column, each a checkbox for its visibility. -->
<DropdownMenu>
	<DropdownMenuTrigger
		class={cn(button({ variant: "outline", size: "sm" }), styles.viewTrigger(), classProp)}
	>
		<Icon d={DATA_TABLE_ICONS.columns} />
		{status().labels.columns}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="end">
		<DropdownMenuLabel>{status().labels.toggleColumns}</DropdownMenuLabel>
		{#each columns as column (column.id)}
			<DropdownMenuCheckboxItem
				bind:checked={() => column.getIsVisible(), (visible) => column.toggleVisibility(visible)}
			>
				{columnLabel(column)}
			</DropdownMenuCheckboxItem>
		{/each}
	</DropdownMenuContent>
</DropdownMenu>
