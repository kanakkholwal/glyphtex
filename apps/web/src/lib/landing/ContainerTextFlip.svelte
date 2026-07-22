<script lang="ts">
	import { cn } from '@glyphtex/ui/utils';

	type Props = {
		words?: string[];
		/** Milliseconds each word is held before the next one flips in. */
		interval?: number;
		/** Milliseconds for the letter reveal. The container resizes in half this. */
		animationDuration?: number;
		class?: string;
		textClass?: string;
	};

	let {
		words = ['better', 'modern', 'beautiful', 'awesome'],
		interval = 3000,
		animationDuration = 700,
		class: className = '',
		textClass = ''
	}: Props = $props();

	// A plain space collapses at the edge of an inline-block letter.
	const NBSP = ' ';

	let index = $state(0);
	let textWidth = $state(0);

	const word = $derived(words[index] ?? '');

	const reducedMotion =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	$effect(() => {
		if (reducedMotion || words.length < 2) return;
		const id = setInterval(() => {
			index = (index + 1) % words.length;
		}, interval);
		return () => clearInterval(id);
	});
</script>

<!-- The measured span stays `whitespace-nowrap` so its natural width never depends
     on the width we set on the container — otherwise the two would feed back. -->
<span
	class={cn(
		'container-flip relative inline-flex items-center justify-center overflow-hidden rounded-lg px-2.5 pt-0.5 pb-1 align-baseline',
		className
	)}
	style:width={textWidth ? `${textWidth + 20}px` : 'auto'}
	style:transition-duration={reducedMotion ? '0ms' : `${animationDuration / 2}ms`}
	aria-label={word}
	aria-live="polite"
>
	<span bind:offsetWidth={textWidth} class={cn('whitespace-nowrap', textClass)} aria-hidden="true">
		{#key word}
			{#each word.split('') as letter, i (i)}
				<span
					class="container-flip-letter"
					style:animation-delay="{i * 20}ms"
					style:animation-duration="{animationDuration}ms">{letter === ' ' ? NBSP : letter}</span
				>
			{/each}
		{/key}
	</span>
</span>

<style>
	/* Sizing is inherited on purpose: the pill takes the font size, family, and
	   style of the heading it sits in, so it never sets its own type scale. */
	.container-flip {
		font: inherit;
		transition-property: width;
		transition-timing-function: cubic-bezier(0.625, 0.05, 0, 1);
		background: linear-gradient(to bottom, var(--card), var(--muted));
		box-shadow:
			inset 0 -1px var(--border),
			inset 0 0 0 1px var(--border),
			0 4px 8px color-mix(in oklab, var(--border) 55%, transparent);
	}

	/* `backwards`, not `both`: the resting state below is the visible one, so a
	   dropped or unsupported animation can never leave a letter stuck invisible. */
	.container-flip-letter {
		display: inline-block;
		opacity: 1;
		animation-name: container-flip-in;
		animation-fill-mode: backwards;
		animation-timing-function: ease-in-out;
	}

	@keyframes container-flip-in {
		from {
			opacity: 0;
			filter: blur(8px);
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
