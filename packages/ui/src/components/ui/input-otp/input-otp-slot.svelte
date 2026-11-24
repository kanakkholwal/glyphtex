<script lang="ts">
	import { PinInput as InputOTPPrimitive } from "bits-ui";
	import { cn } from "../../../lib/cn.js";
	import { inputOtp } from "./variants";
	import { getInputOtpChange, getInputOtpStyle } from "./context";

	let {
		ref = $bindable(null),
		cell,
		class: classProp,
		...rest
	}: InputOTPPrimitive.CellProps = $props();

	const style = getInputOtpStyle();
	const getChange = getInputOtpChange();
	const s = $derived(inputOtp(style()));
	const change = $derived(getChange());
	// bits-ui cells carry no index, so the slot reads its place from the DOM once mounted.
	let index = $state(0);
	$effect(() => {
		const field = ref?.closest("[data-pin-input-root]");
		if (ref && field)
			index = [...field.querySelectorAll("[data-slot=input-otp-slot]")].indexOf(ref);
	});
	const delay = $derived(change.count > 1 && index >= change.from ? (index - change.from) * 45 : 0);
</script>

<InputOTPPrimitive.Cell
	{cell}
	bind:ref
	data-slot="input-otp-slot"
	data-filled={cell.char ? "" : undefined}
	style="--otp-delay-shimmer: {index * 70}ms"
	class={cn(s.slot(), classProp)}
	{...rest}
>
	{#if cell.char}
		{#key cell.char}<span class={s.value()} style="--otp-delay: {delay}ms">{cell.char}</span>{/key}
	{/if}
	{#if cell.hasFakeCaret}
		<div class={s.caret()}>
			<div class={s.caretLine()}></div>
		</div>
	{/if}
</InputOTPPrimitive.Cell>
