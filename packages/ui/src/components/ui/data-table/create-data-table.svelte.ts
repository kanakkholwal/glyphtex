import type { RowData } from "@tanstack/table-core";
import { untrack } from "svelte";
import {
	constructDataTable,
	type DataTableInstance,
	type DataTableOptions,
	setDataTableOptions
} from "./core";
import { svelteReactivity } from "./reactivity.svelte";

/**
 * A TanStack Table instance whose reads track as runes. Call it during component init with
 * a function returning the options, so `data`, `columns` and controlled state stay live.
 */
export function createDataTable<TData extends RowData>(
	options: () => DataTableOptions<TData>
): DataTableInstance<TData> {
	const table = constructDataTable(untrack(options), svelteReactivity());
	// Before the DOM updates, so rows never render a frame behind their data.
	$effect.pre(() => {
		const next = options();
		untrack(() => setDataTableOptions(table, next));
	});
	return table;
}
