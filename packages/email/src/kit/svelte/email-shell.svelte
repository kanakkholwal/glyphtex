<script lang="ts">
	import { Body, Container, Head, Html, Preview, Section } from "@better-svelte-email/components";
	import type { Snippet } from "svelte";
	import { type EmailShellSurface, emailShell } from "../variants";

	let {
		preview,
		children,
		footer,
		cardFooter,
		lang = "en",
		surface = "card"
	}: {
		/** Inbox preview line shown after the subject; keep it under ~90 characters. */
		preview: string;
		children: Snippet;
		/** Rendered under the card, e.g. a `plain` EmailFooter. Declare it inside the children: a
		 * top-level snippet passed as a prop fails svelte-check in apps importing this package. */
		footer?: Snippet;
		/** Rendered inside the card after the content, edge to edge, e.g. a `band` or `bar` footer. */
		cardFooter?: Snippet;
		lang?: string;
		surface?: EmailShellSurface;
	} = $props();

	const s = $derived(emailShell({ surface }));
</script>

<Html {lang}>
	<Head>
		<meta name="color-scheme" content="light dark" />
		<meta name="supported-color-schemes" content="light dark" />
	</Head>
	<Preview {preview} />
	<Body class={s.body()}>
		<Section class={s.page()}>
			<Container class={s.container()}>
				<Section class={s.card()}>
					<Section class={s.content()}>{@render children()}</Section>
					{@render cardFooter?.()}
				</Section>
				{@render footer?.()}
			</Container>
		</Section>
	</Body>
</Html>
