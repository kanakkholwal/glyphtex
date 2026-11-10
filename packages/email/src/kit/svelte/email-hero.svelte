<script lang="ts">
	import { Column, Heading, Img, Row, Section, Text } from "@better-svelte-email/components";
	import {
		type EmailHeroAlign,
		type EmailHeroSize,
		type EmailHeroTone,
		emailHero
	} from "../variants";

	/** A tinted opening panel: eyebrow and date, a large headline, a line of text and an image. */
	let {
		title,
		text,
		eyebrow,
		meta,
		imageUrl,
		imageAlt,
		tone = "muted",
		size = "display",
		align = "left"
	}: {
		title: string;
		text?: string;
		/** Small label top left, e.g. "Security" or "Order NW-58213". */
		eyebrow?: string;
		/** Small text top right, e.g. a pre-formatted date. */
		meta?: string;
		/** Absolute URL of an illustration or photo shown under the text. */
		imageUrl?: string;
		imageAlt?: string;
		tone?: EmailHeroTone;
		size?: EmailHeroSize;
		align?: EmailHeroAlign;
	} = $props();

	const s = $derived(emailHero({ tone, size, align }));
</script>

<Section class={s.root()}>
	{#if eyebrow || meta}
		<Row>
			<Column><Text class={s.eyebrow()}>{eyebrow ?? ""}</Text></Column>
			<Column><Text class={s.meta()}>{meta ?? ""}</Text></Column>
		</Row>
	{/if}
	<Heading as="h1" class={s.title()}>{title}</Heading>
	{#if text}<Text class={s.text()}>{text}</Text>{/if}
	{#if imageUrl}
		<Img src={imageUrl} alt={imageAlt ?? title} width="480" height="auto" class={s.image()} />
	{/if}
</Section>
