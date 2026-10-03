<script lang="ts">
	import { TableOfContents, type TocItem } from "@glyphtex/ui/table-of-contents";

	type Heading = { depth: number; text: string; id: string };
	type Props = { headings: readonly Heading[] };

	let { headings }: Props = $props();

	const items = $derived(
		headings
			.filter((h) => h.depth === 2 || h.depth === 3)
			.map((h): TocItem => ({ id: h.id, label: h.text, depth: h.depth as 2 | 3 }))
	);
</script>

{#if items.length > 2}
	<TableOfContents {items} scrollOffset={88} />
{/if}
