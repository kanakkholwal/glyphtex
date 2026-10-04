<script lang="ts">
	import { TableOfContents, type TocItem } from "@glyphtex/ui/table-of-contents";

	type Heading = { depth: number; text: string; id: string };
	type Props = { headings: readonly Heading[] };

	let { headings }: Props = $props();

	const items = $derived(
		headings.flatMap((h): TocItem[] =>
			h.depth === 2 || h.depth === 3 ? [{ id: h.id, label: h.text, depth: h.depth }] : []
		)
	);
</script>

{#if items.length > 2}
	<!-- 80px clears the 64px sticky site header with a little air. -->
	<TableOfContents {items} scrollOffset={80} />
{/if}
