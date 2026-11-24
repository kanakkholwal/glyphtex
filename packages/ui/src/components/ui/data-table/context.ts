import { getContext, setContext } from "svelte";
import type { TableVariant } from "../table/variants.js";
import { DATA_TABLE_LABELS, type DataTableLabels } from "./core";
import type { DataTableDensity } from "./variants";

export type DataTableStatus = {
	loading: boolean;
	fetching: boolean;
	error: unknown;
	onretry?: () => void;
	hasMore: boolean;
	onloadmore?: () => void;
	variant: TableVariant;
	density: DataTableDensity;
	labels: DataTableLabels;
};

const KEY = Symbol("data-table-status");

const IDLE: DataTableStatus = {
	loading: false,
	fetching: false,
	error: undefined,
	hasMore: false,
	variant: "default",
	density: "comfortable",
	labels: DATA_TABLE_LABELS
};

export function setDataTableStatus(status: () => DataTableStatus) {
	setContext(KEY, status);
}

/** Parts outside a DataTable root read an idle status. */
export function getDataTableStatus(): () => DataTableStatus {
	return getContext<(() => DataTableStatus) | undefined>(KEY) ?? (() => IDLE);
}
