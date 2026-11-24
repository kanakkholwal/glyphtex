import {
	type CellContext,
	type Column,
	type ColumnDef,
	type ColumnHelper,
	columnFilteringFeature,
	columnOrderingFeature,
	columnPinningFeature,
	columnResizingFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	constructTable,
	createColumnHelper,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFn_arrIncludesSome,
	filterFn_equals,
	filterFn_includesString,
	filterFn_inNumberRange,
	globalFilteringFeature,
	type HeaderContext,
	type Row,
	type RowData,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_basic,
	sortFn_datetime,
	sortFn_text,
	type Table,
	type TableFeatures,
	type TableOptions,
	tableFeatures
} from "@tanstack/table-core";
import {
	createTableWorker,
	createWorkerRowModel,
	type TableWorker,
	workerRowModelsFeature
} from "@tanstack/table-core/experimental-worker-plugin";
import type { TableReactivityBindings } from "@tanstack/table-core/reactivity";
import { table_setOptions } from "@tanstack/table-core/static-functions";
import { storeReactivityBindings } from "@tanstack/table-core/store-reactivity-bindings";
import {
	elementScroll,
	observeElementOffset,
	observeElementRect,
	Virtualizer
} from "@tanstack/virtual-core";

/** Per-column extras the DataTable parts read from `columnDef.meta`. */
export type DataTableColumnMeta = {
	/** Name in the column menu and view options; falls back to the column id. */
	label?: string;
	align?: "start" | "center" | "end";
	headClassName?: string;
	cellClassName?: string;
	/** false keeps the column in place when others are dragged around it. */
	reorderable?: boolean;
};

const columnMeta: DataTableColumnMeta = {};

// Shared by the main thread and the worker's shadow table, so both compute the same rows.
const PROCESSING = {
	columnFilteringFeature,
	columnOrderingFeature,
	columnPinningFeature,
	columnResizingFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	globalFilteringFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	columnMeta,
	filterFns: {
		includesString: filterFn_includesString,
		equals: filterFn_equals,
		arrIncludesSome: filterFn_arrIncludesSome,
		inNumberRange: filterFn_inNumberRange
	},
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		basic: sortFn_basic,
		datetime: sortFn_datetime,
		text: sortFn_text
	}
};

/** The filtering and sorting setup a worker entry runs; see `initDataTableWorker`. */
export function dataTableProcessing() {
	return tableFeatures({
		...PROCESSING,
		filteredRowModel: createFilteredRowModel(),
		sortedRowModel: createSortedRowModel()
	});
}

/**
 * A worker row model that also reads the table store: results land as a state bump, so
 * rune-tracked reads (Svelte) rerun when one arrives instead of keeping the stale rows.
 */
function workerRowModel(worker: TableWorker, stage: "filtered" | "sorted") {
	const factory = createWorkerRowModel(worker, stage);
	return <TFeatures extends TableFeatures, TRow extends RowData>(table: Table<TFeatures, TRow>) => {
		const read = factory(table);
		return () => {
			table.store.get();
			return read();
		};
	};
}

function features(
	paginate: boolean,
	reactivity: TableReactivityBindings,
	worker: TableWorker | undefined
) {
	return tableFeatures({
		...PROCESSING,
		coreReactivityFeature: reactivity,
		workerRowModelsFeature,
		filteredRowModel: worker ? workerRowModel(worker, "filtered") : createFilteredRowModel(),
		sortedRowModel: worker ? workerRowModel(worker, "sorted") : createSortedRowModel(),
		// Left out for scroll tables, so getRowModel() returns every row.
		paginatedRowModel: paginate ? createPaginatedRowModel() : undefined
	});
}

export type DataTableFeatures = ReturnType<typeof features>;
export type DataTableInstance<TData extends RowData> = Table<DataTableFeatures, TData>;
export type DataTableColumn<TData extends RowData, TValue = unknown> = Column<
	DataTableFeatures,
	TData,
	TValue
>;
export type DataTableRow<TData extends RowData> = Row<DataTableFeatures, TData>;
export type DataTableHeaderContext<TData extends RowData, TValue = unknown> = HeaderContext<
	DataTableFeatures,
	TData,
	TValue
>;
export type DataTableCellContext<TData extends RowData, TValue = unknown> = CellContext<
	DataTableFeatures,
	TData,
	TValue
>;
export type DataTableColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<
	DataTableFeatures,
	TData,
	TValue
>;

