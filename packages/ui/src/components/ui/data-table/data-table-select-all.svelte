<script lang="ts" generics="TData extends RowData">
	import type { RowData } from "@tanstack/table-core";
	import Checkbox from "../checkbox/checkbox.svelte";
	import type { DataTableInstance } from "./core";
	import { getDataTableStatus } from "./context";

	let { table }: { table: DataTableInstance<TData> } = $props();

	const status = getDataTableStatus();
</script>

<Checkbox
	size="sm"
	aria-label={status().labels.selectAll}
	indeterminate={table.getIsSomePageRowsSelected()}
	bind:checked={() => table.getIsAllPageRowsSelected(), (on) => table.toggleAllPageRowsSelected(on)}
/>
