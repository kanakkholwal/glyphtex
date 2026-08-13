<script lang="ts">
	import { cn } from '@glyphtex/ui/utils';

	type Props = {
		words?: string[];
		/** Milliseconds each word is held before the next one flips in. */
		interval?: number;
		/** Milliseconds for the letter reveal. */
		animationDuration?: number;
		class?: string;
		textClass?: string;
		/** `brand` tints the pill and its type with the signal colour. */
		tone?: 'neutral' | 'brand';
	};

	let {
		words = ['better', 'modern', 'beautiful', 'awesome'],
		interval = 3000,
		animationDuration = 600,
		class: className = '',
		textClass = '',
		tone = 'neutral'
	}: Props = $props();

	let index = $state(0);
	let widths = $state<number[]>([]);

	const word = $derived(words[index] ?? '');
	const activeWidth = $derived(widths[index] ?? 0);

	// A literal space collapses at the edge of an inline-block letter, so
	// "lecture notes" renders as "lecturenotes". Escaped, not a pasted glyph:
	// the raw character is invisible in a diff and gets lost on the next edit.
	const NBSP = ' ';

	const reducedMotion =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	$effect(() => {
		if (reducedMotion || words.length < 2) return;
		const id = setInterval(() => {
			// Off-screen tabs still run timers; skipping keeps the hero from
			// burning frames nobody sees.
			if (document.hidden) return;
			index = (index + 1) % words.length;
		}, interval);
		return () => clearInterval(id);
	});
</script>

<!--
  Every word occupies the same grid cell, which makes each one measurable
  without a second render pass. The pill is then pinned to the *active* word's
  width rather than the widest one: at display sizes the widest word leaves a
  slab of empty tint around every shorter word.

  The words must stay `w-max`. As plain grid items they size to fit-content,
  which the pill's own measured width caps — so a word measured under the
  fallback font can never grow once the webfont swaps in, and stays clipped.

  Width animates, so the resize reads as intentional. Nothing else on the line
  moves: the pill is centred, so it grows and shrinks symmetrically.

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
	style:width={activeWidth ? `calc(${activeWidth}px + 0.28em)` : 'auto'}
	style:transition-duration={reducedMotion ? '0ms' : `${animationDuration / 2}ms`}
>
	<span class="sr-only">{words.join(', ')}</span>

	{#each words as w, i (w)}
		<span
			bind:offsetWidth={widths[i]}
			class={cn(
				'col-start-1 row-start-1 w-max justify-self-center whitespace-nowrap',
				i === index ? 'visible' : 'invisible',
				textClass
			)}
			aria-hidden="true"
		>
			{#if i === index}
				{#key word}
					{#each w.split('') as letter, l (l)}
						<span
							class="container-flip-letter"
							style:animation-delay="{l * 20}ms"
							style:animation-duration="{animationDuration / 2}ms"
							>{letter === ' ' ? NBSP : letter}</span
						>
					{/each}
				{/key}
			{:else}
				{w}
			{/if}
		</span>
	{/each}
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
