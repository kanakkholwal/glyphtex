<script lang="ts">
	import { Hr } from "@better-svelte-email/components";
	import { type EmailDividerSpacing, emailDivider } from "../variants";

	let { spacing = "md" }: { spacing?: EmailDividerSpacing } = $props();
</script>

<Hr class={emailDivider({ spacing })} />
