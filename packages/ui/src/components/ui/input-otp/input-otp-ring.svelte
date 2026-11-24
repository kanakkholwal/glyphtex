<script lang="ts">
	import { inputOtp } from "./variants";
	import { getInputOtpStyle } from "./context";

	let { active }: { active: number } = $props();
	const style = getInputOtpStyle();
	const s = $derived(inputOtp(style()));
	let ring = $state<HTMLSpanElement | null>(null);
	let placed = false;

	// One ring for the whole field, moved to whichever slot is active.
	$effect(() => {
		const at = active;
		const el = ring;
		const field = el?.parentElement;
		if (!el || !field) return;
		const place = () => {
			const slot = field.querySelectorAll<HTMLElement>("[data-slot=input-otp-slot]")[at];
			if (!slot) return;
			const box = field.getBoundingClientRect();
			const rect = slot.getBoundingClientRect();
			// The first placement jumps; every later one glides.
			if (!placed) el.style.transition = "none";
			el.style.width = `${rect.width}px`;
			el.style.height = `${rect.height}px`;
			el.style.translate = `${rect.left - box.left}px ${rect.top - box.top}px`;
			el.style.borderRadius = getComputedStyle(slot).borderRadius;
			if (!placed) {
				void el.offsetWidth;
				el.style.transition = "";
				placed = true;
			}
		};
		place();
		const watch = new ResizeObserver(place);
		watch.observe(field);
		return () => watch.disconnect();
	});
</script>

<span bind:this={ring} aria-hidden="true" data-show={active >= 0 || undefined} class={s.ring()}></span>
