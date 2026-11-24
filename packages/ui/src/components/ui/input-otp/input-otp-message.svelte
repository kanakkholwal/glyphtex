<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "../../../lib/cn.js";
	import { INPUT_OTP_ICONS, inputOtpMeta } from "./variants";

	let {
		open,
		id,
		class: classProp,
		children
	}: {
		open: boolean;
		/** Point the input's `aria-describedby` here. */
		id?: string;
		class?: string;
		children?: Snippet;
	} = $props();
	const s = inputOtpMeta();
</script>

<!-- A line under the field, e.g. why the code failed; folds away when `open` is false. -->
<div data-slot="input-otp-message" data-open={open || undefined} class={s.fold()}>
	<div class={s.clip()}>
		<p {id} role={open ? "alert" : undefined} class={cn(s.message(), classProp)}>
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d={INPUT_OTP_ICONS.alert} /></svg>
			{@render children?.()}
		</p>
	</div>
</div>