/** Every TanStack Table option except `features`, which the DataTable owns. */
export type DataTableOptions<TData extends RowData> = Omit<
	TableOptions<DataTableFeatures, TData>,
	"features"
> & {
	/** false for scroll tables (virtual or infinite): every row renders, no pages. */
	paginate?: boolean;
	/**
	 * Filters and sorts in a Web Worker, from `createDataTableWorker`; for 10K+ rows.
	 * Set once: the table is built around it.
	 */
	worker?: TableWorker;
};

/**
 * A handle for `worker`; keep `new Worker(new URL(...))` in your code so the bundler finds it.
 * Undefined without Worker (SSR), so the table falls back to the main thread.
 */
export function createDataTableWorker(createWorker: () => Worker): TableWorker | undefined {
	if (typeof Worker === "undefined") return undefined;
	return createTableWorker({ createWorker });
}

/** True while a worker-backed sort or filter is computing. */
export function isDataTablePending<TData extends RowData>(table: DataTableInstance<TData>) {
	return Boolean(table.store.get().workerRowModels?.isPending);
}

/** A typed column helper: `dataTableColumns<Person>().accessor("name", {...})`. */
export function dataTableColumns<TData extends RowData>(): ColumnHelper<DataTableFeatures, TData> {
	return createColumnHelper<DataTableFeatures, TData>();
}

/** `reactivity` defaults to plain store atoms; Svelte passes rune-backed ones so reads track. */
export function constructDataTable<TData extends RowData>(
	{ paginate = true, worker, ...options }: DataTableOptions<TData>,
	reactivity: TableReactivityBindings = storeReactivityBindings()
): DataTableInstance<TData> {
	return constructTable({
		columnResizeMode: "onChange",
		globalFilterFn: "includesString",
		...options,
		features: features(paginate, reactivity, worker)
	});
}

/** Pushes new options (data, columns, controlled state) into an existing table. */
export function setDataTableOptions<TData extends RowData>(
	table: DataTableInstance<TData>,
	{ paginate: _, worker: __, ...options }: DataTableOptions<TData>,
	syncState = true
) {
	table_setOptions(table, (prev) => ({ ...prev, ...options }), {
		syncExternalState: syncState
	});
}

/**
 * Calls `onChange` once per microtask after state changes; returns the unsubscribe.
 * Deferred because auto-resets write state while a row model computes mid-render.
 */
export function subscribeDataTable<TData extends RowData>(
	table: DataTableInstance<TData>,
	onChange: () => void
): () => void {
	let queued = false;
	let live = true;
	const subscription = table.store.subscribe(() => {
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			if (live) onChange();
		});
	});
	return () => {
		live = false;
		subscription.unsubscribe();
	};
}

export function columnLabel<TData extends RowData, TValue>(
	column: DataTableColumn<TData, TValue>
): string {
	return column.columnDef.meta?.label ?? column.id;
}

/** Logical inset for a pinned column, so pinning follows the reading direction. */
export function pinnedOffset<TData extends RowData, TValue>(
	column: DataTableColumn<TData, TValue>
): { insetInlineStart?: string; insetInlineEnd?: string } | undefined {
	const side = column.getIsPinned();
	if (side === "start") return { insetInlineStart: `${column.getStart("start")}px` };
	if (side === "end") return { insetInlineEnd: `${column.getAfter("end")}px` };
	return undefined;
}

export function ariaSort<TData extends RowData, TValue>(
	column: DataTableColumn<TData, TValue>
): "ascending" | "descending" | undefined {
	const sorted = column.getIsSorted();
	if (sorted === "asc") return "ascending";
	if (sorted === "desc") return "descending";
	return undefined;
}

/** Unpinned columns move among themselves; pinned ones keep their edge. */
export function canReorderColumn<TData extends RowData, TValue>(
	column: DataTableColumn<TData, TValue>
): boolean {
	return (
		!column.getIsPinned() &&
		column.id !== SELECT_COLUMN.id &&
		column.columnDef.meta?.reorderable !== false
	);
}

export type ColumnDrop = { id: string; side: "before" | "after" };

/** The header under `clientX` and which half of it, read from `th[data-column-id]` cells. */
export function columnDropAt(
	header: HTMLElement,
	clientX: number,
	dragId: string
): ColumnDrop | null {
	const rtl = getComputedStyle(header).direction === "rtl";
	for (const cell of header.querySelectorAll<HTMLElement>("th[data-reorderable]")) {
		const rect = cell.getBoundingClientRect();
		if (clientX < rect.left || clientX > rect.right) continue;
		const id = cell.dataset.columnId;
		if (!id || id === dragId) return null;
		const leading = clientX < rect.left + rect.width / 2 !== rtl;
		return { id, side: leading ? "before" : "after" };
	}
	return null;
}

