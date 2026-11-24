<script lang="ts">
	import Badge from "../../ui/badge/badge.svelte";
	import CardAction from "../../ui/card/card-action.svelte";
	import Skeleton from "../../ui/skeleton/skeleton.svelte";
	import { periodTrend, trendPath, trendSentence, trendTone } from "./variants";
	import { statCardState } from "./context";

	let { class: classProp }: { class?: string } = $props();
	const card = statCardState();

	const percent = $derived(
		new Intl.NumberFormat(card.locale, {
			style: "percent",
			maximumFractionDigits: 1,
			signDisplay: "exceptZero"
		})
	);
	const shown = $derived(
		(card.activeIndex !== null ? periodTrend(card.data, card.activeIndex, card.dataKey) : null) ??
			card.trend
	);
</script>

<!-- The trend badge; follows the hovered point, with a sentence for screen readers. -->
<CardAction class={classProp}>
	{#if card.status === "loading"}
		<Skeleton class="h-5 w-14 rounded-full" />
	{:else if card.status === "ready"}
		<Badge variant={trendTone(shown, card.positive)} size="sm" class="tabular-nums">
			<svg aria-hidden="true" viewBox="0 0 12 12" class="size-3" fill="none">
				<path
					d={trendPath(shown)}
					stroke="currentColor"
					stroke-width={1.5}
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			<span aria-hidden="true">{percent.format(shown / 100)}</span>
			<span class={card.styles.srOnly()}>
				{trendSentence(shown, percent.format(Math.abs(shown) / 100), card.comparisonLabel)}
			</span>
		</Badge>
	{/if}
</CardAction>
