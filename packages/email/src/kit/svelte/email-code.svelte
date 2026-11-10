<script lang="ts">
	import { Text } from "@better-svelte-email/components";
	import { type EmailCodeSize, emailCode } from "../variants";

	let { code, size = "lg" }: { code: string; size?: EmailCodeSize } = $props();
</script>

<Text class={emailCode({ size })}>{code}</Text>
