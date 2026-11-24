import { tv, type VariantProps } from "tailwind-variants";

/** Layered on Table's own slots: DataTableContent renders Table parts with these added. */
export const dataTable = tv({
	slots: {
		root: "flex min-w-0 flex-col gap-3",
		toolbar: "flex flex-wrap items-center gap-2",
		search: "w-full sm:w-64",
		// A refetch dims the current rows instead of blanking them.
		frame:
			"relative min-w-0 [&_tbody]:transition-opacity [&_tbody]:duration-(--duration-base) data-[fetching=true]:[&_tbody]:opacity-60",
		// The Table container becomes the scroll element; give it a max height to scroll rows.
		viewport: "overflow-auto overscroll-contain",
		table: "table-fixed",
		// Sticky header: a collapsed border would scroll away, so the rule is an inset shadow.
		header: "sticky top-0 z-10 [&_th]:bg-card [&_th]:shadow-[inset_0_-1px_0_var(--border)]",
		head: [
			"group/head relative overflow-hidden text-ellipsis whitespace-nowrap transition-opacity",
			// The drop line is an inset shadow, kept beside the sticky header's bottom rule.
			"data-[drop=before]:shadow-[inset_2px_0_0_var(--primary),inset_0_-1px_0_var(--border)]",
			"data-[drop=after]:shadow-[inset_-2px_0_0_var(--primary),inset_0_-1px_0_var(--border)]",
			"data-[dragging=true]:opacity-50"
		],
		headInner: "flex min-w-0 items-center gap-0.5",
		grip: [
			"-ms-1.5 grid h-6 w-4 shrink-0 cursor-grab touch-none select-none place-items-center rounded-md text-muted-foreground/70",
			"opacity-0 outline-none transition-opacity duration-(--duration-fast) group-hover/head:opacity-100 [@media(hover:none)]:opacity-100",
			"hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
			"active:cursor-grabbing data-[dragging=true]:opacity-100"
		],
		sortTrigger:
			"-ms-2 max-w-full gap-1 px-2 text-muted-foreground hover:text-foreground data-[popup-open]:bg-accent data-[state=open]:bg-accent",
		sortLabel: "truncate",
		icon: "size-3.5 shrink-0",
		resizer: [
			"absolute inset-y-0 end-0 z-[2] w-2 cursor-col-resize touch-none select-none",
			"after:absolute after:inset-y-2 after:end-0 after:w-px after:bg-border after:transition-colors after:duration-(--duration-fast)",
			"hover:after:bg-primary data-[resizing=true]:after:inset-y-0 data-[resizing=true]:after:bg-primary"
		],
		row: "group/row",
		cell: "overflow-hidden text-ellipsis whitespace-nowrap",
		// Pinned cells need a solid fill to cover the columns scrolling beneath them.
		pinnedHead: "sticky z-[11]",
		pinnedCell: [
			"sticky z-[1] bg-background",
			"group-hover/row:bg-[color-mix(in_oklch,var(--foreground)_6%,var(--background))]",
			"group-data-[state=selected]/row:bg-[color-mix(in_oklch,var(--primary)_4%,var(--background))]",
			"data-[pinned=start]:shadow-[inset_-1px_0_0_var(--border)] data-[pinned=end]:shadow-[inset_1px_0_0_var(--border)]"
		],
		spacer: "border-0 p-0",
		status: "p-0 hover:bg-transparent",
		skeleton: "h-3 w-[72%] max-w-40",
		loadMore: "text-center text-muted-foreground text-xs hover:bg-transparent",
		loadMoreInner: "inline-flex items-center gap-2",
		progress:
			"pointer-events-none absolute inset-x-px top-px z-20 h-0.5 overflow-hidden rounded-full",
		progressBar:
			"block h-full w-2/5 rounded-full bg-primary animate-[data-table-progress_1.2s_var(--ease-smooth)_infinite] motion-reduce:w-full motion-reduce:animate-pulse",
		footer:
			"flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-muted-foreground text-xs",
		selection: "tabular-nums",
		pageSize: "flex items-center gap-2",
		pageSizeTrigger: "h-8 w-[4.75rem]",
		pageInfo: "tabular-nums",
		pageNav: "flex items-center gap-1",
		viewTrigger: "ms-auto gap-1.5"
	},
	variants: {
		density: {
			comfortable: { status: "h-64", loadMore: "h-12" },
			compact: { status: "h-48", loadMore: "h-9" }
		}
	},
	defaultVariants: { density: "comfortable" }
});

export type DataTableDensity = NonNullable<VariantProps<typeof dataTable>["density"]>;

export const DATA_TABLE_ALIGN: Record<"start" | "center" | "end", string> = {
	start: "text-start",
	center: "text-center",
	end: "text-end"
};

/** Rendered row height per density, the virtualizer's first guess before it measures. */
export const DATA_TABLE_ROW_ESTIMATE: Record<DataTableDensity, number> = {
	comfortable: 37,
	compact: 29
};
