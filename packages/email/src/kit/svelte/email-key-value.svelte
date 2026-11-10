<script lang="ts">
	import { Column, Row, Section } from "@better-svelte-email/components";
	import { cn } from "../../lib/cn";
	import { type EmailKeyValueDensity, emailKeyValue } from "../variants";

	export interface EmailKeyValueRow {
		label: string;
		value: string;
	}

	let {
		rows,
		total,
		density = "comfortable"
	}: {
		rows: EmailKeyValueRow[];
		/** Emphasised last row with a rule above it, e.g. an order total. */
		total?: EmailKeyValueRow;
		density?: EmailKeyValueDensity;
	} = $props();

	const s = $derived(emailKeyValue({ density }));
</script>

<Section>
	{#each rows as row (row.label)}
		<Row>
			<Column class={s.label()}>{row.label}</Column>
			<Column class={s.value()}>{row.value}</Column>
		</Row>
	{/each}
	{#if total}
		<Row>
			<Column class={cn(s.label(), s.total())}>{total.label}</Column>
			<Column class={cn(s.value(), s.total())}>{total.value}</Column>
		</Row>
	{/if}
</Section>
