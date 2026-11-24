<script lang="ts">
	import { untrack } from "svelte";
	import { toDate } from "../../charts/chart/core.js";
	import { cn } from "../../../lib/cn.js";
	import RollingDigits from "../../text/rolling-digits/rolling-digits.svelte";
	import Skeleton from "../../ui/skeleton/skeleton.svelte";
	import { statCardState } from "./context";

	let { class: classProp }: { class?: string } = $props();
	const card = statCardState();

	const datum = $derived(card.activeIndex !== null ? card.data[card.activeIndex] : undefined);
	const shownValue = $derived.by(() => {
		const hovered = datum?.[card.dataKey];
		return typeof hovered === "number" ? hovered : card.value;
	});

	// The headline counts only when `value` itself changes; hovering the chart swaps instantly.
	let settled = $state(untrack(() => card.value));
	$effect(() => {
		const next = card.value;
		const id = setTimeout(() => (settled = next), 450);
		return () => clearTimeout(id);
	});

	// Announce a new resting value, not the first render and not every hovered point.
	let announced = $state("");
	let first = true;
	$effect(() => {
		const text = `${card.name} ${card.number(card.value)}`;
		if (first) {
			first = false;
			return;
		}
		announced = text;
	});
</script>

<!-- The headline and its caption: the resting value, or the hovered point's. -->
{#if card.status === "loading"}
	<div data-slot="stat-card-value" class={cn(card.styles.headline(), classProp)} aria-busy="true">
		<Skeleton class="h-7 w-28" />
		<Skeleton class="h-3 w-20" />
	</div>
{:else if card.status === "ready"}
	<div data-slot="stat-card-value" class={cn(card.styles.headline(), classProp)}>
		<RollingDigits
			variant="count"
			value={shownValue}
			format={card.number}
			size="sm"
			durationMs={card.activeIndex === null && card.value !== settled ? 400 : 0}
			startOnView={false}
			class="font-bold text-foreground"
		/>
		<span class={card.styles.label()}>
			{datum ? card.formatLabel(toDate(datum[card.xKey])) : card.label}
		</span>
		<span class={card.styles.srOnly()} aria-live="polite">{announced}</span>
	</div>
{/if}
