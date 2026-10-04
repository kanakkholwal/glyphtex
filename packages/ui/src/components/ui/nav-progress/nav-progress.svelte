<script lang="ts">
	import { navigating } from "$app/state";
	import { cn } from "../../../lib/cn.js";

	// Fast navigations finish before this; only a load the visitor would notice shows the bar.
	const SHOW_AFTER_MS = 150;

	let { class: className }: { class?: string } = $props();

	let visible = $state(false);
	const pending = $derived(navigating.to !== null);

	$effect(() => {
		if (!pending) {
			visible = false;
			return;
		}
		const timer = setTimeout(() => (visible = true), SHOW_AFTER_MS);
		return () => clearTimeout(timer);
	});
</script>

<div
	aria-hidden="true"
	class={cn(
		"pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden opacity-0",
		"transition-opacity duration-(--duration-base) ease-(--ease-out)",
		visible && "opacity-100",
		className
	)}
>
	<div class="sweep h-full w-2/5 bg-primary"></div>
</div>
<span role="status" class="sr-only">{visible ? "Loading page" : ""}</span>

<style>
	.sweep {
		animation: sweep 1.1s var(--ease-in-out) infinite;
	}

	@keyframes sweep {
		from {
			translate: -100% 0;
		}
		to {
			translate: 250% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sweep {
			width: 100%;
			animation: none;
		}
	}
</style>
