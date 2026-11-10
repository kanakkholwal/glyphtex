<script lang="ts">
	import { Column, Row, Section, Text } from "@better-svelte-email/components";
	import {
		EMAIL_STAT_TREND_GLYPH,
		type EmailStatsColumns,
		type EmailStatsTone,
		type EmailStatsTrend,
		emailStats
	} from "../variants";

	export interface EmailStat {
		/** Pre-formatted, e.g. "1,284" or "$12.4k". */
		value: string;
		label: string;
		/** Change or context in words, e.g. "Up 12% vs last week"; colour never carries it alone. */
		note?: string;
		/** Prefixes `note` with an arrow, tinted in dark mode. */
		trend?: EmailStatsTrend;
	}

	/** Headline numbers in a grid of cards, `columns` per row. */
	let {
		items,
		columns = 3,
		tone = "neutral"
	}: { items: EmailStat[]; columns?: EmailStatsColumns; tone?: EmailStatsTone } = $props();

	const s = $derived(emailStats({ columns, tone }));
	const rows = $derived.by(() => {
		const out: EmailStat[][] = [];
		for (let i = 0; i < items.length; i += columns) out.push(items.slice(i, i + columns));
		return out;
	});
</script>

<Section>
	{#each rows as row, r (row.map((item) => item.label).join("|"))}
		<Section>
			{#if r > 0}<Section class={s.rowGap()}>{""}</Section>{/if}
			<Row>
				{#each row as item, i (item.label)}
					{#if i > 0}<Column class={s.gap()}></Column>{/if}
					<Column class={s.cell()}>
						<Section class={s.card()}>
							<Text class={s.value()}>{item.value}</Text>
							<Text class={s.label()}>{item.label}</Text>
							{#if item.note}<Text class={s.note({ trend: item.trend })}>{item.trend ? EMAIL_STAT_TREND_GLYPH[item.trend] : ""}{item.note}</Text>{/if}
						</Section>
					</Column>
				{/each}
			</Row>
		</Section>
	{/each}
</Section>
