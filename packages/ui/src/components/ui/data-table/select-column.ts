import type { RowData } from "@tanstack/table-core";
import { type DataTableColumnDef, SELECT_COLUMN } from "./core";
import SelectAll from "./data-table-select-all.svelte";
import SelectRow from "./data-table-select-row.svelte";
import { renderComponent } from "./render";

/** A leading checkbox column: select a row, or every row on the page from the header. */
export function dataTableSelectColumn<TData extends RowData>(): DataTableColumnDef<TData> {
	return {
		...SELECT_COLUMN,
		header: ({ table }) => renderComponent(SelectAll<TData>, { table }),
		cell: ({ row }) => renderComponent(SelectRow<TData>, { row })
	};
}
