<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "../../../lib/cn.js";
	import { inputOtp } from "./variants";
	import { getInputOtpStyle } from "./context";

	let {
		ref = $bindable(null),
		class: classProp,
		children,
		...rest
	}: HTMLAttributes<HTMLDivElement> & { ref?: HTMLDivElement | null } = $props();
	const style = getInputOtpStyle();
</script>

<div
	bind:this={ref}
	data-slot="input-otp-separator"
	role="separator"
	class={cn(inputOtp(style()).separator(), classProp)}
	{...rest}
>
	{#if children}
		{@render children()}
	{:else}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
			<path d="M5 12h14" />
		</svg>
	{/if}
</div>
