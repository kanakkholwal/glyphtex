<script lang="ts">
	// Decorative LaTeX symbols that drift behind the hero. Purely cosmetic:
	// pointer-events off, hidden from assistive tech, and frozen when the visitor
	// prefers reduced motion (handled in the stylesheet).
	type Glyph = {
		char: string;
		top: string;
		left: string;
		size: string;
		dur: string;
		delay: string;
		op: string;
	};

	const glyphs: Glyph[] = [
		{ char: '\\sum', top: '12%', left: '6%', size: '2.1rem', dur: '11s', delay: '0s', op: '0.10' },
		{ char: '\\int', top: '64%', left: '4%', size: '2.6rem', dur: '13s', delay: '1.5s', op: '0.09' },
		{ char: '\\alpha', top: '28%', left: '88%', size: '1.9rem', dur: '12s', delay: '0.6s', op: '0.10' },
		{ char: '\\frac{1}{n}', top: '74%', left: '82%', size: '1.5rem', dur: '15s', delay: '2.2s', op: '0.08' },
		{ char: '\\nabla', top: '8%', left: '70%', size: '1.7rem', dur: '10s', delay: '0.3s', op: '0.09' },
		{ char: '\\pi', top: '46%', left: '93%', size: '2.3rem', dur: '14s', delay: '1.1s', op: '0.10' },
		{ char: '\\theta', top: '84%', left: '40%', size: '1.6rem', dur: '12s', delay: '2.8s', op: '0.07' },
		{ char: '\\infty', top: '18%', left: '34%', size: '1.8rem', dur: '13s', delay: '1.9s', op: '0.07' },
		{ char: '\\lambda', top: '54%', left: '14%', size: '1.5rem', dur: '11s', delay: '0.9s', op: '0.08' },
		{ char: '\\partial', top: '38%', left: '54%', size: '1.4rem', dur: '16s', delay: '3.4s', op: '0.06' }
	];
</script>

<div class="glyph-field pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
	{#each glyphs as g, i (i)}
		<span
			class="text-brand absolute font-mono select-none"
			style:top={g.top}
			style:left={g.left}
			style:font-size={g.size}
			style:opacity={g.op}
			style:animation-duration={g.dur}
			style:animation-delay={g.delay}>{g.char}</span
		>
	{/each}
</div>

<style>
	.glyph-field span {
		animation-name: drift;
		animation-timing-function: ease-in-out;
		animation-iteration-count: infinite;
		will-change: transform;
	}

	@keyframes drift {
		0% {
			transform: translateY(0) rotate(-3deg);
		}
		50% {
			transform: translateY(-22px) rotate(3deg);
		}
		100% {
			transform: translateY(0) rotate(-3deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.glyph-field span {
			animation: none;
		}
	}
</style>
