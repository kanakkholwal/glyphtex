<script lang="ts">
	import { PinInput as InputOTPPrimitive } from "bits-ui";
	import { cn } from "../../../lib/cn.js";
	import {
		type InputOtpInvalidMotion,
		type InputOtpSize,
		type InputOtpStatus,
		type InputOtpVariant,
		inputOtp
	} from "./variants";
	import { setInputOtpChange, setInputOtpStyle } from "./context";
	import InputOtpRing from "./input-otp-ring.svelte";

	let {
		ref = $bindable(null),
		value = $bindable(""),
		variant = "default",
		size = "default",
		invalid = false,
		invalidMotion = "shake",
		status = "idle",
		class: classProp,
		children: content,
		...rest
	}: Omit<InputOTPPrimitive.RootProps, "size"> & {
		variant?: InputOtpVariant;
		size?: InputOtpSize;
		/** Reds every slot; `invalidMotion` plays each time this turns on. */
		invalid?: boolean;
		invalidMotion?: InputOtpInvalidMotion;
		/** Controlled: "verifying" shimmers the slots, "success" folds them into InputOTPVerified. */
		status?: InputOtpStatus;
	} = $props();

	setInputOtpStyle(() => ({ variant, size, invalid, invalidMotion, status }));
	const s = $derived(inputOtp({ variant, size, invalid, invalidMotion, status }));

	// Derived, not an effect, so new characters mount with their delay already set.
	let previous = "";
	const change = $derived.by(() => {
		const next = value ?? "";
		const filled = [...next].map((c, i) => (c !== previous[i] ? i : -1)).filter((i) => i >= 0);
		previous = next;
		return { from: filled[0] ?? 0, count: filled.length };
	});
	setInputOtpChange(() => change);
</script>

<!-- One real input under the slots, so paste and one-time-code autofill work natively. -->
<InputOTPPrimitive.Root
	bind:ref
	bind:value
	data-slot="input-otp"
	aria-invalid={invalid || undefined}
	aria-busy={status === "verifying" || undefined}
	readonly={status !== "idle" || undefined}
	spellcheck={false}
	autocomplete="one-time-code"
	class={cn(s.root(), s.input(), classProp)}
	{...rest}
>
	{#snippet children(state)}
		{@render content?.(state)}
		<InputOtpRing active={state.cells.findIndex((cell) => cell.isActive)} />
	{/snippet}
</InputOTPPrimitive.Root>
