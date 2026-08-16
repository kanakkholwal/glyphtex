<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import { nextIndex, pillWidth, splitLetters } from "./text-flip";

	type Props = {
		words?: string[];
		/** Milliseconds each word is held before the next one flips in. */
		interval?: number;
		/** Milliseconds for the letter reveal. */
		animationDuration?: number;
		class?: string;
		textClass?: string;
		/** `brand` tints the pill and its type with the signal colour. */
		tone?: "neutral" | "brand";
	};

	let {
		words = ["better", "modern", "beautiful", "awesome"],
		interval = 3000,
		animationDuration = 600,
		class: className = "",
		textClass = "",
		tone = "neutral"
	}: Props = $props();

	let index = $state(0);
	let widths = $state<number[]>([]);
	let measureEls = $state<(HTMLElement | undefined)[]>([]);

	const word = $derived(words[index] ?? "");
	const activeWidth = $derived(widths[index] ?? 0);

	const reducedMotion =
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

	$effect(() => {
		const els = measureEls.filter((el): el is HTMLElement => !!el);
		if (!els.length) return;

		let live = true;
		// Fractional, then rounded up: offsetWidth's integer rounding clips the
		// last glyph by a sub-pixel sliver at display sizes.
		const measure = () => {
			if (live) widths = els.map((el) => Math.ceil(el.getBoundingClientRect().width));
		};

		measure();
		// The first measurement lands under the fallback font; the swap resizes
		// these nodes, and `fonts.ready` covers browsers that batch that silently.
		const observer = new ResizeObserver(measure);
		for (const el of els) observer.observe(el);
		document.fonts?.ready.then(measure);

		return () => {
			live = false;
			observer.disconnect();
		};
	});

	$effect(() => {
		if (reducedMotion || words.length < 2) return;
		const id = setInterval(() => {
			// Off-screen tabs still run timers; skipping keeps the hero from
			// burning frames nobody sees.
			if (document.hidden) return;
			index = nextIndex(index, words.length);
		}, interval);
		return () => clearInterval(id);
	});
</script>

<!-- Split into per-letter boxes for both copies: inline-block suppresses kerning
     and ligatures, so unsplit text measures narrower than the word renders. -->
{#snippet letters(w: string, animated: boolean)}
	{#each splitLetters(w) as letter, l (l)}
		<span
			class={animated ? 'container-flip-letter' : 'container-flip-glyph'}
			style:animation-delay={animated ? `${l * 20}ms` : null}
			style:animation-duration={animated ? `${animationDuration / 2}ms` : null}>{letter}</span
		>
	{/each}
{/snippet}

<!--
  The pill is pinned to the *active* word's width rather than the widest one: at
  display sizes the widest word leaves a slab of empty tint around every shorter
  one. Width animates, so the resize reads as intentional, and the pill is
  centred, so it grows and shrinks symmetrically without moving the line.

  That makes the container's width depend on its own content, so the words are
  measured in a detached layer instead: absolute and `max-content`, which sizes
  from the text alone and can never be clamped by the width it is feeding.

  Accessibility: the rotation is decorative. An `aria-live` region here would
  announce a new word every few seconds for the whole session, so the animated
  run is hidden from AT and the full list is exposed once, statically.
-->
<span
	class={cn(
		'container-flip relative inline-grid overflow-hidden rounded-[0.22em] px-[0.14em] pb-[0.04em] align-baseline',
		tone === 'brand' && 'container-flip-brand',
		className
	)}
	style:width={pillWidth(activeWidth)}
	style:transition-duration={reducedMotion ? '0ms' : `${animationDuration / 2}ms`}
>
	<span class="sr-only">{words.join(', ')}</span>

	<span class="container-flip-measure" aria-hidden="true">
		{#each words as w, i (w)}
			<span bind:this={measureEls[i]} class={textClass}>{@render letters(w, false)}</span>
		{/each}
	</span>

	<span class={cn('container-flip-word', textClass)} aria-hidden="true">
		{#key word}
			{@render letters(word, true)}
		{/key}
	</span>
</span>

<style>
	/* Sizing is inherited on purpose: the pill takes the font size, family, and
	   style of the heading it sits in, so it never sets its own type scale. */
	.container-flip {
		font: inherit;
		align-items: center;
		max-width: 100%;
		transition-property: width;
		transition-timing-function: cubic-bezier(0.625, 0.05, 0, 1);
		background: var(--surface-soft);
	}

	.container-flip-brand {
		color: var(--brand);
		background: color-mix(in oklab, var(--brand) 12%, var(--background));
	}

	/* Intrinsic width is the whole point of this layer, so it is set here rather
	   than with a utility class that a stale Tailwind build could omit. */
	.container-flip-measure {
		position: absolute;
		top: 0;
		left: 0;
		width: max-content;
		visibility: hidden;
		pointer-events: none;
	}

	.container-flip-measure > span {
		display: block;
		width: max-content;
		white-space: nowrap;
	}

	.container-flip-word {
		grid-column: 1;
		grid-row: 1;
		justify-self: center;
		width: max-content;
		white-space: nowrap;
	}

	.container-flip-glyph {
		display: inline-block;
	}

	/* `backwards`, not `both`: the resting state below is the visible one, so a
	   dropped or unsupported animation can never leave a letter stuck invisible. */
	.container-flip-letter {
		display: inline-block;
		opacity: 1;
		animation-name: container-flip-in;
		animation-fill-mode: backwards;
		animation-timing-function: ease-out;
	}

	/* Blur is em-relative: the source used 10px at 72px type, and a fixed px blur
	   at this pill's inherited ~24px would smear the letter into a blob. */
	@keyframes container-flip-in {
		from {
			opacity: 0;
			filter: blur(0.14em);
		}
		to {
			opacity: 1;
			filter: blur(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.container-flip {
			transition: none;
		}
		.container-flip-letter {
			animation: none;
		}
	}
</style>
