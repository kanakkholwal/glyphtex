<script lang="ts">
	import { Column, Img, Link, Row, Section, Text } from "@better-svelte-email/components";
	import { type EmailFooterAlign, type EmailFooterLayout, emailFooter } from "../variants";

	export interface EmailFooterLink {
		label: string;
		href: string;
	}

	let {
		lines,
		links = [],
		reason,
		brand,
		logo,
		layout = "plain",
		align = "center"
	}: {
		/** Sender identity and postal address: required for commercial mail in many regions. */
		lines: string[];
		links?: EmailFooterLink[];
		/** Why the recipient got this email, e.g. "You're receiving this because you signed up". */
		reason?: string;
		/** Product name, set as a small lockup above the legal lines (inside the bar for `bar`). */
		brand?: string;
		/** Absolute URL of the square mark beside `brand`, shown at 20px. */
		logo?: string;
		/** `plain` goes in EmailShell's `footer`; `band`, `bar` and `row` go in its `cardFooter`. */
		layout?: EmailFooterLayout;
		align?: EmailFooterAlign;
	} = $props();

	const s = $derived(emailFooter({ layout, align }));
</script>

{#snippet linkRow()}
	{#if links.length > 0}
		<Text class={s.linkText()}>
			{#each links as link, i (link.href)}{#if i > 0}{" · "}{/if}<Link href={link.href} class={s.link()}>{link.label}</Link>{/each}
		</Text>
	{/if}
{/snippet}

{#snippet lockup()}
	{#if brand}
		<Text class={s.brand()}>
			{#if logo}<Img src={logo} alt="" role="presentation" width="20" height="20" class={s.mark()} />{/if}<span class={logo ? s.markName() : undefined}>{brand}</span>
		</Text>
	{/if}
{/snippet}

{#snippet legal()}
	{#if reason}<Text class={s.reason()}>{reason}</Text>{/if}
	{#each lines as line (line)}
		<Text class={s.text()}>{line}</Text>
	{/each}
{/snippet}

{#if layout === "bar"}
	<Section class={s.root()}>
		<Section class={s.bar()}>
			<Row>
				<Column>{@render lockup()}</Column>
				<Column class={s.linksCell()}>{@render linkRow()}</Column>
			</Row>
		</Section>
		<Section class={s.legal()}>{@render legal()}</Section>
	</Section>
{:else if layout === "row"}
	<Section class={s.root()}>
		{@render lockup()}
		<Row>
			<Column>{@render legal()}</Column>
			<Column class={s.linksCell()}>{@render linkRow()}</Column>
		</Row>
	</Section>
{:else}
	<Section class={s.root()}>
		{@render lockup()}
		{@render legal()}
		{@render linkRow()}
	</Section>
{/if}
