<script lang="ts">
	import { navigating } from "$app/state";
	import { cubicOut } from "svelte/easing";
	import { Tween, prefersReducedMotion } from "svelte/motion";

	/** Top-of-page bar driven by `navigating`: trickles toward 0.9 while loading, then fills and fades.
	 *  `shadow` is accepted for older call sites and ignored: the design system has no glows. */
	let {
		color = "var(--color-primary)",
		height = 3,
		trickleSpeed = 200,
		minimum = 0.08,
		duration = 300
	}: {
		color?: string;
		height?: number;
		trickleSpeed?: number;
		minimum?: number;
		duration?: number;
		shadow?: boolean;
	} = $props();

	const progress = new Tween(0, {
		duration: () => (prefersReducedMotion.current ? 0 : duration),
		easing: cubicOut
	});

	let visible = $state(false);
	let trickleInterval: ReturnType<typeof setInterval> | null = null;
	// Deferred completion work bails when a newer navigation bumped this, or a stale
	// callback hides the bar mid-way through a chained navigation.
	let navGeneration = 0;

	function startTrickle() {
		if (trickleInterval) return;
		trickleInterval = setInterval(() => {
			const remaining = 0.9 - progress.target;
			if (remaining <= 0) return;
			const increment = remaining * 0.1 + Math.random() * 0.02;
			progress.set(Math.min(progress.target + increment, 0.9));
		}, trickleSpeed);
	}

	function stopTrickle() {
		if (trickleInterval) {
			clearInterval(trickleInterval);
			trickleInterval = null;
		}
	}

	$effect(() => {
		const active = navigating.to !== null;
		const token = ++navGeneration;
		if (active) {
			visible = true;
			progress.set(minimum, { duration: 0 });
			startTrickle();
		} else {
			stopTrickle();
			const finish = prefersReducedMotion.current ? 0 : duration * 0.5;
			progress.set(1, { duration: finish }).then(() => {
				if (token !== navGeneration) return;
				setTimeout(() => {
					if (token !== navGeneration) return;
					visible = false;
					progress.set(0, { duration: 0 });
				}, 200);
			});
		}
	});
</script>

{#if visible}
	<div
		class="nav-progress"
		style="
			--progress: {progress.current};
			--color: {color};
			--height: {height}px;
		"
		aria-hidden="true"
	>
		<div class="bar"></div>
	</div>
{/if}

<style>
	.nav-progress {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 9999;
		pointer-events: none;
		height: var(--height);
	}

	.bar {
		height: 100%;
		background: var(--color);
		border-radius: 0 2px 2px 0;
		transform-origin: left center;
		transform: scaleX(var(--progress));
		/* The Tween animates; a CSS transition would double it. */
		transition: transform 0ms;
	}
</style>
