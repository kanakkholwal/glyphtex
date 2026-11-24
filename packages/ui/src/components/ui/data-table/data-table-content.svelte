<script lang="ts" generics="TData extends RowData">
	import type { RowData } from "@tanstack/table-core";
	import { type Snippet, untrack } from "svelte";
	import type { HTMLTableAttributes } from "svelte/elements";
	import Button from "../button/button.svelte";
	import Empty from "../empty/empty.svelte";
	import EmptyContent from "../empty/empty-content.svelte";
	import EmptyDescription from "../empty/empty-description.svelte";
	import EmptyHeader from "../empty/empty-header.svelte";
	import EmptyMedia from "../empty/empty-media.svelte";
	import EmptyTitle from "../empty/empty-title.svelte";
	import { cn } from "../../../lib/cn.js";
	import Skeleton from "../skeleton/skeleton.svelte";
	import Spinner from "../spinner/spinner.svelte";
	import Table from "../table/table.svelte";
	import TableBody from "../table/table-body.svelte";
	import TableCell from "../table/table-cell.svelte";
	import TableHead from "../table/table-head.svelte";
	import TableHeader from "../table/table-header.svelte";
	import TableRow from "../table/table-row.svelte";
	import {
		ariaSort,
		type ColumnDrop,
		canReorderColumn,
		columnDropAt,
		columnLabel,
		createRowVirtualizer,
		DATA_TABLE_ICONS,
		type DataTableColumn,
		type DataTableInstance,
		type DataTableRow,
		hasError,
		isDataTablePending,
		moveColumn,
		moveColumnBy,
		observeNearEnd,
		pinnedOffset,
		scrollRootFor,
		statusMessage,
		virtualPadding
	} from "./core";
	import { DATA_TABLE_ALIGN, DATA_TABLE_ROW_ESTIMATE, dataTable } from "./variants";
	import { getDataTableStatus } from "./context";
	import Icon from "./data-table-icon.svelte";
	import Render from "./data-table-render.svelte";

	let {
		table,
		virtualize = false,
		overscan = 8,
		estimateRowHeight,
		containerClass,
		rowClass,
		skeletonRows = 8,
		empty,
		reorderable = true,
		class: classProp,
		...rest
	}: {
		table: DataTableInstance<TData>;
		/** Render only the rows in view; pair with `paginate: false` and a max height. */
		virtualize?: boolean;
		overscan?: number;
		/** First guess at a row's height in px; rows are measured once rendered. */
		estimateRowHeight?: number;
		/** The scroll container: set a max height here to scroll rows under a sticky header. */
		containerClass?: string;
		rowClass?: string | ((row: DataTableRow<TData>) => string | undefined);
		skeletonRows?: number;
		/** Replaces the default empty state. */
		empty?: Snippet;
		/** Drag a header's grip, or press its arrows, to move unpinned columns. */
		reorderable?: boolean;
		class?: string;
	} & Omit<HTMLTableAttributes, "class" | "children"> = $props();

	const status = getDataTableStatus();
	const s = $derived(status());
	const styles = $derived(dataTable({ density: s.density }));

	let tableEl = $state<HTMLTableElement | null>(null);
	let headerEl = $state<HTMLTableSectionElement | null>(null);
	let sentinel = $state<HTMLTableRowElement | null>(null);
	let tick = $state(0);

	const rows = $derived(table.getRowModel().rows);
	const columns = $derived(table.getVisibleLeafColumns());
	const estimate = $derived(estimateRowHeight ?? DATA_TABLE_ROW_ESTIMATE[s.density]);
	const failed = $derived(hasError(s.error));
	const showSkeleton = $derived(s.loading && rows.length === 0 && !failed);
	const showEmpty = $derived(!s.loading && !failed && rows.length === 0);
	const canLoadMore = $derived(Boolean(s.onloadmore) && !failed && rows.length > 0);
	// A worker-backed sort or filter in flight shows the same bar as a refetch.
	const busy = $derived((s.fetching || s.loading || isDataTablePending(table)) && rows.length > 0);

	const windowOptions = $derived({
		count: rows.length,
		estimateSize: estimate,
		overscan,
		scrollMargin: headerEl?.offsetHeight ?? 0
	});
	// Built at init, so the first render already holds a window, never every row.
	const virtual = createRowVirtualizer(
		// Table's own container is the scroll element.
		() => tableEl?.closest<HTMLElement>("[data-slot=table-container]") ?? null,
		untrack(() => windowOptions),
		() => tick++
	);
	const handle = $derived(virtualize ? virtual : null);

	$effect(() => {
		if (!virtualize || !tableEl) return;
		return virtual.attach();
	});

	$effect(() => {
		virtual.setOptions(windowOptions);
		if (!virtualize) return;
		virtual.sync();
		untrack(() => tick++);
	});

	const view = $derived.by(() => {
		tick;
		windowOptions;
		if (!handle) return { items: null, padding: { top: 0, bottom: 0 } };
		// Plain options, not state: the window must see the new row count in this same pass.
		handle.setOptions(windowOptions);
		return { items: handle.virtualizer.getVirtualItems(), padding: virtualPadding(handle) };
	});
	const visible = $derived(
		view.items
			? view.items.flatMap((item) => {
					const row = rows[item.index];
					return row ? [{ row, index: item.index }] : [];
				})
			: rows.map((row, index) => ({ row, index }))
	);

	const armed = $derived(canLoadMore && s.hasMore && !s.fetching && !s.loading);
	// Re-armed after every page, so a page too short to fill the view loads the next at once.
	$effect(() => {
		rows.length;
		if (!armed || !sentinel) return;
		const root = scrollRootFor(tableEl?.closest<HTMLElement>("[data-slot=table-container]"));
		return observeNearEnd(root, sentinel, () => status().onloadmore?.());
	});

	function measure(node: HTMLTableRowElement) {
		handle?.virtualizer.measureElement(node);
	}

	function offsetCss(column: DataTableColumn<TData>): string {
		const offset = pinnedOffset(column);
		if (offset?.insetInlineStart) return `inset-inline-start: ${offset.insetInlineStart};`;
		if (offset?.insetInlineEnd) return `inset-inline-end: ${offset.insetInlineEnd};`;
		return "";
	}

	let drag = $state<{ id: string; drop: ColumnDrop | null } | null>(null);

	function dragTo(event: PointerEvent) {
		if (!drag || !headerEl) return;
		drag = { id: drag.id, drop: columnDropAt(headerEl, event.clientX, drag.id) };
	}

	function dragEnd(commit: boolean) {
		if (commit && drag?.drop) moveColumn(table, drag.id, drag.drop);
		drag = null;
	}

	function moveByKey(
		column: DataTableColumn<TData>,
		event: KeyboardEvent & { currentTarget: HTMLElement }
	) {
		if (event.key === "Escape" && drag) return dragEnd(false);
		const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
		const forward = rtl ? "ArrowLeft" : "ArrowRight";
		const back = rtl ? "ArrowRight" : "ArrowLeft";
		if (event.key !== forward && event.key !== back) return;
		event.preventDefault();
		moveColumnBy(table, column.id, event.key === forward ? 1 : -1);
	}

	function resizeByKey(column: DataTableColumn<TData>, event: KeyboardEvent) {
		const step = event.key === "ArrowRight" ? 16 : event.key === "ArrowLeft" ? -16 : 0;
		if (!step) return;
		event.preventDefault();
		table.setColumnSizing((sizing) => ({
			...sizing,
			[column.id]: Math.max(column.columnDef.minSize ?? 40, column.getSize() + step)
		}));
	}

	function rowClassFor(row: DataTableRow<TData>) {
		return typeof rowClass === "function" ? rowClass(row) : rowClass;
	}
