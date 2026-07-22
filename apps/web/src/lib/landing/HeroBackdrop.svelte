<script lang="ts">
	type Props = {
		src: string;
		tone?: 'default' | 'strong' | 'subtle';
		/** Which edge the readability scrim ramps from: `left` for left-aligned
		 *  copy, `bottom` for centered copy that sits low in the card. */
		wash?: 'left' | 'bottom';
		class?: string;
	};

	let { src, tone = 'default', wash = 'bottom', class: className = '' }: Props = $props();

	const toneClass = {
		default: 'opacity-95 dark:opacity-60',
		strong: 'opacity-100 dark:opacity-75',
		subtle: 'opacity-70 dark:opacity-40'
	} as const;

	// The scrim carries readability on its own, so the photo underneath stays close
	// to full strength instead of being flattened toward the canvas colour.
	const washStyle = {
		left: `background: linear-gradient(to right,
			color-mix(in oklab, var(--canvas) 88%, transparent) 0%,
			color-mix(in oklab, var(--canvas) 72%, transparent) 26%,
			color-mix(in oklab, var(--canvas) 30%, transparent) 52%,
			transparent 72%);`,
		bottom: `background: linear-gradient(to bottom,
			transparent 0%,
			transparent 28%,
			color-mix(in oklab, var(--canvas) 28%, transparent) 62%,
			color-mix(in oklab, var(--canvas) 70%, transparent) 100%);`
	} as const;
</script>

<div aria-hidden="true" class="pointer-events-none absolute inset-0 {className}">
	<div
		class="absolute inset-0 bg-cover bg-center {toneClass[tone]}"
		style="background-image: url('{src}');"
	></div>

	<div class="absolute inset-0" style={washStyle[wash]}></div>

	{#if wash === 'left'}
		<!-- Narrow bottom fade only, so the trust strip clears the photo's detail. -->
		<div
			class="absolute inset-x-0 bottom-0 h-32"
			style="background: linear-gradient(to bottom, transparent, color-mix(in oklab, var(--canvas) 45%, transparent));"
		></div>
	{/if}
</div>
