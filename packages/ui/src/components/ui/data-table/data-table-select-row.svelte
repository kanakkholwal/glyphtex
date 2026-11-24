<script lang="ts" generics="TData extends RowData">
	import type { RowData } from "@tanstack/table-core";
	import Checkbox from "../checkbox/checkbox.svelte";
	import type { DataTableRow } from "./core";
	import { getDataTableStatus } from "./context";

	let { row }: { row: DataTableRow<TData> } = $props();

	const status = getDataTableStatus();
</script>

<Checkbox
	size="sm"
	aria-label={status().labels.selectRow}
	disabled={!row.getCanSelect()}
	bind:checked={() => row.getIsSelected(), (on) => row.toggleSelected(on)}
/>