</script>

<div data-slot="data-table-content" data-fetching={busy} class={styles.frame()}>
	{#if busy}
		<span aria-hidden="true" class={styles.progress()}>
			<span class={styles.progressBar()}></span>
		</span>
	{/if}
	<Table
		{...rest}
		bind:ref={tableEl}
		variant={s.variant}
		density={s.density}
		containerClass={cn(styles.viewport(), containerClass)}
		class={cn(styles.table(), classProp)}
		style="width: {table.getTotalSize()}px; min-width: 100%;"
	>
		<TableHeader bind:ref={headerEl} class={styles.header()}>
			{#each table.getHeaderGroups() as group (group.id)}
				<TableRow class="hover:bg-transparent">
					{#each group.headers as header (header.id)}
						{@const column = header.column}
						{@const meta = column.columnDef.meta}
						{@const pinned = column.getIsPinned()}
						{@const movable = reorderable && !header.isPlaceholder && canReorderColumn(column)}
						{@const dragging = drag?.id === column.id}
						<TableHead
							colspan={header.colSpan}
							aria-sort={ariaSort(column)}
							data-column-id={column.id}
							data-reorderable={movable || undefined}
							data-pinned={pinned || undefined}
							data-dragging={dragging || undefined}
							data-drop={drag?.drop?.id === column.id ? drag.drop.side : undefined}
							style="width: {header.getSize()}px; {offsetCss(column)}"
							class={cn(
								styles.head(),
								pinned && styles.pinnedHead(),
								DATA_TABLE_ALIGN[meta?.align ?? "start"],
								meta?.headClassName,
							)}
						>
							<div class={styles.headInner()}>
								{#if movable}
									<button
										type="button"
										aria-label="{s.labels.moveColumn}: {columnLabel(column)}"
										data-dragging={dragging || undefined}
										onpointerdown={(event) => {
											event.currentTarget.setPointerCapture(event.pointerId);
											drag = { id: column.id, drop: null };
										}}
										onpointermove={dragTo}
										onpointerup={() => dragEnd(true)}
										onpointercancel={() => dragEnd(false)}
										onkeydown={(event) => moveByKey(column, event)}
										class={styles.grip()}
									>
										<Icon d={DATA_TABLE_ICONS.grip} class={styles.icon()} />
									</button>
								{/if}
								{#if !header.isPlaceholder}
									<Render content={column.columnDef.header} context={header.getContext()} />
								{/if}
							</div>
							{#if column.getCanResize()}
								<!-- A focusable separator is the ARIA window-splitter pattern; arrows resize it. -->
								<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
								<div
									role="separator"
									aria-orientation="vertical"
									aria-label="Resize {columnLabel(column)}"
									aria-valuenow={column.getSize()}
									tabindex="0"
									data-resizing={column.getIsResizing()}
									onmousedown={header.getResizeHandler()}
									ontouchstart={header.getResizeHandler()}
									ondblclick={() => column.resetSize()}
									onkeydown={(event) => resizeByKey(column, event)}
									class={styles.resizer()}
								></div>
							{/if}
						</TableHead>
					{/each}
				</TableRow>
			{/each}
		</TableHeader>
		<TableBody>
			{#if view.padding.top > 0}
				<tr aria-hidden="true">
					<td colspan={columns.length} class={styles.spacer()} style="height: {view.padding.top}px"></td>
				</tr>
			{/if}
			{#each visible as { row, index } (row.id)}
				<TableRow
					data-index={index}
					data-state={row.getIsSelected() ? "selected" : undefined}
					class={cn(styles.row(), rowClassFor(row))}
					{@attach measure}
				>
					{#each row.getVisibleCells() as cell (cell.id)}
						{@const meta = cell.column.columnDef.meta}
						{@const pinned = cell.column.getIsPinned()}
						<TableCell
							data-pinned={pinned || undefined}
							style={offsetCss(cell.column)}
							class={cn(
								styles.cell(),
								pinned && styles.pinnedCell(),
								DATA_TABLE_ALIGN[meta?.align ?? "start"],
								meta?.cellClassName,
							)}
						>
							<Render content={cell.column.columnDef.cell} context={cell.getContext()} />
						</TableCell>
					{/each}
				</TableRow>
			{/each}
			{#if view.padding.bottom > 0}
				<tr aria-hidden="true">
					<td colspan={columns.length} class={styles.spacer()} style="height: {view.padding.bottom}px"></td>
				</tr>
			{/if}
			{#if showSkeleton}
				{#each { length: skeletonRows }, i (i)}
					<TableRow aria-hidden="true" class="hover:bg-transparent">
						{#each columns as column (column.id)}
							<TableCell><Skeleton class={styles.skeleton()} /></TableCell>
						{/each}
					</TableRow>
				{/each}
			{/if}
			{#if failed || showEmpty}
				<TableRow class={styles.status()}>
					<TableCell colspan={columns.length} class={styles.status()}>
						{#if failed}
							<Empty role="alert" variant="default" size="sm">
								<EmptyHeader>
									<EmptyMedia variant="icon" tone="destructive">
										<Icon d={DATA_TABLE_ICONS.alert} />
									</EmptyMedia>
									<EmptyTitle>{s.labels.errorTitle}</EmptyTitle>
									{#if statusMessage(s.error)}
										<EmptyDescription>{statusMessage(s.error)}</EmptyDescription>
									{/if}
								</EmptyHeader>
								{#if s.onretry}
									<EmptyContent>
										<Button size="sm" variant="outline" onclick={s.onretry}>{s.labels.retry}</Button>
									</EmptyContent>
								{/if}
							</Empty>
						{:else if empty}
							{@render empty()}
						{:else}
							<Empty variant="default" size="sm">
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<Icon d={DATA_TABLE_ICONS.inbox} />
									</EmptyMedia>
									<EmptyTitle>{s.labels.emptyTitle}</EmptyTitle>
									<EmptyDescription>{s.labels.emptyDescription}</EmptyDescription>
								</EmptyHeader>
							</Empty>
						{/if}
					</TableCell>
				</TableRow>
			{/if}
			{#if canLoadMore && (s.hasMore || s.fetching)}
				<TableRow bind:ref={sentinel} class={styles.loadMore()}>
					<TableCell colspan={columns.length} class={styles.loadMore()}>
						{#if s.fetching}
							<span role="status" class={styles.loadMoreInner()}>
								<Spinner size="sm" label={s.labels.loadingMore} />
								{s.labels.loadingMore}
							</span>
						{/if}
					</TableCell>
				</TableRow>
			{/if}
		</TableBody>
	</Table>
</div>
