<script lang="ts" generics="TData extends RowData">
	import type { RowData } from "@tanstack/table-core";
	import { untrack } from "svelte";
	import InputGroup from "../input-group/input-group.svelte";
	import InputGroupAddon from "../input-group/input-group-addon.svelte";
	import InputGroupInput from "../input-group/input-group-input.svelte";
	import { cn } from "../../../lib/cn.js";
	import { DATA_TABLE_ICONS, type DataTableInstance, debounce } from "./core";
	import { dataTable } from "./variants";
	import { getDataTableStatus } from "./context";
	import Icon from "./data-table-icon.svelte";

	let {
		table,
		placeholder,
		debounceMs = 200,
		class: classProp
	}: {
		table: DataTableInstance<TData>;
		placeholder?: string;
		/** Typing settles this long before the filter runs, so 10K rows never filter per key. */
		debounceMs?: number;
		class?: string;
	} = $props();

	const status = getDataTableStatus();
	// Seeded once: the input owns its text, the table only hears it after the debounce.
	let value = $state(untrack(() => String(table.store.get().globalFilter ?? "")));
	const apply = debounce(
		(next: string) => table.setGlobalFilter(next),
		untrack(() => debounceMs)
	);

	$effect(() => () => apply.cancel());
</script>

<!-- Drives the global filter; with `manualFiltering` your server reads `globalFilter`. -->
<InputGroup data-slot="data-table-search" class={cn(dataTable().search(), classProp)}>
	<InputGroupAddon>
		<Icon d={DATA_TABLE_ICONS.search} />
	</InputGroupAddon>
	<InputGroupInput
		type="search"
		aria-label={status().labels.search}
		placeholder={placeholder ?? `${status().labels.search}…`}
		bind:value={() => value, (next) => {
			value = next;
			apply.call(next);
		}}
	/>
</InputGroup>
