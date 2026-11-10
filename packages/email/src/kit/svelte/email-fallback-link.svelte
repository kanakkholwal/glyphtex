<script lang="ts">
	import { Link, Text } from "@better-svelte-email/components";
	import { type EmailFallbackLinkAlign, emailFallbackLink } from "../variants";

	/** The raw URL under a button, for clients that block buttons or strip styles. */
	let {
		href,
		label = "If the button doesn't work, paste this link into your browser:",
		align = "left"
	}: { href: string; label?: string; align?: EmailFallbackLinkAlign } = $props();

	const s = $derived(emailFallbackLink({ align }));
</script>

<Text class={s.root()}>{label} <Link {href} class={s.link()}>{href}</Link></Text>
