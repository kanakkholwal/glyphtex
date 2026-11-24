import type { ColumnDef, RowData } from "@tanstack/table-core";
import { initTableWorker } from "@tanstack/table-core/experimental-worker-plugin";
import { dataTableProcessing } from "./core";

/** A column for the worker: an accessor and the table's column id, no renderers. */
export type DataTableWorkerColumn<TData extends RowData> = ColumnDef<
	ReturnType<typeof dataTableProcessing>,
	TData
>;

/**
 * Runs DataTable filtering and sorting in this worker. Call it from your worker entry with
 * accessor-only columns using the table's column ids; cell and header renderers stay behind.
 */
export function initDataTableWorker<TData extends RowData>(
	columns: DataTableWorkerColumn<TData>[]
): void {
	initTableWorker({
		features: dataTableProcessing(),
		columns,
		globalFilterFn: "includesString"
	});
}
