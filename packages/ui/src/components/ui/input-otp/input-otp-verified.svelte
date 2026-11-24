<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "../../../lib/cn.js";
	import { INPUT_OTP_ICONS, inputOtp } from "./variants";
	import { getInputOtpStyle } from "./context";

	let { class: classProp, children }: { class?: string; children?: Snippet } = $props();
	const getStyle = getInputOtpStyle();
	const style = $derived(getStyle());
	const s = $derived(inputOtp(style));
</script>

<!-- The pill the slots fold into once `status` is "success"; place it inside InputOTP. -->
<span data-slot="input-otp-verified" aria-hidden={style.status !== "success"} class={cn(s.verified(), classProp)}>
	<svg viewBox="0 0 24 24" aria-hidden="true" class={s.check()}><path d={INPUT_OTP_ICONS.check} pathLength="1" /></svg>
	{#if children}{@render children()}{:else}Verified{/if}
</span>
