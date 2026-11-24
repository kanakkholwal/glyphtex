<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "../../../lib/cn.js";
	import type { TableVariant } from "../table/variants.js";
	import { DATA_TABLE_LABELS, type DataTableLabels } from "./core";
	import { type DataTableDensity, dataTable } from "./variants";
	import { setDataTableStatus } from "./context";

	let {
		loading = false,
		fetching = false,
		error,
		onretry,
		hasMore = false,
		onloadmore,
		variant = "default",
		density = "comfortable",
		labels,
		class: classProp,
		children,
		...rest
	}: {
		/** First load with no rows yet: the body shows skeleton rows. */
		loading?: boolean;
		/** A refetch or next page with rows on screen: a top progress bar, dimmed rows. */
		fetching?: boolean;
		/** Any truthy value shows the error state; an Error or string supplies its message. */
		error?: unknown;
		onretry?: () => void;
		/** Infinite loading: `onloadmore` fires as the last row nears view while `hasMore`. */
		hasMore?: boolean;
		onloadmore?: () => void;
		variant?: TableVariant;
		density?: DataTableDensity;
		labels?: Partial<DataTableLabels>;
		class?: string;
		children?: Snippet;
	} & Omit<HTMLAttributes<HTMLDivElement>, "class" | "children"> = $props();

	setDataTableStatus(() => ({
		loading,
		fetching,
		error,
		onretry,
		hasMore,
		onloadmore,
		variant,
		density,
		labels: { ...DATA_TABLE_LABELS, ...labels }
	}));
</script>

<div
	{...rest}
	data-slot="data-table"
	aria-busy={loading || fetching || undefined}
	class={cn(dataTable().root(), classProp)}
>
	{@render children?.()}
</div>
