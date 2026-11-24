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

<div bind:this={ref} data-slot="input-otp-group" class={cn(inputOtp(style()).group(), classProp)} {...rest}>
	{@render children?.()}
</div>
