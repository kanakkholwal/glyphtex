<script lang="ts">
	import EmailButton from "../kit/svelte/email-button.svelte";
	import EmailDivider from "../kit/svelte/email-divider.svelte";
	import EmailFallbackLink from "../kit/svelte/email-fallback-link.svelte";
	import EmailFooter from "../kit/svelte/email-footer.svelte";
	import EmailHeader from "../kit/svelte/email-header.svelte";
	import EmailHero from "../kit/svelte/email-hero.svelte";
	import EmailShell from "../kit/svelte/email-shell.svelte";
	import EmailText from "../kit/svelte/email-text.svelte";

	let {
		preview,
		eyebrow,
		heading,
		lines,
		actionLabel,
		actionUrl,
		reason = "You got this email because of activity on your GlyphTeX account."
	}: {
		preview: string;
		eyebrow: string;
		heading: string;
		lines: string[];
		actionLabel: string;
		actionUrl: string;
		reason?: string;
	} = $props();
</script>

<EmailShell {preview} surface="card">
	{#snippet cardFooter()}
		<EmailFooter
			lines={["GlyphTeX", "Local-first LaTeX editor"]}
			{reason}
			brand="GlyphTeX"
			layout="band"
		/>
	{/snippet}
	<EmailHeader brand="GlyphTeX" />
	<EmailHero {eyebrow} title={heading} text={lines[0]} tone="accent" />
	{#each lines.slice(1) as line}
		<EmailText>{line}</EmailText>
	{/each}
	<EmailButton href={actionUrl} size="lg" width="full">{actionLabel}</EmailButton>
	<EmailDivider spacing="lg" />
	<EmailFallbackLink href={actionUrl} />
</EmailShell>