function columnOrderOf<TData extends RowData>(table: DataTableInstance<TData>): string[] {
	const ids = table.getAllLeafColumns().map((column) => column.id);
	const order = table.store.get().columnOrder ?? [];
	return [...order.filter((id) => ids.includes(id)), ...ids.filter((id) => !order.includes(id))];
}

/** Moves column `id` next to `drop.id` by writing TanStack's `columnOrder`. */
export function moveColumn<TData extends RowData>(
	table: DataTableInstance<TData>,
	id: string,
	drop: ColumnDrop
) {
	const without = columnOrderOf(table).filter((other) => other !== id);
	const at = without.indexOf(drop.id);
	if (at === -1) return;
	without.splice(drop.side === "after" ? at + 1 : at, 0, id);
	table.setColumnOrder(without);
}

/** Keyboard reordering: one step toward the start (-1) or the end (1) among movable columns. */
export function moveColumnBy<TData extends RowData>(
	table: DataTableInstance<TData>,
	id: string,
	step: -1 | 1
) {
	const movable = table.getVisibleLeafColumns().filter((column) => canReorderColumn(column));
	const index = movable.findIndex((column) => column.id === id);
	const neighbour = movable[index + step];
	if (index === -1 || !neighbour) return;
	moveColumn(table, id, { id: neighbour.id, side: step > 0 ? "after" : "before" });
}

/** Shared by both ports' select column: fixed width, never sorted, hidden or resized. */
export const SELECT_COLUMN = {
	id: "select",
	size: 40,
	enableSorting: false,
	enableHiding: false,
	enableResizing: false,
	enableGlobalFilter: false
} as const;

export type DataTableLabels = {
	search: string;
	columns: string;
	toggleColumns: string;
	sortAscending: string;
	sortDescending: string;
	clearSort: string;
	pin: string;
	unpin: string;
	hide: string;
	moveColumn: string;
	rowsPerPage: string;
	firstPage: string;
	previousPage: string;
	nextPage: string;
	lastPage: string;
	selectAll: string;
	selectRow: string;
	loadingMore: string;
	emptyTitle: string;
	emptyDescription: string;
	errorTitle: string;
	retry: string;
};

export const DATA_TABLE_LABELS: DataTableLabels = {
	search: "Search",
	columns: "Columns",
	toggleColumns: "Toggle columns",
	sortAscending: "Sort ascending",
	sortDescending: "Sort descending",
	clearSort: "Clear sort",
	pin: "Pin to start",
	unpin: "Unpin",
	hide: "Hide column",
	moveColumn: "Move column",
	rowsPerPage: "Rows per page",
	firstPage: "First page",
	previousPage: "Previous page",
	nextPage: "Next page",
	lastPage: "Last page",
	selectAll: "Select all rows on this page",
	selectRow: "Select row",
	loadingMore: "Loading more",
	emptyTitle: "No results",
	emptyDescription: "Nothing matches the current search or filters.",
	errorTitle: "Couldn't load rows",
	retry: "Try again"
};

/** The message to show for a failed load, if the error carries one. */
export function statusMessage(error: unknown): string | undefined {
	if (error instanceof Error) return error.message;
	return typeof error === "string" && error ? error : undefined;
}

export function hasError(error: unknown): boolean {
	return error !== undefined && error !== null && error !== false;
}

/** "1-20 of 10,000", or "0 of 0" when empty. */
export function rangeLabel(pageIndex: number, pageSize: number, total: number): string {
	const fmt = new Intl.NumberFormat();
	if (total === 0) return "0 of 0";
	const start = pageIndex * pageSize + 1;
	const end = Math.min(total, start + pageSize - 1);
	return `${fmt.format(start)}-${fmt.format(end)} of ${fmt.format(total)}`;
}

