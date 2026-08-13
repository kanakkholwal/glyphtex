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
		animationDuration = 700,
		class: className = '',
		textClass = '',
		tone = 'neutral'
	}: Props = $props();

	let index = $state(0);

	const word = $derived(words[index] ?? '');

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
  Every word occupies the same grid cell, so the pill sizes to the widest one
  once and never resizes. The previous version measured the active word and
  animated `width`, which reflowed the surrounding H1 on every rotation.

  Accessibility: the rotation is decorative. An `aria-live` region here would
  announce a new word every few seconds for the whole session, so the animated
  run is hidden from AT and the full list is exposed once, statically.
-->
<span
	class={cn(
		'container-flip relative inline-grid overflow-hidden rounded-lg px-2.5 pt-0.5 pb-1 align-baseline',
		tone === 'brand' && 'container-flip-brand',
		className
	)}
>
	<span class="sr-only">{words.join(', ')}</span>

	{#each words as w, i (w)}
		<span
			class={cn(
				'container-flip-slot col-start-1 row-start-1 whitespace-nowrap',
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
							style:animation-duration="{animationDuration}ms">{letter === ' ' ? ' ' : letter}</span
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
		justify-items: center;
		align-items: center;
		background: linear-gradient(to bottom, var(--card), var(--muted));
		box-shadow:
			inset 0 -1px var(--border),
			inset 0 0 0 1px var(--border),
			0 4px 8px color-mix(in oklab, var(--border) 55%, transparent);
	}

	.container-flip-brand {
		color: var(--brand);
		background: linear-gradient(
			to bottom,
			color-mix(in oklab, var(--brand) 8%, var(--card)),
			color-mix(in oklab, var(--brand) 14%, var(--card))
		);
		box-shadow:
			inset 0 -1px color-mix(in oklab, var(--brand) 32%, transparent),
			inset 0 0 0 1px color-mix(in oklab, var(--brand) 24%, transparent),
			0 4px 12px color-mix(in oklab, var(--brand) 18%, transparent);
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

	@keyframes container-flip-in {
		from {
			opacity: 0;
			transform: translateY(0.14em);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.container-flip-letter {
			animation: none;
		}
	}
</style>
