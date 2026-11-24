<script lang="ts">
	import { cn } from "../../../lib/cn.js";
	import { formatCountdown, inputOtpMeta } from "./variants";

	let {
		seconds,
		onResend,
		hidden = false,
		disabled = false,
		prompt = "Didn't get a code?",
		class: classProp
	}: {
		seconds: number;
		onResend: () => void;
		/** Fades the line out, e.g. once the code is verified. */
		hidden?: boolean;
		disabled?: boolean;
		prompt?: string;
		class?: string;
	} = $props();
	const s = inputOtpMeta();
</script>

<!-- "Didn't get a code? Resend in 0:25", then a Resend button; `seconds` comes from your clock. -->
<p data-slot="input-otp-resend" data-hidden={hidden || undefined} class={cn(s.resend(), classProp)}>
	{prompt}
	{#if seconds > 0}
		<span class={cn(s.swap(), s.wait())}>Resend in{" "}{formatCountdown(seconds)}</span>
	{:else}
		<button type="button" disabled={disabled || hidden} onclick={onResend} class={cn(s.swap(), s.action())}>Resend code</button>
	{/if}
</p>
