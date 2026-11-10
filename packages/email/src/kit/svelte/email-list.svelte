<script lang="ts">
	import { Column, Img, Row, Section, Text } from "@better-svelte-email/components";
	import { type EmailListMarker, emailList } from "../variants";

	export interface EmailListItem {
		title?: string;
		text: string;
		/** Absolute URL of a 20px icon; used when `marker` is "icon". */
		iconUrl?: string;
	}

	/** A list with a marker per row: numbered steps, check marks, dots or your own icons. */
	let { items, marker = "number" }: { items: EmailListItem[]; marker?: EmailListMarker } = $props();

	const s = $derived(emailList({ marker }));
</script>

<Section>
	{#each items as item, i (`${item.title ?? ""}-${item.text}`)}
		<Row>
			<Column class={s.markerCell()}>
				{#if marker === "icon" && item.iconUrl}
					<Img src={item.iconUrl} alt="" width="20" height="20" class={s.icon()} />
				{:else}
					<Text class={s.marker()}>{marker === "number" ? i + 1 : marker === "check" ? "✓" : "•"}</Text>
				{/if}
			</Column>
			<Column class={s.body()}>
				{#if item.title}<Text class={s.title()}>{item.title}</Text>{/if}
				<Text class={s.text()}>{item.text}</Text>
			</Column>
		</Row>
	{/each}
</Section>