/** 24px stroke icons shared by both ports, so the parts need no icon package. */
export const DATA_TABLE_ICONS = {
	sortAsc: "M12 19V5m-6 6 6-6 6 6",
	sortDesc: "M12 5v14m6-6-6 6-6-6",
	unsorted: "m7 15 5 5 5-5M7 9l5-5 5 5",
	chevronLeft: "m15 6-6 6 6 6",
	chevronRight: "m9 6 6 6-6 6",
	chevronsLeft: "m11 7-5 5 5 5m7-10-5 5 5 5",
	chevronsRight: "m7 7 5 5-5 5m6-10 5 5-5 5",
	search: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm11 4-6-6",
	columns: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm5.5-2v16m5-16v16",
	pin: "m15 4.5-4 4L7 10l-1.5 1.5 7 7L14 17l1.5-4 4-4M9 15l-4.5 4.5M14.5 4 20 9.5",
	hide: "m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.7 9.7 0 0 1 12 5c4 0 7.3 2.3 9 7a12.5 12.5 0 0 1-2.2 3.3M6.6 6.6A12.5 12.5 0 0 0 3 12c1.7 4.7 5 7 9 7a9.6 9.6 0 0 0 5.4-1.6",
	alert:
		"M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
	inbox:
		"M4 13h3l3 3h4l3-3h3M4 13l2.6-7.2A2 2 0 0 1 8.5 4.5h7a2 2 0 0 1 1.9 1.3L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z",
	grip: "M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01"
} as const;

export type RowVirtualizerOptions = {
	count: number;
	estimateSize: number;
	overscan: number;
	/** Pixels above the first row inside the scroll element: the sticky header. */
	scrollMargin: number;
};

/** Window height assumed before the scroll element is measured. */
const INITIAL_RECT = { width: 0, height: 480 };

/**
 * Windowed rows. Create it before the first render, so that render already holds a window
 * of rows rather than all of them; `attach` once the scroll element is in the DOM.
 */
export function createRowVirtualizer(
	getScrollElement: () => HTMLElement | null,
	options: RowVirtualizerOptions,
	onChange: () => void
) {
	const virtualizer = new Virtualizer<HTMLElement, HTMLTableRowElement>({
		count: options.count,
		getScrollElement,
		estimateSize: () => options.estimateSize,
		overscan: options.overscan,
		scrollMargin: options.scrollMargin,
		initialRect: INITIAL_RECT,
		observeElementRect,
		observeElementOffset,
		scrollToFn: elementScroll,
		onChange: () => onChange()
	});
	return {
		virtualizer,
		/** Starts observing the scroll element; returns the cleanup. */
		attach(): () => void {
			const cleanup = virtualizer._didMount();
			virtualizer._willUpdate();
			return cleanup;
		},
		/** Safe during render: only replaces options. Call `sync` after the DOM updates. */
		setOptions(next: RowVirtualizerOptions) {
			virtualizer.setOptions({
				...virtualizer.options,
				count: next.count,
				estimateSize: () => next.estimateSize,
				overscan: next.overscan,
				scrollMargin: next.scrollMargin
			});
		},
		sync() {
			virtualizer._willUpdate();
		}
	};
}

export type RowVirtualizerHandle = ReturnType<typeof createRowVirtualizer>;

/** Spacer heights above and below the rendered window. */
export function virtualPadding(handle: RowVirtualizerHandle): {
	top: number;
	bottom: number;
} {
	const items = handle.virtualizer.getVirtualItems();
	const first = items[0];
	const last = items[items.length - 1];
	if (!first || !last) return { top: 0, bottom: 0 };
	const margin = handle.virtualizer.options.scrollMargin;
	return {
		top: first.start - margin,
		bottom: handle.virtualizer.getTotalSize() - (last.end - margin)
	};
}

/**
 * The element rows scroll in: the table's container when it caps its own height, else null
 * for the viewport. An uncapped container always "contains" its last row, so it can't be the root.
 */
export function scrollRootFor(container: HTMLElement | null | undefined): HTMLElement | null {
	if (!container) return null;
	const capped = getComputedStyle(container).maxHeight !== "none";
	return capped || container.scrollHeight > container.clientHeight ? container : null;
}

/** Fires `onNear` when `sentinel` comes within `margin` px of the scroll element's end. */
export function observeNearEnd(
	root: HTMLElement | null,
	sentinel: Element,
	onNear: () => void,
	margin = 240
): () => void {
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries.some((entry) => entry.isIntersecting)) onNear();
		},
		{ root, rootMargin: `0px 0px ${margin}px 0px` }
	);
	observer.observe(sentinel);
	return () => observer.disconnect();
}

export function debounce<TArgs extends unknown[]>(fn: (...args: TArgs) => void, ms: number) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return {
		call(...args: TArgs) {
			clearTimeout(timer);
			timer = setTimeout(() => fn(...args), ms);
		},
		cancel() {
			clearTimeout(timer);
		}
	};
}
